cd compute/services/reconciler
pnpm jest --no-coverage --forceExit --verbose --runInBand \
  --shard=${{ matrix.shard }}/${{ strategy.job-total }} \
  --testPathPattern='\.e2e\.test\.ts$' 2>&1
