set -euo pipefail
plan=$([ "$ALL" = 'true' ] \
  && pnpm exec tsx ci/functions/plan.ts --all \
  || pnpm exec tsx ci/functions/plan.ts)
features=$(echo "$plan" | jq -c '.features')
echo "features=$features" >> "$GITHUB_OUTPUT"
echo "any=$([ "$features" = '[]' ] && echo false || echo true)" >> "$GITHUB_OUTPUT"
