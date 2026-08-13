# -R explicitly: the workspace is unpacked from an artifact, so there
# is no .git for gh to infer the repo from.
run_id=$(gh run list -R "$GITHUB_REPOSITORY" --workflow run-tests.yaml \
  --branch "$BASE" --status success --limit 1 --json databaseId -q '.[0].databaseId')
[ -n "$run_id" ] || { echo "no successful $BASE run to compare against"; exit 0; }
gh run download "$run_id" -R "$GITHUB_REPOSITORY" -n safegres-reports -D previous
echo "SAFEGRES_COMPARE=$PWD/previous/safegres.json" >> "$GITHUB_ENV"
echo "SAFEGRES_COMPARE_REF=$BASE" >> "$GITHUB_ENV"
