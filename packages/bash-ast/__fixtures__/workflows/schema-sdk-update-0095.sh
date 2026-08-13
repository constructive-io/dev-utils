SDK_CHANGED="false"
APP_CHANGED="false"
AGENTS_CHANGED="false"
SDK_UNTRACKED=$(git ls-files --others --exclude-standard sdk/ | head -5)
APP_UNTRACKED=$(git ls-files --others --exclude-standard application/ | head -5)
AGENTS_UNTRACKED=$(git ls-files --others --exclude-standard .agents/ | head -5)
if ! git diff --quiet sdk/ || [ -n "$SDK_UNTRACKED" ]; then
  SDK_CHANGED="true"
fi
if ! git diff --quiet application/ || [ -n "$APP_UNTRACKED" ]; then
  APP_CHANGED="true"
fi
if ! git diff --quiet .agents/ || [ -n "$AGENTS_UNTRACKED" ]; then
  AGENTS_CHANGED="true"
fi
if [ "$SDK_CHANGED" = "true" ] || [ "$APP_CHANGED" = "true" ] || [ "$AGENTS_CHANGED" = "true" ]; then
  echo "has_changes=true" >> $GITHUB_OUTPUT
else
  echo "has_changes=false" >> $GITHUB_OUTPUT
fi
