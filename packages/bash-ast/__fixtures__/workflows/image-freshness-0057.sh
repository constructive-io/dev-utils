cd compute/fun/k8s
npx tsx scripts/check-image-freshness.ts --write | tee "$GITHUB_STEP_SUMMARY"
