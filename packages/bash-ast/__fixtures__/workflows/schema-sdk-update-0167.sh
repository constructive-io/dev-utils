echo "## Schema Update PR Created" >> $GITHUB_STEP_SUMMARY
echo "" >> $GITHUB_STEP_SUMMARY
echo "PR: ${{ steps.create_pr.outputs.pr_url }}" >> $GITHUB_STEP_SUMMARY
