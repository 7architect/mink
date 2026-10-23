import { useEffect, useRef, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import {
  commandLine,
  parameterFields,
  parseParameter,
  resolveValues,
  shellQuote,
  type Mink,
  type ParameterValue,
  type RunResult,
  type LocalState,
} from '@mink/core';
import { Input } from './input.js';
import { copyText, openUrl, safeText } from './actions.js';
type Values = Record<string, ParameterValue>;
type Screen = 'palette' | 'form' | 'preview' | 'output' | 'services' | 'preset' | 'save';
export function MinkApp({
  mink,
  onForeground,
}: {
  mink: Mink;
  onForeground?: (id: string, values: Values) => void;
}) {
  const { exit } = useApp(),
    { stdout } = useStdout();
  const [screen, setScreen] = useState<Screen>('palette'),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState(0),
    [id, setId] = useState(''),
    [values, setValues] = useState<Values>({}),
    [field, setField] = useState(0),
    [choice, setChoice] = useState(-1),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<RunResult>(),
    [state, setState] = useState<LocalState>({ history: [], favorites: [], presets: {} }),
    [, setRevision] = useState(0);
  const controller = useRef<AbortController | undefined>(undefined),
    logs = useRef<{ instance: string; id: string; text: string }[]>([]),
    truncated = useRef(false);
  const config = mink.getConfig(),
    entry = config.commands[id],
    fields = entry ? parameterFields(entry, values) : [],
    current = fields[field];
  const matches = mink.searchCommands(query),
    services = mink.services();
  const ranked = query ? matches : [...matches].sort((a, b) => rank(a.id) - rank(b.id));
  const picked = ranked[Math.min(selected, Math.max(0, ranked.length - 1))],
    service = services[Math.min(selected, Math.max(0, services.length - 1))];
  const height = Math.max(4, ((stdout as NodeJS.WriteStream).rows ?? 24) - 11),
    width = Math.max(20, ((stdout as NodeJS.WriteStream).columns ?? 80) - 4);
  function rank(id: string): number {
    const f = state.favorites.includes(id);
    const r = state.history.findIndex((h) => h.id === id);
    return f ? -100 : r < 0 ? 1000 : r;
  }
  useEffect(() => {
    let active = true;
    void mink
      .state()
      .then((s) => {
        if (active) setState(s);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    const unsubscribe = mink.subscribe((e) => {
      if (e.type === 'stdout' || e.type === 'stderr') {
        logs.current.push({ instance: e.instance, id: e.id, text: safeText(e.chunk ?? '') });
        let size = logs.current.reduce((n, c) => n + c.text.length, 0);
        while (logs.current.length > 1000 || size > 262144) {
          size -= logs.current.shift()!.text.length;
          truncated.current = true;
        }
      }
    });
    const timer = setInterval(() => setRevision((r) => r + 1), 100);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, [mink]);
  async function perform(action: () => Promise<unknown>): Promise<void> {
    try {
      setError('');
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function begin(target: string): void {
    if (busy) {
      setScreen('output');
      setNotice('Cancel the current invocation before starting another.');
      return;
    }
    setId(target);
    setValues({});
    setField(0);
    setChoice(-1);
    setError('');
    setResult(undefined);
    setScreen(parameterFields(config.commands[target]).length ? 'form' : 'preview');
  }
  function activeValues(input: Values): Values {
    const visible = new Set(parameterFields(entry, input).map(([name]) => name));
    return Object.fromEntries(Object.entries(input).filter(([name]) => visible.has(name)));
  }
  function submit(value: string): void {
    if (!current) return;
    const [name, p] = current;
    try {
      const next = activeValues({ ...values, [name]: parseParameter(p, value) });
      setValues(next);
      setError('');
      setChoice(-1);
      if (field + 1 < parameterFields(entry, next).length) setField(field + 1);
      else {
        resolveValues(entry, next, id);
        setScreen('preview');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function run(): Promise<void> {
    await perform(async () => {
      mink.plan(id, values);
      setBusy(true);
      setScreen('output');
      setResult(undefined);
      logs.current = [];
      truncated.current = false;
      controller.current = new AbortController();
      try {
        setResult(await mink.run(id, values, { signal: controller.current.signal }));
        setState(await mink.state());
      } finally {
        setBusy(false);
      }
    });
  }
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (busy) {
        controller.current?.abort();
        setNotice('Cancelling owned processes…');
      } else exit();
      return;
    }
    if (key.escape) {
      if (screen === 'palette') {
        exit();
        return;
      }
      setScreen('palette');
      setSelected(0);
      setError('');
      return;
    }
    if (key.ctrl && input === 's') {
      setScreen('services');
      setSelected(0);
      return;
    }
    if (screen === 'palette') {
      if (key.upArrow) {
        setSelected(Math.max(0, selected - 1));
        return;
      }
      if (key.downArrow) {
        setSelected(Math.min(ranked.length - 1, selected + 1));
        return;
      }
      if (key.return && picked) {
        begin(picked.id);
        return;
      }
      if (key.ctrl && input === 'f' && picked) {
        void perform(async () => {
          await mink.favorite(picked.id);
          setState(await mink.state());
        });
        return;
      }
      if (key.backspace || key.delete) setQuery(query.slice(0, -1));
      else if (!key.ctrl && !key.meta && !key.tab)
        setQuery(query + safeText(input).replace(/\n/g, ''));
      setSelected(0);
    } else if (screen === 'form' && current) {
      const p = current[1];
      const opts = p.type === 'boolean' ? ['false', 'true'] : (p.options ?? []);
      const selectedChoice =
        choice < 0
          ? Math.max(0, opts.indexOf(String(values[current[0]] ?? p.default ?? '')))
          : choice;
      if (key.tab && key.shift) {
        setField(Math.max(0, field - 1));
        setChoice(-1);
        return;
      }
      if (p.type === 'select' || p.type === 'boolean') {
        const options = p.type === 'boolean' ? ['false', 'true'] : p.options!;
        if (key.upArrow || key.leftArrow)
          setChoice((selectedChoice + options.length - 1) % options.length);
        if (key.downArrow || key.rightArrow) setChoice((selectedChoice + 1) % options.length);
        if (key.return) submit(options[selectedChoice]);
      }
    } else if (screen === 'preview') {
      if (key.return) {
        if (key.shift && onForeground) {
          try {
            mink.plan(id, values);
            onForeground(id, values);
            exit();
          } catch (e) {
            setError(String(e));
          }
        } else void run();
      }
      if (input === 'e') {
        setField(0);
        setScreen(fields.length ? 'form' : 'preview');
      }
      if (input === 'p') setScreen('preset');
      if (input === 's') setScreen('save');
      if (input === 'c')
        void perform(async () => {
          if (
            Object.entries(entry.params ?? {}).some(
              ([name, p]) => p.type === 'secret' && Object.hasOwn(values, name),
            )
          )
            throw new Error('Secret values cannot be copied');
          const p = mink.prepare(id, values);
          await copyText(
            [
              '(',
              `cd ${shellQuote(p.cwd ?? mink.directory)} || exit`,
              ...Object.entries(p.env).map(([k, v]) => `export ${k}=${shellQuote(v)}`),
              commandLine(p),
              ')',
            ].join('\n'),
          );
          setNotice('Copied prepared command');
        });
    } else if (screen === 'output' && !busy && input === 'r') void run();
    else if (screen === 'services' && service) {
      if (key.upArrow) setSelected(Math.max(0, selected - 1));
      if (key.downArrow) setSelected(Math.min(services.length - 1, selected + 1));
      if (input === 's') void perform(() => mink.stopService(service.instance));
      if (input === 'k') void perform(() => mink.stopService(service.instance, true));
      if (input === 'r') void perform(() => mink.restartService(service.instance));
      if (input === 'o' && service.url) void perform(() => openUrl(service.url!));
    }
  });
  const offset = Math.max(0, Math.min(selected, ranked.length - 1) - height + 1);
  const output = logs.current
    .filter((l) => screen !== 'services' || l.instance === service?.instance)
    .map((l) => (screen === 'services' ? l.text : `[${safeText(l.id)}] ${l.text}`))
    .join('')
    .split('\n')
    .slice(-height)
    .join('\n');
  let preview = '';
  let previewCwd = mink.directory;
  if (screen === 'preview') {
    try {
      const plan = mink.plan(id, values);
      previewCwd = plan.prepared?.cwd ?? mink.directory;
      preview = plan.prepared
        ? [
            ...Object.entries(plan.prepared.env).map(
              ([key, value]) =>
                `${key}=${shellQuote(Object.values(entry.params ?? {}).some((p) => p.type === 'secret' && p.env === key) ? '[hidden]' : value)}`,
            ),
            commandLine(plan.prepared),
          ].join(' ')
        : `Pipeline: ${Object.keys(plan.steps).join(' → ')}`;
    } catch (e) {
      preview = String(e);
    }
  }
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyan">
        MINK{' '}
        <Text color="white">
          {safeText(config.repository?.name ?? 'repository control center')}
        </Text>
      </Text>
      <Text dimColor wrap="truncate">
        {safeText(mink.directory)}
      </Text>
      {screen === 'palette' && (
        <>
          <Text>Search › {safeText(query)}▏</Text>
          <Text dimColor>
            ↑↓ select · Enter configure · Ctrl+F favorite · Ctrl+S services · Esc quit
          </Text>
          {!ranked.length && <Text>No matching commands.</Text>}
          {ranked.slice(offset, offset + height).map((m, i) => (
            <Box key={m.id} flexDirection="column">
              <Text inverse={offset + i === Math.min(selected, ranked.length - 1)}>
                {offset + i === selected ? '›' : ' '} {state.favorites.includes(m.id) ? '★ ' : ''}
                {safeText(m.id)} · {safeText(m.entry.name)} [
                {m.entry.kind === 'pipeline' ? 'pipeline' : (m.entry.run?.mode ?? 'task')}]
              </Text>
              {offset + i === selected && (
                <Text dimColor wrap="truncate">
                  {' '}
                  {safeText(
                    m.entry.description ?? (m.entry.kind === 'command' ? m.entry.command : ''),
                  )}
                </Text>
              )}
            </Box>
          ))}
        </>
      )}
      {screen === 'form' && current && (
        <>
          <Text bold>
            {safeText(id)} · {field + 1}/{fields.length}
          </Text>
          <Text>
            {safeText(current[0])} ({current[1].type}) {safeText(current[1].description ?? '')}
          </Text>
          {['select', 'boolean'].includes(current[1].type) ? (
            <Text>
              ← →{' '}
              {safeText(
                (current[1].type === 'boolean' ? ['false', 'true'] : current[1].options!)[
                  choice < 0
                    ? Math.max(
                        0,
                        (current[1].type === 'boolean'
                          ? ['false', 'true']
                          : current[1].options!
                        ).indexOf(String(values[current[0]] ?? current[1].default ?? '')),
                      )
                    : choice
                ],
              )}{' '}
              · Enter confirm
            </Text>
          ) : (
            <Input
              key={current[0]}
              initial={String(values[current[0]] ?? current[1].default ?? '')}
              secret={current[1].type === 'secret'}
              submit={submit}
            />
          )}
          <Text dimColor>Enter next · Shift+Tab previous · Esc back</Text>
        </>
      )}
      {screen === 'preview' && (
        <>
          <Text bold>{safeText(id)} — review before execution</Text>
          <Text wrap="wrap">{safeText(preview).slice(0, width * 4)}</Text>
          <Text dimColor>cwd: {safeText(previewCwd)}</Text>
          <Text>
            Enter run · Shift+Enter foreground stdin · e edit · p load preset · s save preset · c
            copy · Esc back
          </Text>
        </>
      )}
      {screen === 'preset' && (
        <>
          <Text>
            Preset name (
            {Object.keys({ ...entry.presets, ...state.presets[id] }).join(', ') || 'none saved'})
          </Text>
          <Input
            submit={(name) => {
              void perform(async () => {
                const v = await mink.preset(id, name);
                setValues(v);
                setField(0);
                setScreen(parameterFields(entry, v).length ? 'form' : 'preview');
              });
            }}
          />
        </>
      )}
      {screen === 'save' && (
        <>
          <Text>
            Save local preset (secret values are forbidden). Existing names are preserved.
          </Text>
          <Input
            submit={(name) => {
              void perform(async () => {
                if (Object.hasOwn(state.presets[id] ?? {}, name))
                  throw new Error('Preset exists; choose a new name');
                await mink.savePreset(id, name, values);
                setState(await mink.state());
                setNotice('Preset saved');
                setScreen('preview');
              });
            }}
          />
        </>
      )}
      {screen === 'output' && (
        <>
          <Text bold>
            {safeText(id)} · {busy ? 'running' : (result?.state ?? 'idle')}
          </Text>
          <Text wrap="truncate">{output || 'Waiting for output…'}</Text>
          {result?.error && <Text color="red">{safeText(result.error)}</Text>}
          {result && (
            <Text>
              Exit: {result.exitCode ?? result.signal ?? '—'} · {result.durationMs} ms
              {result.timedOut ? ' · timed out' : ''}
            </Text>
          )}
          <Text dimColor>{busy ? 'Ctrl+C cancel' : 'r rerun'} · Ctrl+S services · Esc palette</Text>
        </>
      )}
      {screen === 'services' && (
        <>
          <Text bold>Services owned by this session</Text>
          {!services.length && <Text>No services started.</Text>}
          {services.slice(Math.max(0, selected - 4), selected + 5).map((p) => (
            <Text key={p.instance} inverse={p.instance === service?.instance}>
              {p.instance === service?.instance ? '›' : ' '} {safeText(p.id)} · {p.state} ·{' '}
              {Math.floor((Date.now() - p.started) / 1000)}s
            </Text>
          ))}
          <Text wrap="truncate">{output}</Text>
          <Text dimColor>
            ↑↓ select · s stop · r restart · k kill · o open health URL · Esc palette
          </Text>
        </>
      )}
      {truncated.current && <Text dimColor>Older output truncated (256 KiB buffer).</Text>}
      {notice && <Text color="yellow">{safeText(notice)}</Text>}
      {error && <Text color="red">Error: {safeText(error)}</Text>}
      <Text dimColor>
        {screen} · {Object.keys(config.commands).length} commands · Ctrl+C{' '}
        {busy ? 'cancel' : 'exit'}
      </Text>
    </Box>
  );
}
