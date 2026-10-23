# @mink/core

Headless Mink engine. Node.js 24+, Linux/macOS. No React, Ink, or CLI framework dependency.

```ts
import { createMink } from '@mink/core';
const mink = await createMink({ cwd: '/path/to/project' });
try {
  console.log(mink.searchCommands('test'));
  const plan = mink.plan('test', {}); // Entire-graph preflight; no process starts.
  console.log(plan.id);
  const result = await mink.run(
    'test',
    {},
    {
      onEvent(event) {
        if (event.chunk) process.stdout.write(event.chunk);
      },
    },
  );
  console.log(result.state, result.exitCode);
} finally {
  await mink.dispose(); // Always stop owned services and descendants.
}
```

`prepare` resolves a single command; `plan` supports commands and nested pipelines. `run` returns task completion or pipeline readiness. Ready services remain owned by this instance until stopped or disposed. `services`, `stopService`, and `restartService` expose session management. `subscribe` observes typed process events. `state`, `favorite`, `preset`, and `savePreset` manage local convenience state.

Options: `configFile`, `cwd`, `discover` (default true), `stateDirectory` (override local storage for embedding/testing), and a Consola `logger`. `getConfig` and search results return detached snapshots. Prepared commands/plans can include secret values; treat them as sensitive in application code.

The JSON Schema in `schema/mink.schema.json` owns configuration shape. Run `pnpm schema:generate` after changes. Semantic validation checks references and cycles; planning resolves every input before side effects. The runtime owns DAG scheduling, root process concurrency, POSIX groups, readiness, cancellation, and timeout. State updates use a cross-process lock and atomic rename.

See [architecture](../../apps/docs/content/architecture.mdx), [configuration](../../apps/docs/content/configuration.mdx), and the runnable [demo](../../examples/demo/mink.yml). Raw child output is preserved; consumers rendering it in terminals should sanitize control sequences as appropriate.
