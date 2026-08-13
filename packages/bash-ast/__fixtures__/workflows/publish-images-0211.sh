set -euo pipefail
echo "plan=$PLAN publish=$PUBLISH (any=$ANY)"
[ "$PLAN" = 'success' ]
if [ "$ANY" = 'true' ]; then
  [ "$PUBLISH" = 'success' ]
fi
