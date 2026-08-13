found=$(pnpm exec jest --listTests "${{ matrix.test_pattern }}" 2>/dev/null | grep -c '\.test\.ts$')
echo "selected $found file(s), expected ${{ matrix.expected_files }}"
if [ "$found" -ne "${{ matrix.expected_files }}" ]; then
  echo "::error::shard ${{ matrix.shard_name }} selected $found files but expects ${{ matrix.expected_files }}; check 'node ci/shard-plan.cjs'"
  exit 1
fi
