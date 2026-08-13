mode="${{ steps.scope.outputs.mode }}"
base="${{ steps.scope.outputs.base }}"
# Affected needs a resolvable base to diff against. Until `develop`
# exists (or if a base branch is ever renamed/deleted) fall back to
# the full matrix rather than failing or silently diffing everything.
if [ "$mode" = affected ] && ! git rev-parse --verify --quiet "$base" >/dev/null; then
  echo "::warning::affected base '$base' not found — running the full matrix"
  mode=full
fi
if [ "$mode" = affected ]; then
  matrix=$(node ci/shard-plan.cjs --affected --base "$base" --json)
else
  matrix=$(node ci/shard-plan.cjs --json)
fi
echo "matrix=$matrix" >> "$GITHUB_OUTPUT"
echo "$matrix" | node -e 'const m=JSON.parse(require("fs").readFileSync(0,"utf8"));console.error(`${m.length} shard(s) selected`)'
