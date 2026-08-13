set -euo pipefail
plan=$([ "$ALL" = 'true' ] \
  && pnpm exec tsx ci/functions/plan.ts --all --images \
  || pnpm exec tsx ci/functions/plan.ts --images)
images=$(echo "$plan" | jq -c '.images')
if [ -n "$ONLY" ]; then
  images=$(jq -c --arg only "$ONLY" \
    '[.[] | select(.name == $only or .dir == "functions/" + $only)]' <<<"$images")
fi
echo "matrix=$images" >> "$GITHUB_OUTPUT"
echo "any=$([ "$images" = '[]' ] && echo false || echo true)" >> "$GITHUB_OUTPUT"
