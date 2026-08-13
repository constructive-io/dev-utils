# Report-only for now — add `--fail-on-grade B` to gate merges, and
# `--fail-on-new-boundaries` to gate on new call-graph trust
# boundaries (diffed against the committed .safegres-callgraph.json;
# re-baseline with `safegres audit --write-baseline` to accept).
# Job summary: score + counts + call-graph stats + baseline diff.
# Full report goes to the build log.
safegres audit --database constructivedb --summary --baseline .safegres-callgraph.json | tee summary.txt
safegres audit --database constructivedb --no-color --call-graph
{
  echo '## Safegres security audit'
  echo '```'
  cat summary.txt
  echo '```'
} >> "$GITHUB_STEP_SUMMARY"
