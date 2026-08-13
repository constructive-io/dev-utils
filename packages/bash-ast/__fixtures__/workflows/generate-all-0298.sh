echo "## Generation Results" >> $GITHUB_STEP_SUMMARY
echo "" >> $GITHUB_STEP_SUMMARY
echo "Source: \`${{ steps.refs.outputs.ref_sha }}\` (ref: \`${{ inputs.ref || 'main' }}\`)" >> $GITHUB_STEP_SUMMARY
echo "" >> $GITHUB_STEP_SUMMARY
echo "| Output | Changed |" >> $GITHUB_STEP_SUMMARY
echo "|--------|---------|" >> $GITHUB_STEP_SUMMARY
echo "| application/constructive/ (introspection) | ${{ steps.check_changes.outputs.has_introspection_changes }} |" >> $GITHUB_STEP_SUMMARY
echo "| sdk/constructive-schema/ (schemas) | ${{ steps.check_changes.outputs.has_schema_changes }} |" >> $GITHUB_STEP_SUMMARY
echo "| sdk/ (SDKs + CLI) | ${{ steps.check_changes.outputs.has_sdk_changes }} |" >> $GITHUB_STEP_SUMMARY
echo "| .agents/ (skills) | ${{ steps.check_changes.outputs.has_agents_changes }} |" >> $GITHUB_STEP_SUMMARY
