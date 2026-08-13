cd compute/fun/k8s
# Named explicitly, so a suite that skipped itself surfaces as "no
# tests found" rather than as a green job that asserted nothing.
pnpm jest --no-coverage --forceExit --verbose \
  --testPathPattern='tenant-isolation\.cluster\.test\.ts$'
