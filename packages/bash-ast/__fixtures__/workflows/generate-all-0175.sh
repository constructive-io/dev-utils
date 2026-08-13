# Check introspection output changes (application/constructive/)
APP_UNTRACKED=$(git ls-files --others --exclude-standard application/ | head -20)
if git diff --quiet application/ && [ -z "$APP_UNTRACKED" ]; then
  echo "has_introspection_changes=false" >> $GITHUB_OUTPUT
  echo "No introspection changes detected"
else
  echo "has_introspection_changes=true" >> $GITHUB_OUTPUT
  echo "Introspection changes detected:"
  git diff --stat application/
  if [ -n "$APP_UNTRACKED" ]; then
    echo "New untracked files in application/:"
    echo "$APP_UNTRACKED"
  fi
fi

# Check schema changes
if git diff --quiet sdk/constructive-schema/schemas/; then
  echo "has_schema_changes=false" >> $GITHUB_OUTPUT
  echo "No schema changes detected"
else
  echo "has_schema_changes=true" >> $GITHUB_OUTPUT
  echo "Schema changes detected:"
  git diff --stat sdk/constructive-schema/schemas/
fi

# Check all SDK changes (tracked + untracked)
SDK_UNTRACKED=$(git ls-files --others --exclude-standard sdk/ | head -20)
if git diff --quiet sdk/ && [ -z "$SDK_UNTRACKED" ]; then
  echo "has_sdk_changes=false" >> $GITHUB_OUTPUT
  echo "No SDK changes detected"
else
  echo "has_sdk_changes=true" >> $GITHUB_OUTPUT
  echo "SDK changes detected:"
  git diff --stat sdk/
  if [ -n "$SDK_UNTRACKED" ]; then
    echo "New untracked files in sdk/:"
    echo "$SDK_UNTRACKED"
  fi
fi

# Check .agents/skills changes (codegen generates skill reference docs)
AGENTS_UNTRACKED=$(git ls-files --others --exclude-standard .agents/ | head -20)
if git diff --quiet .agents/ && [ -z "$AGENTS_UNTRACKED" ]; then
  echo "has_agents_changes=false" >> $GITHUB_OUTPUT
  echo "No agents/skills changes detected"
else
  echo "has_agents_changes=true" >> $GITHUB_OUTPUT
  echo "Agents/skills changes detected:"
  git diff --stat .agents/
  if [ -n "$AGENTS_UNTRACKED" ]; then
    echo "New untracked files in .agents/:"
    echo "$AGENTS_UNTRACKED"
  fi
fi

# Overall: any changes in sdk/ OR application/ OR .agents/?
SDK_CHANGED="false"
APP_CHANGED="false"
AGENTS_CHANGED="false"
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
  echo "has_any_changes=true" >> $GITHUB_OUTPUT
  echo ""
  echo "=== SUMMARY ==="
  echo "Introspection changed: $APP_CHANGED"
  echo "SDK changed: $SDK_CHANGED"
  echo "Agents changed: $AGENTS_CHANGED"
else
  echo "has_any_changes=false" >> $GITHUB_OUTPUT
  echo "All generated outputs are up-to-date."
fi
