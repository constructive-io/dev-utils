PATHS='application/constructive sdk/constructive-schema/meta-export-tables.json'
UNTRACKED=$(git ls-files --others --exclude-standard -- $PATHS)
if git diff --quiet -- $PATHS && [ -z "$UNTRACKED" ]; then
  echo 'application/constructive matches its generators.'
  exit 0
fi
echo "::error::application/constructive is out of date. Regenerate it" \
     "on a runner — push a branch named '<your-branch>-regen' (see" \
     "AGENTS.md, 'Regenerate on CI, not locally') and commit the result."
git status --short -- $PATHS
git diff --stat -- $PATHS
exit 1
