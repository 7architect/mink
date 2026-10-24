# Release scope

Implemented in this branch:

- Public scoped packages with a shared release version and npm/pnpm global-install verification.
- Native Windows process ownership, portable executable arguments and platform actions.
- CI for Linux/macOS/Windows, x64/ARM64, and an OIDC publication workflow.
- `mink doctor`, sanitized `mink plan` JSON and `run --dry-run`.
- Static Makefile/Taskfile/Compose discovery and serialized watch runs.
- TUI log search, stream/process filters, and explicit redacted JSONL exports.
- Continuous service health, bounded restart, task retry, pipeline deadlines/fail-fast,
  and in-session reruns of failed branches with prerequisites.

Release gates: green checks, installation smoke tests, successful native platform
jobs, and npm scope/publisher setup as documented in [releasing.md](releasing.md).

Later work: PTY/ConPTY, persistent background sessions, plugins, configuration
inheritance and remote execution. These require separate execution and lifecycle
designs. They are not prerequisites for the scoped npm release.
