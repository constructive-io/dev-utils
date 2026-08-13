# --cwd is the platform root the CLI reads handlers and templates from,
# so it is absolute: a path relative to the CLI's own directory moves
# whenever the CLI does.
cd compute/fun/cli
platform="$GITHUB_WORKSPACE/compute"
npx tsx src/index.ts build-image --only=hello --registry=kind.local --tag=latest --cwd="$platform"
npx tsx src/index.ts build-image --only=hello-py --registry=kind.local --tag=latest --cwd="$platform"
npx tsx src/index.ts build-image --only=hello --registry=kind.local --tag=dev --target=dev --cwd="$platform"
