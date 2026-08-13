# The branch may have moved while generation ran; rebase our single
# generated commit onto its tip rather than clobbering someone's push.
# Autostash: generation also touches paths that are deliberately not
# committed here, and any one left dirty aborts the rebase.
git pull --rebase --autostash origin "$BRANCH"

if ! git push origin HEAD:"$BRANCH"; then
  echo "::error::Push refused. The generated output is in the" \
       "regenerated-patch artifact on this run — apply it with" \
       "'gh run download ${{ github.run_id }} -n regenerated-patch" \
       "&& git am regenerate.patch'. To make the push work, set" \
       "Settings -> Actions -> General -> Workflow permissions to" \
       "'Read and write permissions', or add a GH_SUBMODULE_PAT secret" \
       "with contents: write."
  exit 1
fi
