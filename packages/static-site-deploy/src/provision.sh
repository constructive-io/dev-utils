#!/usr/bin/env bash

set -euo pipefail

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

dry_run=false
case "${1-}:$#" in
  :0) ;;
  --dry-run:1) dry_run=true ;;
  *) fail "Usage: static-site-deploy setup --site OWNER/REPO [--provision] [--dry-run]" ;;
esac

for name in SITE_REPO SITE_REVIEWER SITE_BRANCH AWS_ACCOUNT_ID AWS_DEPLOY_ROLE_NAME AWS_REGION AWS_S3_BUCKET AWS_CLOUDFRONT_DISTRIBUTION_ID SITE_URL; do
  [[ ${!name-} =~ [^[:space:]] ]] || fail "Set $name before running this script."
done
[[ $AWS_ACCOUNT_ID =~ ^[0-9]{12}$ ]] || fail "AWS_ACCOUNT_ID must be a 12-digit AWS account ID."
[[ $AWS_DEPLOY_ROLE_NAME =~ ^[A-Za-z0-9_+=,.@-]{1,64}$ ]] || fail "AWS_DEPLOY_ROLE_NAME must be a valid IAM role name."
[[ $AWS_S3_BUCKET =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || fail "AWS_S3_BUCKET must be a bucket name, without s3://."
[[ $AWS_CLOUDFRONT_DISTRIBUTION_ID =~ ^[A-Z0-9]+$ ]] || fail "AWS_CLOUDFRONT_DISTRIBUTION_ID must be a distribution ID."
[[ $AWS_REGION =~ ^[a-z]{2}(-[a-z0-9]+)+-[0-9]+$ ]] || fail "AWS_REGION must be an AWS region."
[[ $SITE_URL =~ ^https://[^/[:space:]]+[^[:space:]]*$ ]] || fail "SITE_URL must be the HTTPS homepage URL."

command -v jq >/dev/null || fail "Install jq first."
if ! $dry_run; then
  command -v aws >/dev/null || fail "Install AWS CLI v2 first."
  command -v gh >/dev/null || fail "Install GitHub CLI first."
  [[ $(aws --version) == aws-cli/2.* ]] || fail "Install AWS CLI v2 first."
fi
export AWS_PAGER="" GH_PROMPT_DISABLED=1

[[ $SITE_REPO =~ ^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$ && $SITE_REPO != */. && $SITE_REPO != */.. ]] || fail "Expected OWNER/REPO."
[[ $SITE_REVIEWER =~ ^[A-Za-z0-9][A-Za-z0-9-]*$ ]] || fail "Expected a GitHub username."
[[ $SITE_BRANCH =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || fail "Expected a deployment branch name."
issuer=token.actions.githubusercontent.com
audience=sts.amazonaws.com
provider=arn:aws:iam::$AWS_ACCOUNT_ID:oidc-provider/$issuer
policy_name=SiteDeploy

exec 3>&1
print_command() {
  printf '%q ' "$@" >&3
  printf '\n' >&3
}

run() {
  if $dry_run; then print_command "$@"; else "$@"; fi
}

read_state() {
  local example=$1
  shift
  if $dry_run; then
    print_command "$@"
    printf '%s\n' "$example"
  else
    "$@"
  fi
}

read_optional() {
  local missing=$1 result
  shift
  if $dry_run; then
    print_command "$@"
  elif result=$(LC_ALL=C "$@" 2>&1); then
    printf '%s\n' "$result"
  elif [[ $result != *"$missing"* ]]; then
    fail "$result"
  fi
}

write_github() {
  local method=$1 endpoint=$2 body=$3
  if $dry_run; then
    printf 'printf %q %q | ' '%s\n' "$body"
    print_command gh api --method "$method" "$endpoint" --input -
  else
    gh api --method "$method" "$endpoint" --input - --silent <<< "$body"
  fi
}

repo=$(read_state "$SITE_REPO" gh api "repos/$SITE_REPO" --jq .full_name)
environment=repos/$repo/environments/production
branch_policies=$environment/deployment-branch-policies
subject_template=repos/$repo/actions/oidc/customization/sub
identity=$(read_state "arn:aws:iam::$AWS_ACCOUNT_ID:root" aws sts get-caller-identity --query Arn --output text)
[[ $identity == arn:aws:*:"$AWS_ACCOUNT_ID":* ]] || fail "AWS credentials do not belong to account $AWS_ACCOUNT_ID in the standard AWS partition."
template=$(read_state '{"use_immutable_subject":false}' gh api "$subject_template")
jq -e '.use_immutable_subject != true' <<< "$template" >/dev/null ||
  fail "This repository uses immutable OIDC subjects. Do not replace its template with the name-based trust policy."

reviewer=$(read_state 1 gh api "users/$SITE_REVIEWER" --jq .id)
[[ $reviewer =~ ^[1-9][0-9]*$ ]] || fail "Could not resolve the GitHub reviewer $SITE_REVIEWER."
protection=$(jq -cn --argjson id "$reviewer" '{
  wait_timer: 0, prevent_self_review: false, reviewers: [{type: "User", id: $id}],
  deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}
}')
current=$(read_optional '(HTTP 404)' gh api "$environment")
if [[ -z $current ]] || ! jq -e --argjson reviewer "$reviewer" '
  .deployment_branch_policy == {protected_branches: false, custom_branch_policies: true}
  and ([.protection_rules[] | select(.type == "wait_timer" and .wait_timer > 0)] | length == 0)
  and any(.protection_rules[];
    .type == "required_reviewers" and .prevent_self_review == false
    and ([.reviewers[] | {type, id: .reviewer.id}] == [{type: "User", id: $reviewer}]))
' <<< "$current" >/dev/null; then
  write_github PUT "$environment" "$protection"
fi

policies=$(read_state '[{"branch_policies":[]}]' gh api --paginate --slurp "$branch_policies")
if ! jq -e --arg branch "$SITE_BRANCH" 'any(.[].branch_policies[]; .name == $branch and .type == "branch")' <<< "$policies" >/dev/null; then
  write_github POST "$branch_policies" "$(jq -cn --arg branch "$SITE_BRANCH" '{name: $branch, type: "branch"}')"
fi
stale=$(jq -r --arg branch "$SITE_BRANCH" '.[].branch_policies[] | select(.name != $branch or .type != "branch") | .id' <<< "$policies")
for id in $stale; do
  run gh api --method DELETE "$branch_policies/$id" --silent
done

protection=$(read_state '{"can_admins_bypass":false}' gh api "$environment")
if ! jq -e '.can_admins_bypass == false' <<< "$protection" >/dev/null; then
  fail "In https://github.com/$repo/settings/environments, open production, uncheck 'Allow administrators to bypass configured protection rules', save, and rerun. OIDC and IAM trust have not been changed."
fi

provider_state=$(read_optional '(NoSuchEntity)' aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$provider" --output json)
if [[ -z $provider_state ]]; then
  run aws iam create-open-id-connect-provider --url "https://$issuer" --client-id-list "$audience" >/dev/null
elif ! jq -e --arg aud "$audience" '.ClientIDList | index($aud) != null' <<< "$provider_state" >/dev/null; then
  run aws iam add-client-id-to-open-id-connect-provider --open-id-connect-provider-arn "$provider" --client-id "$audience"
fi

trust=$(jq -cn --arg provider "$provider" --arg aud "$audience" --arg sub "repo:$repo:environment:production:ref:refs/heads/$SITE_BRANCH" '{
  Version: "2012-10-17", Statement: [{
    Effect: "Allow", Principal: {Federated: $provider}, Action: "sts:AssumeRoleWithWebIdentity",
    Condition: {StringEquals: {"token.actions.githubusercontent.com:aud": $aud, "token.actions.githubusercontent.com:sub": $sub}}
  }]
}')
permissions=$(jq -cn --arg bucket "arn:aws:s3:::$AWS_S3_BUCKET" \
  --arg dist "arn:aws:cloudfront::$AWS_ACCOUNT_ID:distribution/$AWS_CLOUDFRONT_DISTRIBUTION_ID" '{
  Version: "2012-10-17", Statement: [
    {Effect: "Allow", Action: "s3:ListBucket", Resource: $bucket},
    {Effect: "Allow", Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource: ($bucket + "/*")},
    {Effect: "Allow", Action: ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"], Resource: $dist}
  ]
}')
role=$(read_optional '(NoSuchEntity)' aws iam get-role --role-name "$AWS_DEPLOY_ROLE_NAME" --output json)
if [[ -z $role ]]; then
  role_arn=$(read_state "arn:aws:iam::$AWS_ACCOUNT_ID:role/$AWS_DEPLOY_ROLE_NAME" \
    aws iam create-role --role-name "$AWS_DEPLOY_ROLE_NAME" --assume-role-policy-document "$trust" --query Role.Arn --output text)
else
  role_arn=$(jq -er '.Role.Arn' <<< "$role")
  attached=$(aws iam list-attached-role-policies --role-name "$AWS_DEPLOY_ROLE_NAME" --output json)
  inline=$(aws iam list-role-policies --role-name "$AWS_DEPLOY_ROLE_NAME" --output json)
  if ! jq -e '.AttachedPolicies == []' <<< "$attached" >/dev/null ||
     ! jq -e --arg policy "$policy_name" '(.PolicyNames - [$policy]) == []' <<< "$inline" >/dev/null; then
    fail "Use a dedicated deploy role without unrelated policies: $AWS_DEPLOY_ROLE_NAME has other policies."
  fi
  run aws iam update-assume-role-policy --role-name "$AWS_DEPLOY_ROLE_NAME" --policy-document "$trust"
fi
run aws iam put-role-policy --role-name "$AWS_DEPLOY_ROLE_NAME" --policy-name "$policy_name" --policy-document "$permissions"
write_github PUT "$subject_template" '{"use_default":false,"include_claim_keys":["repo","context","ref"]}'

for name in AWS_S3_BUCKET AWS_CLOUDFRONT_DISTRIBUTION_ID SITE_URL AWS_REGION; do
  run gh variable set "$name" --repo "$repo" --env production --body "${!name}"
done
run gh variable set AWS_DEPLOY_ROLE_ARN --repo "$repo" --env production --body "$role_arn"

if ! $dry_run; then
  printf '%s\n' "Production setup complete. No deploy was started."
fi
