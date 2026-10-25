<div align="center">
  <img src="assets/logo-rounded.png" alt="Mink logo" width="112" height="112">

# Mink

**Your repository's command centre, in the terminal.**

Find commands, fill in parameters, run pipelines, and manage local services from one palette.

[English](README.md) · [Русский](https://yaroslavlky.github.io/mink/ru/) · [Deutsch](https://yaroslavlky.github.io/mink/de/) · [Français](https://yaroslavlky.github.io/mink/fr/) · [中文](https://yaroslavlky.github.io/mink/zh/)

<a href="https://yaroslavlky.github.io/mink/"><img src="https://raw.githubusercontent.com/yaroslavlky/mink/main/apps/docs/public/og.png" alt="Mink — terminal command palette" width="720"></a>
</div>

Mink is a terminal command centre for **Windows, Linux, and macOS** on **Node.js 24+**. It discovers the scripts and task files already in a repository, then gives them typed inputs, previews, execution plans, logs, and service controls. Windows uses Windows PowerShell and Job Objects for process ownership. Licensed under MIT.

## Install

Mink is published to npm and works with npm, pnpm, Bun, and Yarn. Install it globally with your preferred package manager:

```sh
npm install --global @yaroslavlky/mink
# pnpm add --global @yaroslavlky/mink
# bun add --global @yaroslavlky/mink
# yarn global add @yaroslavlky/mink

mink doctor
mink
```

The command is always `mink`. The unscoped `mink` package belongs to another project.

## Start in an existing repository

```sh
cd your-repository
mink init
mink
```

`mink init` creates `mink.yml` without overwriting an existing configuration. Even without a file, Mink discovers scripts in the nearest `package.json`, npm/pnpm/yarn workspaces, `scripts/*.sh`, Makefiles, Taskfiles, and Compose files.

For a complete guide, visit [the documentation](https://yaroslavlky.github.io/mink/quickstart/).

## Give this prompt to an agent

```text
Explore this repository before changing anything. Identify its package manager, scripts, Makefile/Taskfile/Compose services, test and build commands, and local development workflow. Then create a portable mink.yml for Mink that gives these commands clear names, typed parameters, sensible presets, dependencies, and readiness checks for local services. Use direct exec + args for portable commands whenever possible. Do not put secrets in the file; reference them through parameters or environment variables. Validate the configuration with `mink check --no-discovery`, show the execution plan with `mink plan <command> --json`, and explain what you created.
```

## What it does

- A CLI with `ui`, `list`, `check`, `run`, `init`, `preset`, `favorite`, `doctor`, `plan`, and `watch`.
- Fuzzy command search, favourites, history, typed forms, command previews, and foreground stdin.
- YAML and JSON Schema validation before execution, with cycle and reference checks.
- Typed `string`, `number`, `boolean`, `select`, `port`, `path`, and `secret` parameters, defaults, conditions, and presets.
- Nested DAG pipelines with shared prerequisites, bounded concurrency, retries, timeouts, and failed-branch reruns.
- Streamed stdout and stderr, cancellation, timeouts, JSONL logs with secret redaction, and POSIX process groups or Windows Job Objects.
- Services with process/TCP/HTTP readiness, continuous health checks, bounded restarts, logs, stop/restart/kill, and health URLs.

## Example configuration

```yaml
version: 1
repository:
  name: My project
commands:
  greet:
    kind: command
    name: Greet the team
    exec: node
    args: ['-e', "console.log('Hello, ' + process.env.PERSON)"]
    params:
      person: { type: string, env: PERSON, default: team }
  check:
    kind: pipeline
    name: Check the project
    max_parallel: 2
    steps:
      greeting: { uses: greet, with: { person: Mink } }
```

Use `exec` and `args` for portable commands: arguments are passed directly, without a shell. `command` remains available for trusted shell code and uses `/bin/sh` on Linux/macOS or Windows PowerShell on Windows.

## Develop from a checkout

```sh
corepack enable
corepack prepare pnpm@11.28.0 --activate
pnpm install
pnpm build:packages
pnpm check
pnpm test:pack
pnpm docs:build
```

The [demo project](examples/demo/mink.yml) runs without external dependencies. The full release and trusted-publishing setup is in [docs/releasing.md](docs/releasing.md).
