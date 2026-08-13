if [ "$EVENT_NAME" = 'push' ]; then
  branch="$REF_NAME"
  case "$branch" in
    *-regen-all)      constructive=true;  platform=true  ;;
    *-regen-platform) constructive=false; platform=true  ;;
    *-regen)          constructive=true;  platform=false ;;
    *)
      echo "::error::$branch ends in no known -regen suffix."
      exit 1
      ;;
  esac
else
  branch="$INPUT_BRANCH"
  constructive="$INPUT_CONSTRUCTIVE"
  platform="$INPUT_PLATFORM"
  if [ "$constructive" != 'true' ] && [ "$platform" != 'true' ]; then
    echo "::error::Tick at least one of generate_constructive / generate_platform."
    exit 1
  fi
fi

echo "branch=$branch" >> "$GITHUB_OUTPUT"
echo "constructive=$constructive" >> "$GITHUB_OUTPUT"
echo "platform=$platform" >> "$GITHUB_OUTPUT"
echo "Regenerating $branch — constructive=$constructive platform=$platform"
