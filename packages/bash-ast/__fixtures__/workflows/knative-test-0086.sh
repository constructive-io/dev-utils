set -euo pipefail

if [ "$IS_PR" != 'true' ]; then
  echo "cluster=true" >> "$GITHUB_OUTPUT"
  echo "::notice::${{ github.event_name }} run — cluster suites always run"
  exit 0
fi

if [ "$LABELLED" = 'true' ]; then
  echo "cluster=true" >> "$GITHUB_OUTPUT"
  echo "::notice::needs-knative label present — cluster suites run"
  exit 0
fi

changed=$(git diff --name-only "origin/${BASE_REF}...HEAD")
echo "Changed files:"; echo "$changed"

plumbing=$(echo "$changed" | grep -vE \
  -e '^compute/system/' \
  -e '^compute/fixtures/' \
  -e '^compute/runtimes/node/' \
  -e '^compute/testkit/' \
  -e '^functions/' \
  -e '^compute/tests/' \
  -e '^compute/docs/' \
  -e '^ui/www/' \
  -e '^fbp/' \
  -e '\.md$' || true)

if [ -n "$plumbing" ]; then
  echo "cluster=true" >> "$GITHUB_OUTPUT"
  echo "::notice::Plumbing changed — cluster suites run"
  echo "$plumbing"
else
  echo "cluster=false" >> "$GITHUB_OUTPUT"
  echo "::notice::Handler/runtime-only change — skipping the cluster suites. Add the 'needs-knative' label to force them."
fi
