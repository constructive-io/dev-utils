ci/bench-generate.sh \
  "${{ matrix.name }}" \
  "${{ matrix.jit }}" \
  "${{ matrix.tuned }}" \
  "${{ matrix.work_mem }}"
