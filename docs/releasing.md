# Publishing Mink

Mink publishes three public packages from this repository:

- `@yaroslavlky/mink-core`
- `@yaroslavlky/mink-tui`
- `@yaroslavlky/mink`, which installs the `mink` command

The npm name `mink` belongs to a different project. The scope above follows the
GitHub owner; verify that the maintainer owns this npm scope before the first
publication. npm and pnpm consume the same npm registry publication.

## One-time setup

1. Enable GitHub Actions and allow Actions to create pull requests in repository
   settings. Create the GitHub environment `npm`.
2. npm trusted publishers are configured per package. If the packages do not yet
   exist, bootstrap them from an authenticated maintainer session. Build and
   inspect the actual release tarballs first:

   ```sh
   pnpm install --frozen-lockfile
   pnpm build:packages
   pnpm check
   pnpm schema:check
   pnpm release:check
   pnpm test:pack
   pnpm release:pack
   ```

   Publish the tarballs in `work/release/` in dependency order: core, TUI, CLI.
   Use `npm publish <tarball> --access public` from an npm session with publishing
   permission and the account's required authentication. Do not publish directly
   from workspace folders: `pnpm pack` resolves `workspace:` and `catalog:` ranges.

3. For **each** package, configure an npm GitHub Actions trusted publisher with:
   owner `yaroslavlky`, repository `mink`, workflow `release.yml`, environment `npm`.
   The filename is case-sensitive. No long-lived `NPM_TOKEN` is needed afterward.
4. After the bootstrap, use the release workflow for subsequent versions. It uses
   Node 24 and its modern npm CLI, `id-token: write`, and `npm publish --provenance`.

Publication to the public registry is not performed by local tests.

## Normal release

Run `pnpm changeset` with a user-facing change. Changesets keeps all three runtime
packages in one fixed version group and updates their changelogs. Pushes to `main`
run the full reusable CI matrix, then open or update a version PR. Merging the
version PR runs CI again, builds and inspects the tarballs, publishes core → TUI →
CLI, and creates a GitHub release. Documentation and the workspace root stay private.

Prerelease versions use npm's `next` dist-tag. Normal versions use `latest`.
Use Changesets prerelease mode (`pnpm changeset pre enter next`) when preparing a
prerelease train; leave it with `pnpm changeset pre exit` when appropriate.

Releases use a non-cancelling concurrency group. On a partial publication failure,
rerun the same workflow from the same commit. Existing versions must have matching
tarball integrity to be reused. A mismatching published version requires a new
version; the script will never overwrite or unpublish it. A missing GitHub release
can be created by rerunning after all npm packages are available.

## Installation verification

`pnpm test:pack` starts a temporary authenticated Verdaccio registry, publishes the
three tarballs there, then installs them **globally** using both npm and pnpm into
isolated prefixes. It checks the generated executable, version, portable arguments,
doctor, plan JSON, type declarations, and rendering with the installed React/Ink.
Internal packages resolve through the registry; there are no workspace overrides.
Registry state, credentials, installed files and processes are removed afterward.

CI targets Linux, macOS and Windows on x64 and ARM64. Windows process ownership uses
PowerShell/.NET and a suspended process assigned to a kill-on-close Job Object;
no npm native-addon compilation is required. Linux/macOS use POSIX process groups.
