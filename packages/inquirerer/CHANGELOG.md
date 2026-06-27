# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [4.9.0](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.8.1...inquirerer@4.9.0) (2026-06-27)

### Features

- **inquirerer:** add prompt timeout for non-TTY environments ([fc7fc51](https://github.com/constructive-io/dev-utils/commit/fc7fc515391dc8c48a98a35aedeb01a4770ec9c0))
- make timeout resettable — resets on every user interaction ([f75330f](https://github.com/constructive-io/dev-utils/commit/f75330f045abe3b94bb441a2cd2286a17bb335e1))

## [4.8.1](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.8.0...inquirerer@4.8.1) (2026-04-26)

### Bug Fixes

- **inquirerer:** defer process.stdin/stdout access in defaultCLIOptions ([79eedf7](https://github.com/constructive-io/dev-utils/commit/79eedf79fe74654d26555d179b2f1403c33f3c27))

# [4.8.0](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.7.0...inquirerer@4.8.0) (2026-04-26)

### Features

- **inquirerer-test:** add runCli subprocess helper + Testing docs in inquirerer ([fc5b836](https://github.com/constructive-io/dev-utils/commit/fc5b836cbf120a4e436facc8b70e965a7f92bd6f))

# [4.7.0](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.6.0...inquirerer@4.7.0) (2026-03-05)

### Features

- **inquirerer:** add boolean alias and json question types ([ea6fe03](https://github.com/constructive-io/dev-utils/commit/ea6fe0353b15c17cbc2b81c24de62129b4276f5d))

# [4.6.0](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.5.2...inquirerer@4.6.0) (2026-03-05)

### Features

- **inquirerer:** add skipPrompt flag to skip prompting for optional fields ([681331d](https://github.com/constructive-io/dev-utils/commit/681331d617eb617a69be918161363dad9fc22f72))

## [4.5.2](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.5.1...inquirerer@4.5.2) (2026-03-03)

### Bug Fixes

- prevent keypress memory leak with multiple Inquirerer instances ([d8812a1](https://github.com/constructive-io/dev-utils/commit/d8812a1853deade38e7b7e8bbae857cf6933370c))

## [4.5.1](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.5.0...inquirerer@4.5.1) (2026-01-29)

**Note:** Version bump only for package inquirerer

# [4.5.0](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.4.0...inquirerer@4.5.0) (2026-01-24)

### Features

- **inquirerer:** add password input type with masked display ([fc476f1](https://github.com/constructive-io/dev-utils/commit/fc476f19359ee342788f1654ef8614f40f208e0d))

# [4.4.0](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.3.1...inquirerer@4.4.0) (2026-01-20)

### Features

- **inquirerer:** add core CLI utilities and re-exports ([f071c62](https://github.com/constructive-io/dev-utils/commit/f071c628d1ca2fb5d4e9ed8687c0fe5f3bfb5cc6))
- **inquirerer:** add package helpers and update @inquirerer/utils ([c087ac8](https://github.com/constructive-io/dev-utils/commit/c087ac87bde92d6bb14c7f231647fe28ee73bc62))
- **inquirerer:** add parseArgv helper and tests ([9050181](https://github.com/constructive-io/dev-utils/commit/9050181c13bd7c14a7e97b5e151b59cf20c422a6))

## [4.3.1](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.3.0...inquirerer@4.3.1) (2026-01-07)

**Note:** Version bump only for package inquirerer

# [4.3.0](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.2.1...inquirerer@4.3.0) (2026-01-05)

### Bug Fixes

- **inquirerer:** enforce viewport height invariant ([28ef8ac](https://github.com/constructive-io/dev-utils/commit/28ef8ac8d15736227550ffb943f01743a22ca7b5))
- **inquirerer:** fix cursor positioning for viewport rendering ([6c67f5e](https://github.com/constructive-io/dev-utils/commit/6c67f5e7c25fc638baec0553f77ab9b5fdc408f1))
- **inquirerer:** let input area grow freely like Claude Code ([bbf65a7](https://github.com/constructive-io/dev-utils/commit/bbf65a70f9d6d8f55f64661f12862eea9c7271ff))
- **inquirerer:** limit multiline input height with scrolling ([bf10167](https://github.com/constructive-io/dev-utils/commit/bf10167c47c467b6ffb9f74db89193d27366c286))
- **inquirerer:** prevent double rendering during streaming ([a2a92f2](https://github.com/constructive-io/dev-utils/commit/a2a92f2c29b8f79e4c876b397f06316c5ef60167))
- **inquirerer:** prevent viewport scroll and soft-wrap issues ([fe56bad](https://github.com/constructive-io/dev-utils/commit/fe56bad045ceedafc40ba815e45d4fa74c2427bd))
- **inquirerer:** proper viewport layout with input windowing ([c2345cc](https://github.com/constructive-io/dev-utils/commit/c2345cc88cc6441329807a62dbfcb6f3d23be5bc))
- **inquirerer:** simplify viewport rendering with cursor positioning ([754ec24](https://github.com/constructive-io/dev-utils/commit/754ec240ceed087bf2a18be523c280158716f3f1))
- **inquirerer:** use fixed max height for multiline input layout ([30bf119](https://github.com/constructive-io/dev-utils/commit/30bf11924415237168bf6ddc0cc7921932ccb134))
- **inquirerer:** use inverse video cursor and add Ctrl+J for newlines ([42a3a3e](https://github.com/constructive-io/dev-utils/commit/42a3a3ea8bb25dba2d3071fe02ff17489e3e054c))

### Features

- **inquirerer:** add AICodeUI with diff-based viewport rendering ([6afd415](https://github.com/constructive-io/dev-utils/commit/6afd415e981a4fc241c78b51b554a779ade04805))
- **inquirerer:** add Claude Code-style UI with welcome box and conversation markers ([89d1f54](https://github.com/constructive-io/dev-utils/commit/89d1f54b89f6a723b98e03dab616ecc8e8a0045e))
- **inquirerer:** add readline-style keybindings and multiline input support ([80eeaab](https://github.com/constructive-io/dev-utils/commit/80eeaabe06e14f883e988d354874a0d64fbc7199))

## [4.2.1](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.2.0...inquirerer@4.2.1) (2025-12-27)

**Note:** Version bump only for package inquirerer

# [4.2.0](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.1.2...inquirerer@4.2.0) (2025-12-27)

### Features

- **inquirerer:** add engine-based prompt implementations ([7bdc066](https://github.com/constructive-io/dev-utils/commit/7bdc06617271ed9c1795c13c97eec66ff8ae2211))
- **inquirerer:** add event-driven UI engine for custom prompts ([a298407](https://github.com/constructive-io/dev-utils/commit/a2984078be1118b49551bb69facf9b7131329d72))

## [4.1.2](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.1.1...inquirerer@4.1.2) (2025-12-27)

### Bug Fixes

- **inquirerer:** handle empty filteredOptions in checkbox and autocomplete ([7d4b32c](https://github.com/constructive-io/dev-utils/commit/7d4b32c61ebf8e72fc56f4c24cedaf0f6b40eafb))

## [4.1.1](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.1.0...inquirerer@4.1.1) (2025-12-27)

**Note:** Version bump only for package inquirerer

# [4.1.0](https://github.com/constructive-io/dev-utils/compare/inquirerer@4.0.0...inquirerer@4.1.0) (2025-12-27)

### Features

- **inquirerer:** add alias support for questions ([29444f2](https://github.com/constructive-io/dev-utils/commit/29444f229a37f02a4501d3af48208d1ce015f376))

# [4.0.0](https://github.com/constructive-io/dev-utils/compare/inquirerer@3.0.1...inquirerer@4.0.0) (2025-12-27)

### Bug Fixes

- update remaining Prompter references in comments to Inquirerer ([24f3f1a](https://github.com/constructive-io/dev-utils/commit/24f3f1a3798645043848c165d05ceacef55c38ab))
- update remaining test files to use Inquirerer instead of Prompter ([6af0a98](https://github.com/constructive-io/dev-utils/commit/6af0a98b9aa45aa3913e224be092c30d90bb35a9))
- update snapshot files to use Inquirerer instead of Prompter ([3fcf86f](https://github.com/constructive-io/dev-utils/commit/3fcf86ff1e760ca5655973f15ef6f9449abefb00))
- update test files to use Inquirerer instead of Prompter ([5e4a334](https://github.com/constructive-io/dev-utils/commit/5e4a334e829b1d997bf628a28ac78d0724ebe0d3))

### Features

- restructure packages - inquirerer for CLI prompts, genomic for scaffolds ([b4dd61a](https://github.com/constructive-io/dev-utils/commit/b4dd61a7ff5fb0d75366ccc4034829896d2181f8))

### BREAKING CHANGES

- Package names have been swapped

* inquirerer is now the CLI prompt library (was genomic)
* genomic is now the scaffolding utility (was @genomic/scaffolds)
* @inquirerer/utils replaces @genomic/utils

## [4.0.2](https://github.com/constructive-io/dev-utils/compare/genomic@4.0.1...genomic@4.0.2) (2025-12-27)

**Note:** Version bump only for package genomic

## [4.0.1](https://github.com/constructive-io/dev-utils/compare/genomic@4.0.0...genomic@4.0.1) (2025-12-27)

**Note:** Version bump only for package genomic

# 4.0.0 (2025-12-26)

### Bug Fixes

- remove exports field from genomic package.json ([41f82f2](https://github.com/constructive-io/dev-utils/commit/41f82f2003a79befb28cbe5cfaeb3a5c4a1b0411))
- update test snapshots and utils package test script ([8910308](https://github.com/constructive-io/dev-utils/commit/8910308a8566f0cff6731ff0ce68819c3806e8bf))

### Features

- rename inquirerer to genomic and create [@genomic](https://github.com/genomic) packages ([369f728](https://github.com/constructive-io/dev-utils/commit/369f728f26535956bb1d8ba6ef633e727a5bcf08))

### BREAKING CHANGES

- Package names have changed:

* inquirerer -> genomic
* create-gen-app -> @genomic/scaffolds

# [2.4.0](https://github.com/constructive-io/dev-utils/compare/genomic@2.3.2...genomic@2.4.0) (2025-12-25)

### Bug Fixes

- **genomic:** strip consumed positionals from argv.\_ and respect mutateArgs ([9341f86](https://github.com/constructive-io/dev-utils/commit/9341f860479b473f95af7daa482340b868774859))

### Features

- **genomic:** add positional arguments support with \_ property ([227409d](https://github.com/constructive-io/dev-utils/commit/227409df232f7efc520dfc761e901bb5e2eb5979))

## [2.3.2](https://github.com/constructive-io/dev-utils/compare/genomic@2.3.1...genomic@2.3.2) (2025-12-25)

### Reverts

- **genomic:** simplify keypress to per-instance model ([36a4697](https://github.com/constructive-io/dev-utils/commit/36a469754329e8fbc2adbd86915fd73e1c4284f7))

## [2.3.1](https://github.com/constructive-io/dev-utils/compare/genomic@2.3.0...genomic@2.3.1) (2025-12-25)

### Bug Fixes

- **genomic:** implement stack-based ownership for keypress handling ([1c57b2f](https://github.com/constructive-io/dev-utils/commit/1c57b2fa2a794af7f3f86dc713904c5a6a4970da))

# [2.3.0](https://github.com/constructive-io/dev-utils/compare/genomic@2.2.1...genomic@2.3.0) (2025-12-25)

### Bug Fixes

- **genomic:** remove redundant $ input indicator, keep only > ([4b1b739](https://github.com/constructive-io/dev-utils/commit/4b1b7394b60ef2fea3cc67b885b92ddd52f01270))

### Features

- **genomic:** add compact prompt style as default ([b757265](https://github.com/constructive-io/dev-utils/commit/b757265365b5f5e2541b49cec31f8d141abbe044))

## [2.2.1](https://github.com/constructive-io/dev-utils/compare/genomic@2.2.0...genomic@2.2.1) (2025-12-25)

### Bug Fixes

- **genomic:** prevent keypress event duplication with multiple instances ([d15a82a](https://github.com/constructive-io/dev-utils/commit/d15a82aac897e08c45ac1a350d746290d2360319))

# [2.2.0](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.14...genomic@2.2.0) (2025-12-21)

### Features

- **genomic:** add optionsFrom resolver support for dynamic options ([5eaf31c](https://github.com/constructive-io/dev-utils/commit/5eaf31c7ab33400195bda83c94e434e6a0f9af1c))

## [2.1.14](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.13...genomic@2.1.14) (2025-12-17)

**Note:** Version bump only for package genomic

## [2.1.13](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.12...genomic@2.1.13) (2025-12-14)

**Note:** Version bump only for package genomic

## [2.1.12](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.11...genomic@2.1.12) (2025-12-14)

**Note:** Version bump only for package genomic

## [2.1.11](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.10...genomic@2.1.11) (2025-12-13)

### Bug Fixes

- **genomic:** pass \_\_dirname to findAndRequirePackageJson ([21d32d1](https://github.com/constructive-io/dev-utils/commit/21d32d1ed58474bca3ce55ab098bf47340bae14d))

## [2.1.10](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.9...genomic@2.1.10) (2025-12-13)

**Note:** Version bump only for package genomic

## [2.1.9](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.8...genomic@2.1.9) (2025-11-28)

**Note:** Version bump only for package genomic

## [2.1.8](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.7...genomic@2.1.8) (2025-11-26)

**Note:** Version bump only for package genomic

## [2.1.7](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.6...genomic@2.1.7) (2025-11-24)

**Note:** Version bump only for package genomic

## [2.1.6](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.5...genomic@2.1.6) (2025-11-24)

**Note:** Version bump only for package genomic

## [2.1.5](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.4...genomic@2.1.5) (2025-11-24)

**Note:** Version bump only for package genomic

## [2.1.4](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.3...genomic@2.1.4) (2025-11-24)

**Note:** Version bump only for package genomic

## [2.1.3](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.2...genomic@2.1.3) (2025-11-24)

**Note:** Version bump only for package genomic

## [2.1.2](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.1...genomic@2.1.2) (2025-11-24)

**Note:** Version bump only for package genomic

## [2.1.1](https://github.com/constructive-io/dev-utils/compare/genomic@2.1.0...genomic@2.1.1) (2025-11-23)

**Note:** Version bump only for package genomic

# [2.1.0](https://github.com/pyramation/genomic/compare/genomic@2.0.8...genomic@2.1.0) (2025-11-16)

**Note:** Version bump only for package genomic

## [2.0.8](https://github.com/pyramation/genomic/compare/genomic@2.0.7...genomic@2.0.8) (2025-05-25)

**Note:** Version bump only for package genomic

## [2.0.7](https://github.com/pyramation/genomic/compare/genomic@2.0.6...genomic@2.0.7) (2025-05-22)

**Note:** Version bump only for package genomic

## [2.0.6](https://github.com/pyramation/genomic/compare/genomic@2.0.5...genomic@2.0.6) (2025-05-14)

**Note:** Version bump only for package genomic

## [2.0.5](https://github.com/pyramation/genomic/compare/genomic@2.0.4...genomic@2.0.5) (2025-05-14)

**Note:** Version bump only for package genomic

## [2.0.4](https://github.com/pyramation/genomic/compare/genomic@2.0.3...genomic@2.0.4) (2025-05-14)

**Note:** Version bump only for package genomic

## [2.0.3](https://github.com/pyramation/genomic/compare/genomic@2.0.2...genomic@2.0.3) (2025-05-14)

**Note:** Version bump only for package genomic

## [2.0.2](https://github.com/pyramation/genomic/compare/genomic@2.0.1...genomic@2.0.2) (2025-05-13)

**Note:** Version bump only for package genomic

## [2.0.1](https://github.com/pyramation/genomic/compare/genomic@2.0.0...genomic@2.0.1) (2025-05-13)

**Note:** Version bump only for package genomic

# [2.0.0](https://github.com/pyramation/genomic/compare/genomic@1.9.1...genomic@2.0.0) (2025-05-13)

**Note:** Version bump only for package genomic

## [1.9.1](https://github.com/pyramation/genomic/compare/genomic@1.9.0...genomic@1.9.1) (2025-05-09)

**Note:** Version bump only for package genomic

# [1.9.0](https://github.com/pyramation/genomic/compare/genomic@1.8.0...genomic@1.9.0) (2024-04-30)

**Note:** Version bump only for package genomic

# [1.8.0](https://github.com/pyramation/genomic/compare/genomic@1.7.0...genomic@1.8.0) (2024-04-24)

**Note:** Version bump only for package genomic

# [1.7.0](https://github.com/pyramation/genomic/compare/genomic@1.6.1...genomic@1.7.0) (2024-04-24)

**Note:** Version bump only for package genomic

## [1.6.1](https://github.com/pyramation/genomic/compare/genomic@1.6.0...genomic@1.6.1) (2024-04-22)

**Note:** Version bump only for package genomic

# [1.6.0](https://github.com/pyramation/genomic/compare/genomic@1.5.0...genomic@1.6.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [1.5.0](https://github.com/pyramation/genomic/compare/genomic@1.4.0...genomic@1.5.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [1.4.0](https://github.com/pyramation/genomic/compare/genomic@1.3.0...genomic@1.4.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [1.3.0](https://github.com/pyramation/genomic/compare/genomic@1.2.0...genomic@1.3.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [1.2.0](https://github.com/pyramation/genomic/compare/genomic@1.1.0...genomic@1.2.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [1.1.0](https://github.com/pyramation/genomic/compare/genomic@1.0.0...genomic@1.1.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [1.0.0](https://github.com/pyramation/genomic/compare/genomic@0.12.0...genomic@1.0.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [0.12.0](https://github.com/pyramation/genomic/compare/genomic@0.11.0...genomic@0.12.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [0.11.0](https://github.com/pyramation/genomic/compare/genomic@0.10.1...genomic@0.11.0) (2024-04-22)

**Note:** Version bump only for package genomic

## [0.10.1](https://github.com/pyramation/genomic/compare/genomic@0.10.0...genomic@0.10.1) (2024-04-22)

**Note:** Version bump only for package genomic

# [0.10.0](https://github.com/pyramation/genomic/compare/genomic@0.9.0...genomic@0.10.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [0.9.0](https://github.com/pyramation/genomic/compare/genomic@0.8.1...genomic@0.9.0) (2024-04-22)

**Note:** Version bump only for package genomic

## [0.8.1](https://github.com/pyramation/genomic/compare/genomic@0.8.0...genomic@0.8.1) (2024-04-22)

**Note:** Version bump only for package genomic

# [0.8.0](https://github.com/pyramation/genomic/compare/genomic@0.7.0...genomic@0.8.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [0.7.0](https://github.com/pyramation/genomic/compare/genomic@0.6.0...genomic@0.7.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [0.6.0](https://github.com/pyramation/genomic/compare/genomic@0.5.0...genomic@0.6.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [0.5.0](https://github.com/pyramation/genomic/compare/genomic@0.4.0...genomic@0.5.0) (2024-04-22)

**Note:** Version bump only for package genomic

# [0.4.0](https://github.com/pyramation/genomic/compare/genomic@0.3.0...genomic@0.4.0) (2024-04-22)

**Note:** Version bump only for package genomic

# 0.3.0 (2024-04-22)

**Note:** Version bump only for package genomic

## 0.0.2 (2024-04-21)

**Note:** Version bump only for package @pyramation/genomic
