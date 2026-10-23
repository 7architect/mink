'use client';

import {
  CheckCircle2,
  ChevronDown,
  Circle,
  CornerDownLeft,
  FileCode,
  FileCog,
  FileJson,
  FileTerminal,
  Folder,
  Hammer,
  Loader2,
  Server,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/** Steps through `length` states while the element is on screen. Reduced motion shows the final state. */
function useCycle(length: number, ms: number): [number, RefObject<HTMLDivElement | null>] {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIndex(length - 1);
      return;
    }
    let timer = 0;
    const start = () => {
      if (!timer) timer = window.setInterval(() => setIndex((value) => (value + 1) % length), ms);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      start();
      return stop;
    }
    const observer = new IntersectionObserver(([entry]) =>
      entry.isIntersecting ? start() : stop(),
    );
    observer.observe(node);
    return () => {
      stop();
      observer.disconnect();
    };
  }, [length, ms]);

  return [index, ref];
}

function Window({
  title,
  aside,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-[#222] bg-[#0b0b0b] shadow-[0_24px_48px_-28px_rgba(0,0,0,0.95)]',
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-[#1c1c1c] bg-[#101010] px-2.5 py-1.5">
        <span className="size-1.5 rounded-full bg-[#333]" />
        <span className="size-1.5 rounded-full bg-[#333]" />
        <span className="size-1.5 rounded-full bg-[#333]" />
        <span className="ml-1.5 truncate font-mono text-[10px] text-[#6a6a6a]">{title}</span>
        {aside && <span className="ml-auto font-mono text-[10px] text-[#6a6a6a]">{aside}</span>}
      </div>
      <div className={cn('relative min-h-0 flex-1 p-3', bodyClassName)}>{children}</div>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex size-1.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#4ade80] opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-1.5 rounded-full bg-[#4ade80]" />
    </span>
  );
}

const files: { icon: LucideIcon; name: string; depth: number; tag?: string }[] = [
  { icon: FileJson, name: 'package.json', depth: 0, tag: '4 scripts' },
  { icon: Hammer, name: 'Makefile', depth: 0, tag: '3 targets' },
  { icon: Folder, name: 'scripts/', depth: 0 },
  { icon: FileTerminal, name: 'seed.sh', depth: 1, tag: 'shell' },
  { icon: FileCode, name: 'tasks.mjs', depth: 1, tag: 'node' },
  { icon: FileCog, name: 'mink.yml', depth: 0, tag: 'config' },
];
const ROW = 20;

export function DiscoverVisual() {
  const [step, ref] = useCycle(files.length + 4, 650);
  const scanned = Math.min(step, files.length);
  const done = step >= files.length;

  return (
    <div ref={ref} className="h-full">
      <Window title="~/acme-checkout" aside={done ? 'indexed' : 'scanning…'}>
        <div className="relative font-mono text-[11px]">
          <div
            className="absolute inset-x-[-6px] rounded bg-white/[0.06] transition-all duration-500 ease-out"
            style={{
              height: ROW,
              transform: `translateY(${Math.min(step, files.length - 1) * ROW}px)`,
              opacity: done ? 0 : 1,
            }}
          />
          {files.map((file, index) => {
            const Icon = file.icon;
            const seen = index < scanned;
            return (
              <div
                key={file.name}
                className="relative flex items-center gap-2"
                style={{ height: ROW, paddingLeft: file.depth * 16 }}
              >
                {file.depth > 0 && (
                  <span className="absolute top-0 bottom-0 left-[6px] w-px bg-[#2a2a2a]" />
                )}
                <Icon
                  className={cn(
                    'size-3.5 shrink-0 transition-colors duration-500',
                    seen ? 'text-[#f5f5f5]' : 'text-[#3a3a3a]',
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'transition-colors duration-500',
                    seen ? 'text-[#d4d4d4]' : 'text-[#4a4a4a]',
                  )}
                >
                  {file.name}
                </span>
                {file.tag && seen && (
                  <span className="ml-auto animate-in rounded border border-[#2a2a2a] px-1.5 text-[9.5px] leading-4 text-[#8a8a8a] duration-500 fade-in slide-in-from-right-2">
                    {file.tag}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div
          className={cn(
            'mt-2 flex items-center gap-1.5 border-t border-[#1c1c1c] pt-2 font-mono text-[10.5px] transition-opacity duration-500',
            done ? 'text-[#f5f5f5] opacity-100' : 'opacity-0',
          )}
        >
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          10 commands ready
        </div>
      </Window>
    </div>
  );
}

const paramStates = [
  { region: 'eu-west', count: '20', dry: false, preset: 'default', focus: '' },
  { region: 'us-east', count: '20', dry: false, preset: 'default', focus: 'region' },
  { region: 'us-east', count: '50', dry: false, preset: 'default', focus: 'count' },
  { region: 'us-east', count: '50', dry: true, preset: 'default', focus: 'dry' },
  { region: 'us-east', count: '50', dry: false, preset: 'staging', focus: 'preset' },
];

function ParamRow({
  label,
  focused,
  children,
}: {
  label: string;
  focused: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-3">
      <span
        className={cn(
          'font-mono text-[11px] transition-colors',
          focused ? 'text-[#f5f5f5]' : 'text-[#6a6a6a]',
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function fieldClass(focused: boolean) {
  return cn(
    'flex h-7 items-center justify-between rounded-md border bg-[#080808] px-2.5 font-mono text-[11px] text-[#f5f5f5] transition-all duration-300',
    focused ? 'border-[#5a5a5a] shadow-[0_0_0_3px_rgba(255,255,255,0.06)]' : 'border-[#232323]',
  );
}

function Changing({ value }: { value: string }) {
  return (
    <span
      key={value}
      className="inline-block animate-in duration-500 fade-in slide-in-from-bottom-1"
    >
      {value}
    </span>
  );
}

export function ParametersVisual() {
  const [step, ref] = useCycle(paramStates.length, 1500);
  const state = paramStates[step];

  return (
    <div ref={ref} className="h-full">
      <Window title="seed · Seed sample orders" aside="↵ run">
        <div className="grid h-full grid-cols-[1.05fr_1fr] gap-4">
          <div className="flex flex-col justify-center gap-2">
            <ParamRow label="region" focused={state.focus === 'region'}>
              <div className={fieldClass(state.focus === 'region')}>
                <Changing value={state.region} />
                <ChevronDown className="size-3.5 text-[#6a6a6a]" aria-hidden="true" />
              </div>
            </ParamRow>
            <ParamRow label="count" focused={state.focus === 'count'}>
              <div className={fieldClass(state.focus === 'count')}>
                <span className="flex items-center">
                  <Changing value={state.count} />
                  {state.focus === 'count' && (
                    <span
                      className="ml-px h-3 w-px animate-caret-blink bg-[#f5f5f5]"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="text-[10px] text-[#555]">string</span>
              </div>
            </ParamRow>
            <ParamRow label="dry_run" focused={state.focus === 'dry'}>
              <div className="flex h-7 items-center">
                <Switch
                  checked={state.dry}
                  tabIndex={-1}
                  aria-label="dry_run"
                  className="pointer-events-none data-checked:bg-[#f5f5f5] data-unchecked:bg-[#2a2a2a]"
                />
              </div>
            </ParamRow>
            <ParamRow label="preset" focused={state.focus === 'preset'}>
              <div className="flex h-7 w-fit items-center rounded-md border border-[#232323] bg-[#080808] p-0.5 font-mono text-[10.5px]">
                {['default', 'staging'].map((name) => (
                  <span
                    key={name}
                    className={cn(
                      'rounded px-2 py-0.5 transition-colors duration-300',
                      state.preset === name ? 'bg-[#f5f5f5] text-[#080808]' : 'text-[#6a6a6a]',
                    )}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </ParamRow>
          </div>
          <div className="flex flex-col rounded-md border border-[#1c1c1c] bg-[#080808] p-2.5 font-mono text-[10.5px] leading-[1.7]">
            <span className="mb-1 text-[9.5px] tracking-wider text-[#555]">PREVIEW</span>
            <span className="text-[#6a6a6a]">
              REGION=
              <span className="text-[#f5f5f5]">
                <Changing value={state.region} />
              </span>
            </span>
            <span className="text-[#6a6a6a]">
              SEED_COUNT=
              <span className="text-[#f5f5f5]">
                <Changing value={state.count} />
              </span>
            </span>
            <span className="text-[#6a6a6a]">
              DRY_RUN=
              <span className="text-[#f5f5f5]">
                <Changing value={String(state.dry)} />
              </span>
            </span>
            <span className="mt-auto truncate text-[#d4d4d4]">$ node scripts/tasks.mjs seed</span>
          </div>
        </div>
      </Window>
    </div>
  );
}

type StageStatus = 'pending' | 'running' | 'done';

const stagePhases: Record<string, StageStatus>[] = [
  { lint: 'pending', typecheck: 'pending', test: 'pending', build: 'pending' },
  { lint: 'running', typecheck: 'running', test: 'running', build: 'pending' },
  { lint: 'done', typecheck: 'done', test: 'running', build: 'pending' },
  { lint: 'done', typecheck: 'done', test: 'done', build: 'running' },
  { lint: 'done', typecheck: 'done', test: 'done', build: 'done' },
  { lint: 'done', typecheck: 'done', test: 'done', build: 'done' },
];
const durations: Record<string, string> = {
  lint: '0.6 s',
  typecheck: '0.4 s',
  test: '0.7 s',
  build: '0.7 s',
};
const pipelineLog = [
  [],
  ['  ✓ src/cart.ts', '  ✓ cart totals'],
  ['Lint passed: 4 files', 'Checked 38 modules'],
  ['Tests: 4 passed, 0 failed', 'bundling 214 modules…'],
  ['dist/storefront.js  182.4 kB', 'checkout: succeeded (1409 ms)'],
  [],
];

function Stage({ name, status }: { name: string; status: StageStatus }) {
  const Icon = status === 'done' ? CheckCircle2 : status === 'running' ? Loader2 : Circle;
  return (
    <div
      className={cn(
        'relative flex h-8 w-[132px] items-center gap-2 overflow-hidden rounded-md border px-2.5 font-mono text-[11px] transition-colors duration-500',
        status === 'pending' ? 'border-[#1f1f1f] text-[#555]' : 'border-[#2e2e2e] text-[#e5e5e5]',
        status === 'running' && 'bg-white/[0.03]',
      )}
    >
      <Icon
        className={cn(
          'size-3.5 shrink-0',
          status === 'running' && 'animate-spin motion-reduce:animate-none',
          status === 'done' && 'text-[#f5f5f5]',
        )}
        aria-hidden="true"
      />
      {name}
      <span className="ml-auto text-[9.5px] text-[#666]">
        {status === 'done' ? durations[name] : ''}
      </span>
      <span
        className="absolute bottom-0 left-0 h-px bg-[#f5f5f5] transition-[width] duration-[900ms] ease-out"
        style={{ width: status === 'pending' ? '0%' : status === 'running' ? '60%' : '100%' }}
      />
    </div>
  );
}

function Flow({
  active,
  paths,
  className,
}: {
  active: boolean;
  paths: string[];
  className: string;
}) {
  return (
    <svg className={className} viewBox="0 0 56 112" fill="none" aria-hidden="true">
      {paths.map((d) => (
        <g key={d}>
          <path d={d} stroke="#262626" strokeWidth="1.25" />
          <path
            d={d}
            stroke="#f5f5f5"
            strokeWidth="1.25"
            strokeDasharray="3 6"
            className="animate-[mink-flow_0.9s_linear_infinite] transition-opacity duration-500 motion-reduce:animate-none"
            style={{ opacity: active ? 0.7 : 0 }}
          />
        </g>
      ))}
    </svg>
  );
}

export function PipelineVisual() {
  const [phase, ref] = useCycle(stagePhases.length, 1100);
  const stages = stagePhases[phase];
  const lines = pipelineLog
    .slice(0, phase + 1)
    .flat()
    .slice(-6);
  const succeeded = stages.build === 'done';

  return (
    <div ref={ref} className="h-full">
      <Window title="checkout · Verify checkout" aside="max_parallel 3">
        <div className="grid h-full grid-cols-[auto_1fr] gap-5">
          <div className="flex items-center">
            <div className="flex flex-col gap-2">
              <Stage name="lint" status={stages.lint} />
              <Stage name="typecheck" status={stages.typecheck} />
              <Stage name="test" status={stages.test} />
            </div>
            <Flow
              active={stages.build !== 'pending'}
              className="h-[112px] w-14 shrink-0"
              paths={['M0 16 C28 16 28 56 56 56', 'M0 56 L56 56', 'M0 96 C28 96 28 56 56 56']}
            />
            <Stage name="build" status={stages.build} />
            <Flow active={succeeded} className="h-[112px] w-8 shrink-0" paths={['M0 56 L56 56']} />
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-full border transition-all duration-500',
                succeeded
                  ? 'border-[#f5f5f5] bg-[#f5f5f5] text-[#080808]'
                  : 'border-[#262626] text-[#333]',
              )}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </span>
          </div>
          <div className="flex min-w-0 flex-col justify-end overflow-hidden rounded-md border border-[#1c1c1c] bg-[#080808] p-2.5 font-mono text-[10.5px] leading-[1.75]">
            {lines.length === 0 && <span className="text-[#444]">waiting for stages…</span>}
            {lines.map((line, index) => (
              <span
                key={`${phase}-${line}`}
                className={cn(
                  'animate-in truncate duration-500 fade-in slide-in-from-bottom-1',
                  line.startsWith('checkout:') ? 'text-[#f5f5f5]' : 'text-[#7a7a7a]',
                )}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {line}
              </span>
            ))}
          </div>
        </div>
      </Window>
    </div>
  );
}

const services = [
  { name: 'payments-api', port: ':4401', started: 47 },
  { name: 'storefront', port: ':4402', started: 31 },
];

function load(t: number) {
  return 10 + 5 * Math.sin(t / 2.6) + 3 * Math.sin(t / 1.15) + 1.5 * Math.cos(t / 0.7);
}

function uptime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ServicesVisual() {
  const [tick, ref] = useCycle(3600, 1000);
  const points = Array.from({ length: 24 }, (_, index) => load(tick + index));
  const width = 200;
  const height = 44;
  const xy = points.map((value, index) => [
    (index / (points.length - 1)) * width,
    height - (value / 20) * height,
  ]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  const last = xy[xy.length - 1];

  return (
    <div ref={ref} className="h-full">
      <Window title="services" aside="2 running" bodyClassName="flex flex-col gap-2">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center gap-2 rounded-md border border-[#1f1f1f] bg-[#080808] px-2.5 py-1.5 font-mono text-[11px]"
          >
            <Server className="size-3.5 text-[#6a6a6a]" aria-hidden="true" />
            <span className="text-[#f5f5f5]">{service.name}</span>
            <span className="text-[#555]">{service.port}</span>
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[#8a8a8a]">
              {uptime(service.started + tick)}
              <LiveDot />
            </span>
          </div>
        ))}
        <div className="relative mt-auto">
          <div className="mb-1 flex justify-between font-mono text-[9.5px] text-[#555]">
            <span>req/s</span>
            <span className="text-[#d4d4d4]">{points[points.length - 1].toFixed(1)}</span>
          </div>
          <svg
            className="h-11 w-full"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mink-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#f5f5f5" stopOpacity="0.22" />
                <stop offset="1" stopColor="#f5f5f5" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={area} fill="url(#mink-area)" />
            <polyline
              points={line}
              fill="none"
              stroke="#f5f5f5"
              strokeOpacity="0.8"
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={last[0]} cy={last[1]} r="2" fill="#f5f5f5" />
          </svg>
        </div>
        <div
          key={tick}
          className="animate-in truncate font-mono text-[10px] text-[#6a6a6a] duration-300 fade-in"
        >
          GET /health <span className="text-[#d4d4d4]">200</span> · {2 + (tick % 4)} ms ·{' '}
          {tick % 2 ? 'storefront' : 'payments-api'}
        </div>
      </Window>
    </div>
  );
}

const keySequence: { keys: string[]; action: string }[] = [
  { keys: ['Ctrl', 'P'], action: 'Open commands' },
  { keys: ['Tab'], action: 'Next tab' },
  { keys: ['?'], action: 'Show keys for this tab' },
  { keys: ['Enter'], action: 'Run the command' },
  { keys: ['y'], action: 'Copy output' },
  { keys: ['r'], action: 'Rerun last' },
  { keys: ['Esc'], action: 'Go back' },
];
const keyboardRows: { key: string; wide?: boolean }[][] = [
  [{ key: 'Esc' }, { key: '?' }, { key: 'y' }, { key: 'r' }],
  [{ key: 'Tab', wide: true }, { key: 'P' }, { key: 'Enter', wide: true }],
  [
    { key: 'Ctrl', wide: true },
    { key: 'Shift', wide: true },
  ],
];

export function KeysVisual() {
  const [step, ref] = useCycle(keySequence.length, 1300);
  const combo = keySequence[step];

  return (
    <div ref={ref} className="flex h-full flex-col justify-center gap-4">
      <div className="mx-auto flex flex-col gap-1.5">
        {keyboardRows.map((row, index) => (
          <div key={index} className="flex justify-center gap-1.5">
            {row.map(({ key, wide }) => {
              const active = combo.keys.includes(key);
              return (
                <span
                  key={key}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-md border font-mono text-[11px] transition-all duration-200',
                    wide ? 'w-[68px]' : 'w-9',
                    active
                      ? 'translate-y-[2px] border-[#f5f5f5] border-b-[#f5f5f5] bg-[#f5f5f5] text-[#080808] shadow-[0_0_24px_-4px_rgba(255,255,255,0.45)]'
                      : 'border-[#262626] border-b-[3px] border-b-[#1a1a1a] bg-[#141414] text-[#7a7a7a]',
                  )}
                >
                  {key === 'Enter' ? (
                    <CornerDownLeft className="size-3.5" aria-label="Enter" />
                  ) : (
                    key
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div
        key={step}
        className="flex animate-in items-center justify-center gap-2 duration-300 fade-in slide-in-from-bottom-1"
      >
        <KbdGroup>
          {combo.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </KbdGroup>
        <span className="text-xs text-[#8a8a8a]">{combo.action}</span>
      </div>
    </div>
  );
}

const themes = [
  { name: 'Stone', accent: '#A8A29E' },
  { name: 'Slate', accent: '#94A3B8' },
  { name: 'Sand', accent: '#D6C7A1' },
  { name: 'Graphite', accent: '#8a8a8a' },
  { name: 'Mono', accent: '#e5e5e5' },
  { name: 'Mink', accent: '#5fd7d7' },
  { name: 'Forest', accent: '#6cc36c' },
  { name: 'Amber', accent: '#e5c07b' },
  { name: 'Violet', accent: '#c678dd' },
];
const languages = [
  { name: 'English', tabs: ['COMMANDS', 'OUTPUT', 'SERVICES'], search: 'Search ›' },
  { name: 'Русский', tabs: ['КОМАНДЫ', 'ВЫВОД', 'СЕРВИСЫ'], search: 'Поиск ›' },
  { name: 'Deutsch', tabs: ['BEFEHLE', 'AUSGABE', 'DIENSTE'], search: 'Suche ›' },
  { name: 'Français', tabs: ['COMMANDES', 'SORTIE', 'SERVICES'], search: 'Recherche ›' },
  { name: '中文', tabs: ['命令', '输出', '服务'], search: '搜索 ›' },
];
const paletteRows = [
  ['checkout', 'pipeline'],
  ['api', 'service'],
  ['test', 'task'],
  ['seed', 'task'],
];

export function ThemesVisual() {
  const [step, ref] = useCycle(themes.length * languages.length, 1400);
  const theme = themes[step % themes.length];
  const language = languages[step % languages.length];

  return (
    <div ref={ref} className="grid h-full grid-cols-[1.2fr_1fr] gap-5">
      <Window title={`mink ui --theme ${theme.name.toLowerCase()}`} bodyClassName="p-2.5">
        <div className="flex gap-3 border-b border-[#1c1c1c] pb-1.5 font-mono text-[10px]">
          {language.tabs.map((tab, index) => (
            <span
              key={`${language.name}-${tab}`}
              className="animate-in transition-colors duration-500 fade-in"
              style={{ color: index === 0 ? theme.accent : '#555' }}
            >
              {tab}
            </span>
          ))}
        </div>
        <div
          className="mt-2 rounded border px-2 py-1 font-mono text-[10px] text-[#6a6a6a] transition-colors duration-500"
          style={{ borderColor: `${theme.accent}55` }}
        >
          <span key={language.name} className="animate-in fade-in">
            {language.search}
          </span>
        </div>
        <div className="mt-1.5 space-y-0.5 font-mono text-[10.5px]">
          {paletteRows.map(([name, kind], index) => (
            <div
              key={name}
              className="flex items-center justify-between rounded px-1.5 py-[3px] transition-colors duration-500"
              style={
                index === 0
                  ? { backgroundColor: `${theme.accent}26`, color: '#f5f5f5' }
                  : { color: '#7a7a7a' }
              }
            >
              <span>
                <span
                  className="transition-colors duration-500"
                  style={{ color: index === 0 ? theme.accent : 'transparent' }}
                >
                  ›{' '}
                </span>
                {name}
              </span>
              <span
                className="transition-colors duration-500"
                style={{ color: index === 0 ? theme.accent : '#4a4a4a' }}
              >
                [{kind}]
              </span>
            </div>
          ))}
        </div>
      </Window>
      <div className="flex flex-col justify-center gap-4">
        <div className="grid grid-cols-5 gap-2.5">
          {themes.map((item) => (
            <span
              key={item.name}
              title={item.name}
              className={cn(
                'size-6 rounded-full border border-white/10 transition-all duration-500',
                item.name === theme.name
                  ? 'scale-110 ring-2 ring-[#f5f5f5] ring-offset-2 ring-offset-[#111]'
                  : 'opacity-60',
              )}
              style={{ backgroundColor: item.accent }}
            />
          ))}
        </div>
        <div className="flex flex-col gap-1 font-mono text-[11px]">
          {languages.map((item) => (
            <span
              key={item.name}
              className={cn(
                'flex items-center gap-2 transition-colors duration-500',
                item.name === language.name ? 'text-[#f5f5f5]' : 'text-[#4a4a4a]',
              )}
            >
              <span
                className={cn(
                  'size-1 rounded-full transition-colors duration-500',
                  item.name === language.name ? 'bg-[#f5f5f5]' : 'bg-transparent',
                )}
              />
              {item.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
