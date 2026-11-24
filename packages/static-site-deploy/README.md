# Static site deploy

`@constructive-io/static-site-deploy` deploys an existing static export to a dedicated S3 bucket behind CloudFront. It does not provide hosting, build the site, or change a site's DNS.

## Local deploy

From a site repo with AWS CLI, curl, and the package installed:

```sh
pnpm exec static-site-deploy setup --site OWNER/REPO
pnpm build
pnpm exec static-site-deploy deploy --site OWNER/REPO --dir out
```

The setup asks only for missing settings. A local deploy from an interactive terminal also asks for missing settings, saves the answers, and continues. AWS credentials stay in AWS CLI configuration; the per-site appstash store contains only the bucket, distribution, homepage URL, region, and profile name. No `.env` file is needed. Use a named AWS profile if you deploy from multiple accounts.

Shell variables take precedence over saved values: `AWS_S3_BUCKET`, `AWS_CLOUDFRONT_DISTRIBUTION_ID`, `SITE_URL` (HTTPS), `AWS_REGION`, and `AWS_PROFILE`. Provisioning is optional and has a separate confirmation; automatic prompting during a deploy never provisions anything. To validate inputs without building or deploying, use `static-site-deploy check --site OWNER/REPO`.

Deploy uploads the export, refreshes extensionless aliases, and waits for CloudFront invalidation. Only after the public homepage returns HTTP 200 with HTML and the bucket listing is complete does it prune keys absent from the export and its aliases, including stale pages and old assets. A final invalidation follows deletion. Use a dedicated bucket, and serialize deployments, including local ones.

By default, existing Markdown files (`*.md`) and the root `llms.txt` are preserved when absent from the export. Repeat `--preserve PATTERN` to replace that list with a site-specific list. Patterns match full keys, with `*` matching any number of characters, including slashes.

Per-site deploy options:

- `--dry-run` lists planned uploads, alias copies, and stale-key deletions. It needs read-only access to list the bucket, but does not upload, delete, invalidate CloudFront, check the homepage, or save answers to prompts.
- `--trailing-slash-aliases` adds `foo/` alongside `foo` for `foo/index.html`. The default creates only `foo`; neither mode creates an alias for the root `index.html`.
- `--verify-homepage` also requires the HTTP 200 HTML response body to match the export's `index.html` byte for byte before pruning. Use it when CloudFront serves the export without modifying the response body.

## GitHub Actions and AWS OIDC

Run setup with AWS CLI v2 signed into the account that owns the bucket and distribution, `gh` signed in as a repository administrator, and `jq` and Bash installed. The AWS identity needs IAM permissions to manage the GitHub OIDC provider, the dedicated role, and its inline policy.

```sh
pnpm exec static-site-deploy setup --site OWNER/REPO --provision --reviewer LOGIN \
  --account-id 000000000000 --role-name example-site-deploy --dry-run
```

Replace the placeholders. `--dry-run` prints a fresh-setup plan and does not change AWS, GitHub, or stored values. Remove it to apply; with inputs supplied through variables, `--provision --yes` also supports unattended provisioning. Use a separate role for each site. Sites in the same AWS account reuse the GitHub OIDC provider, not the role or credentials. Do not share or store AWS access keys in GitHub or in appstash.

Provisioning creates or reuses the IAM provider, sets an exact AWS audience and subject for the repository's `production` environment and `refs/heads/main` (or `--branch`), and restricts permissions to the selected S3 bucket and CloudFront distribution. It sets the GitHub repository-wide OIDC template to `["repo","context","ref"]`; check for other OIDC integrations before applying. Repositories that use immutable OIDC subjects keep them, and the role trusts the subject GitHub reports, such as `repo:OWNER@OWNER-ID/REPO@REPO-ID:environment:production:ref:refs/heads/main`. It sets `production` environment variables for the deployment targets, region, homepage, and role ARN. It never dispatches a deployment.

If asked, turn off **Allow administrators to bypass configured protection rules** in the GitHub `production` environment, save, and rerun setup. GitHub's public REST API cannot write this toggle. The environment requires the configured reviewer and permits only the configured branch. If the environment is deleted, revoke AWS role trust until the environment and its protections are restored.

Use `workflow_dispatch` to start manually. Build in an unprivileged job, then use a separate `production` job with `contents: read` and `id-token: write` and the build artifact. In that job, configure AWS OIDC credentials with `aws-actions/configure-aws-credentials` using `vars.AWS_DEPLOY_ROLE_ARN` and `vars.AWS_REGION`. Pass `AWS_S3_BUCKET`, `AWS_CLOUDFRONT_DISTRIBUTION_ID`, `SITE_URL`, and `AWS_REGION` from `vars` to `static-site-deploy deploy`. On GitHub Actions, the repo is inferred from `GITHUB_REPOSITORY`. CI never reads the local store or prompts; missing or invalid configuration fails before uploads.
