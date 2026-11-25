---
name: static-site-deploy
description: Configure a static site for S3 and CloudFront, preview or run a local deployment, and set up manual GitHub Actions OIDC deploys.
---

# Static site deploy

Use this skill with the site's deploy guide and the [CLI reference](../../../packages/static-site-deploy/README.md). Start with an existing dedicated S3 bucket and CloudFront distribution; the CLI does not create hosting, build the site, or change DNS. Never commit credentials, target values, or local AWS profile names.

## Local setup and deployment

- `pnpm exec static-site-deploy setup --site acme/site` prompts for missing settings and saves the bucket, distribution ID, HTTPS homepage URL, region, and profile name in per-site AppStash. Authenticate the AWS CLI to the site's account first; credentials stay with the AWS CLI. Plain setup does not provision AWS or GitHub.
- `pnpm exec static-site-deploy check --site acme/site` is silent on success. It validates configuration without prompting and does not check AWS credentials, permissions, or whether targets exist. Shell values (`AWS_S3_BUCKET`, `AWS_CLOUDFRONT_DISTRIBUTION_ID`, `SITE_URL`, `AWS_REGION`, and `AWS_PROFILE`) override saved settings. CI uses environment variables only; the CLI does not fetch them from GitHub.
- Build the site, then preview with `pnpm exec static-site-deploy deploy --site acme/site --dir out --dry-run`. This needs S3 list access. Inspect the planned uploads, alias copies, and deletions; it does not write to AWS, invalidate CloudFront, or check the live homepage.
- If the site defines the scripts, `pnpm run deploy:all` builds and publishes; `pnpm run deploy` publishes an existing export. Bare `pnpm deploy` is pnpm's workspace command, not the site script. Never run a real deploy without explicit approval for that deployment, and do not publish concurrently from GitHub and a workstation.
- A real deploy uploads the export and extensionless aliases, invalidates CloudFront, then requires HTTP 200 with HTML at the public homepage before pruning. `--verify-homepage` also requires a byte-for-byte match to the export's index. Pruning removes S3 keys absent from the export and its aliases; defaults preserve `*.md` and root `llms.txt`. Repeat `--preserve PATTERN` to replace the default list. If keys are deleted, a second invalidation follows.

## GitHub Actions and provisioning

Follow the site repository's approval rules for production provisioning and workflow dispatches, including dry-runs where required.

1. Preview `pnpm exec static-site-deploy setup --site acme/site --provision --reviewer LOGIN --account-id ACCOUNT_ID --role-name ROLE_NAME --dry-run`. The plan illustrates a fresh setup without contacting AWS or GitHub. To apply with authorization, use AWS CLI v2 with IAM setup permissions, authenticated `gh` with repository admin access, Bash, and `jq`.
2. Use a dedicated IAM role per site. Setup restricts permissions to that site's bucket and distribution, and binds trust to audience `sts.amazonaws.com` and the repository's `production` environment on `refs/heads/main`, for example `repo:acme/site:environment:production:ref:refs/heads/main`. It preserves immutable subjects where enabled. Check other OIDC integrations first: the subject template is repository-wide.
3. Keep `production` restricted to `main`, with administrator bypass off. Use a required reviewer where supported. If GitHub rejects the reviewer rule because of the plan, supported CLI versions retry without setting a reviewer and warn; the run then does not wait for reviewer approval. Setup verifies that administrator bypass is disabled before changing IAM trust. Keep the human approval requirement even when GitHub cannot enforce it.
4. Define a manual `workflow_dispatch` on `main` with a boolean `dry-run` input defaulting to `true`. Build before assuming the role; only the deploy job targets `production` and needs `id-token: write`. Use the environment variables for the AWS region, targets, homepage, and role ARN. Don't store AWS keys in GitHub. Leave dry-run selected for a preview and turn it off only for an explicitly approved real deploy. Merging does not deploy.
