# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.8.0](https://github.com/hyperweb-io/dev-utils/compare/find-and-require-package-json@0.6.8...find-and-require-package-json@0.8.0) (2025-12-13)

### Bug Fixes

- **find-and-require-package-json:** require callerDir parameter to find correct package.json ([ba4133f](https://github.com/hyperweb-io/dev-utils/commit/ba4133f7671bf799de6259a53c0042fabf1b07dd))

### BREAKING CHANGES

- **find-and-require-package-json:** findAndRequirePackageJson() now requires a callerDir parameter.

Previously, the function used \_\_dirname internally which always pointed to the
find-and-require-package-json package's own directory, causing it to return
the wrong package.json when called from other packages.

Now callers must pass their own \_\_dirname (CJS) or
dirname(fileURLToPath(import.meta.url)) (ESM) to find the correct package.json.

Fixes CI failures in constructive repo where plugins were incorrectly
identified as 'find-and-require-package-json@0.6.8' instead of their actual names.

Co-Authored-By: Dan Lynch <pyramation@gmail.com>

## 0.6.8 (2025-12-13)

**Note:** Version bump only for package find-and-require-package-json

## [0.6.7](https://github.com/hyperweb-io/dev-utils/compare/@interweb/find-pkg@0.6.6...@interweb/find-pkg@0.6.7) (2025-11-28)

**Note:** Version bump only for package @interweb/find-pkg

## [0.6.6](https://github.com/hyperweb-io/dev-utils/compare/@interweb/find-pkg@0.6.5...@interweb/find-pkg@0.6.6) (2025-11-26)

**Note:** Version bump only for package @interweb/find-pkg

## [0.6.5](https://github.com/hyperweb-io/dev-utils/compare/@interweb/find-pkg@0.6.4...@interweb/find-pkg@0.6.5) (2025-11-24)

**Note:** Version bump only for package @interweb/find-pkg

## [0.6.4](https://github.com/hyperweb-io/dev-utils/compare/@interweb/find-pkg@0.6.3...@interweb/find-pkg@0.6.4) (2025-11-24)

**Note:** Version bump only for package @interweb/find-pkg

## [0.6.3](https://github.com/hyperweb-io/dev-utils/compare/@interweb/find-pkg@0.6.2...@interweb/find-pkg@0.6.3) (2025-11-23)

**Note:** Version bump only for package @interweb/find-pkg

## [0.6.2](https://github.com/hyperweb-io/dev-utils/compare/@interweb/find-pkg@0.6.1...@interweb/find-pkg@0.6.2) (2025-11-23)

**Note:** Version bump only for package @interweb/find-pkg

## [0.6.1](https://github.com/hyperweb-io/dev-utils/compare/@interweb/find-pkg@0.6.0...@interweb/find-pkg@0.6.1) (2025-11-23)

**Note:** Version bump only for package @interweb/find-pkg

# [0.6.0](https://github.com/hyperweb-io/dev-utils/compare/@interweb/find-pkg@0.5.0...@interweb/find-pkg@0.6.0) (2025-11-23)

**Note:** Version bump only for package @interweb/find-pkg
