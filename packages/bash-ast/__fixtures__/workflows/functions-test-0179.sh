set -euo pipefail
echo "plan=$PLAN features=$FEATURES (any=$ANY)"
[ "$PLAN" = 'success' ]
if [ "$ANY" = 'true' ]; then
  [ "$FEATURES" = 'success' ]
fi
