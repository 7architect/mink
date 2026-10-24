# Mink

Your repository control center: discover tasks, inspect execution plans, run DAG
pipelines and manage local services from the CLI or an interactive terminal UI.

Requires **Node.js 24+**. Supports Linux, macOS and native Windows (Windows
PowerShell is required for process ownership on Windows).

```sh
npm install --global @yaroslavlky/mink
# or: pnpm add --global @yaroslavlky/mink
mink --help
mink doctor
mink list
mink plan verify
mink run verify
mink ui
```

Use `exec` and `args` in `mink.yml` for portable commands without shell quoting.
Existing `command` entries run in `/bin/sh` on Linux/macOS and Windows PowerShell
on Windows; shell syntax belongs to the selected shell.

Documentation: <https://yaroslavlky.github.io/mink/>
Source and issues: <https://github.com/yaroslavlky/mink>

MIT license.
