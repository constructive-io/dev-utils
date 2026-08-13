{
  echo "## \`${{ matrix.name }}\` — jit=${{ matrix.jit }} tuned=${{ matrix.tuned }} work_mem=${{ matrix.work_mem }}"
  echo
  echo '```'
  cat bench-results/${{ matrix.name }}/wall.txt 2>/dev/null
  cat runner-info.txt
  echo '```'
  echo
  echo '### Top statements by total_exec_time'
  echo
  echo '```'
  head -13 bench-results/${{ matrix.name }}/pgss_top.csv 2>/dev/null | cut -c1-200
  echo '```'
} >> $GITHUB_STEP_SUMMARY
