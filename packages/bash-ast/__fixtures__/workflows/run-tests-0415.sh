if [ -n "${{ matrix.batch_packages }}" ]; then
  # Batched lightweight packages — run sequentially
  for pkg in ${{ matrix.batch_packages }}; do
    echo "::group::Testing $pkg"
    (cd ./$pkg && pnpm exec jest --maxWorkers="$JEST_MAX_WORKERS")
    echo "::endgroup::"
  done
else
  cd ./${{ matrix.package }}
  if [ -n "${{ matrix.test_pattern }}" ]; then
    if [ -n "${{ matrix.test_name_pattern }}" ]; then
      # Use `pnpm exec jest` (not `pnpm test`) so pnpm doesn't inject a
      # literal `--` into the jest argv. With `--` injected, Jest treats
      # every subsequent token (including `-t` and its value) as a
      # positional testPathPattern, which silently disables the filter.
      pnpm exec jest --maxWorkers="$JEST_MAX_WORKERS" "${{ matrix.test_pattern }}" -t "${{ matrix.test_name_pattern }}"
    else
      pnpm exec jest --maxWorkers="$JEST_MAX_WORKERS" "${{ matrix.test_pattern }}"
    fi
  else
    pnpm exec jest --maxWorkers="$JEST_MAX_WORKERS"
  fi
fi
