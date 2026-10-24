# Releases

Run `pnpm changeset` for user-facing changes. The three runtime packages have a
fixed version group. The release workflow opens a version PR; merging it publishes
verified tarballs to npm using OIDC and creates a GitHub release. Prereleases use
the `next` dist-tag; normal releases use `latest`.

One-time npm setup and recovery instructions: [docs/releasing.md](../docs/releasing.md).
