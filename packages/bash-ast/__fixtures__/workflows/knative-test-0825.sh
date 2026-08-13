set -euo pipefail
if [ "$CLUSTER" != 'true' ]; then
  echo "Cluster suites skipped for this change (label 'needs-knative' to force them)."
  exit 0
fi
echo "knative-e2e result:     $RESULT"
echo "tenant-isolation result: $ISOLATION"
[ "$RESULT" = 'success' ] && [ "$ISOLATION" = 'success' ]
