cd compute && npx tsx ../compute/fun/cli/src/generate-standalone.ts --packages-only
cd .. && pnpm install --frozen-lockfile --filter @constructive-functions/cli
