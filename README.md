# ntrust

[![version](https://img.shields.io/npm/v/ntrust?label=ntrust)](https://www.npmjs.com/package/ntrust)
[![CI](https://github.com/yjl9903/ntrust/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/ntrust/actions/workflows/ci.yml)

Batch-manage npm trusted publishing relationships for monorepo packages.

- **Batch-managing** trusted publishing relationships
- Discovering publishable packages from **pnpm workspace**
- Inferring **GitHub repository** and **actions workflow file**

## Installation

```bash
$ npx ntrust
# npm         11.10.0 (mise)
# provider    github
# repository  yjl9903/ntrust
# workflow    release.yml
# packages    ntrust

# Proceed to grant trusted publishing relationships? [Y/n]: Y

# $ mise exec npm@^11.10.0 -- npm trust list --json ntrust
# id    eebc175d-4720-4fc8-a31a-6491ca36fb47
# type  github
# repo  yjl9903/ntrust
# file  release.yml
```

## Usage

```bash
# trust all publishable packages discovered from pnpm-workspace.yaml
$ ntrust

# trust selected package folders / package.json files
$ ntrust packages/core packages/cli

# force GitHub provider and override inferred repo / file
$ ntrust github --repo your-org/your-repo --file release.yml

# list trusted relationships
$ ntrust list

# revoke trusted relationships
$ ntrust revoke
```

```bash
Batch-manage npm trusted publishing relationships for monorepo packages

Usage: ntrust [COMMAND] [OPTIONS]

Commands:
  ntrust                    Batch-create npm trusted publishing relationships for monorepo packages
  ntrust github [...files]  Batch-create npm trusted publishing relationships between packages and GitHub actions
  ntrust gitlab [...files]  Batch-create npm trusted publishing relationships between packages and GitLab CI/CD
  ntrust list [...files]    Batch-list trusted relationships
  ntrust revoke [...files]  Batch-revoke trusted relationships

Options:
      --file <name>     Name of trust pipeline file
      --repo <name>     Name of trust repository
      --env <name>      CI environment name for npm trust claim
      --registry <url>  The base URL of the npm registry
      --mise            Use mise to run npm command
      --dry-run         Show what would be done
  -y, --yes             Automatically answer "yes" to any prompts
  -C, --dir <dir>       Specify dir to run command
  -h, --help            Print help
  -v, --version         Print version
```

## Example

1. Your pnpm workspace monorepo may be like:

```yaml
# pnpm-workspace.yaml
packages:
  - packages/*
```

```json
// packages/pkg-a/package.json
{
  "name": "@your-org/pkg-a",
  "version": "1.0.0",
  "private": false
}
```

> `ntrust` ignores `private: true` packages when discovering publish targets.

2. Create GitHub actions file `.github/workflows/release.yml` to publish npm package.

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest

    permissions:
      contents: write
      id-token: write

    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4.2.0

      - uses: actions/setup-node@v6
        with:
          node-version: 24.13.1
          cache: pnpm
          registry-url: "https://registry.npmjs.org"

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm build

      - name: Publish packages
        run: pnpm -r publish --provenance --no-git-checks
```

3. Run `ntrust` command to setup trust publishing relationship.

> The workflow file above can be inferred automatically by `ntrust` to `.github/workflows/release.yml`.

```bash
$ npx ntrust
# npm         11.10.0 (mise)
# provider    github
# repository  yjl9903/ntrust
# workflow    release.yml
# packages    ntrust

# Proceed to grant trusted publishing relationships? [Y/n]: Y

# $ mise exec npm@^11.10.0 -- npm trust list --json ntrust
# id    eebc175d-4720-4fc8-a31a-6491ca36fb47
# type  github
# repo  yjl9903/ntrust
# file  release.yml
```

4. After theses setup steps, you only need to push a tag like `v1.0.0` (i.e. use `bumpp`) to trigger GitHub actions publishing your monorepo packages without any extra auth config.

```bash
bumpp package.json packages/*/package.json --commit --push --tag
```

## References

- [Trusted publishing (npm docs)](https://docs.npmjs.com/trusted-publishers)
- [npm trust command (npm docs)](https://docs.npmjs.com/cli/v11/commands/npm-trust)
- [npm trusted publishing with OIDC is generally available (GitHub changelog)](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)

## License

MIT License © 2026 [XLor](https://github.com/yjl9903)
