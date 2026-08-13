mode=full
base=origin/develop
case "${{ github.event_name }}" in
  workflow_dispatch)
    mode="${{ github.event.inputs.mode }}"
    ;;
  pull_request)
    base_ref="${{ github.event.pull_request.base.ref }}"
    base="origin/$base_ref"
    [ "$base_ref" = "main" ] && mode=full || mode=affected
    ;;
esac
echo "mode=$mode" >> "$GITHUB_OUTPUT"
echo "base=$base" >> "$GITHUB_OUTPUT"
echo "test scope: mode=$mode base=$base"
