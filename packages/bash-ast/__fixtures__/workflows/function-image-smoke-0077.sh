cd compute
tsx ../compute/fun/cli/src/generate-standalone.ts --only=${{ matrix.handler }}
tsx ../compute/fun/cli/src/generate-dockerfiles.ts --only=${{ matrix.handler }}
