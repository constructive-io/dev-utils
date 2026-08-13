UNTRACKED=$(git ls-files --others --exclude-standard platform-schema)
if git diff --quiet platform-schema && [ -z "$UNTRACKED" ]; then
  echo "No drift in platform-schema"
else
  echo "::error::published platform modules are out of date. Run 'pnpm run generate:platform' and commit the result."
  git status --short platform-schema
  git diff --stat platform-schema
  exit 1
fi
