<div align="center">
  <img src="assets/logo-rounded.png" alt="Mink — логотип с норкой" width="112" height="112">

# Mink

**Пульт управления репозиторием прямо в терминале.**

Находите команды, заполняйте параметры, запускайте пайплайны и управляйте локальными сервисами из одной палитры.
</div>

Mink — терминальный пульт для **Windows, Linux и macOS, Node.js 24+**. На Windows требуется Windows PowerShell. Лицензия MIT. Ветка готовит первый релиз `@yaroslavlky/mink`; до публикации используйте сборку из репозитория.

## Установка из npm

После первой публикации пакетов:

```sh
npm i -g @yaroslavlky/mink
# или: pnpm add -g @yaroslavlky/mink
mink doctor
mink
```

Команда остаётся `mink`. Имя пакета без scope занято другим проектом. [Настройка релизов и npm Trusted Publishing](docs/releasing.md).

## Быстрый старт

```sh
corepack enable
corepack prepare pnpm@11.28.0 --activate
pnpm install
pnpm build:packages
node packages/cli/dist/index.js ui --config examples/demo/mink.yml --no-discovery
```

[Демонстрационный проект](examples/demo/mink.yml) работает без внешних зависимостей: greeting с параметрами, параллельные проверки, вложенный pipeline и HTTP-сервис. Для запуска без TUI:

```sh
node packages/cli/dist/index.js run verify --config examples/demo/mink.yml --no-discovery
node packages/cli/dist/index.js run greet --param person=Ada --config examples/demo/mink.yml
```

В другом проекте вызовите CLI по абсолютному пути. Без `mink.yml` Mink обнаруживает scripts ближайшего `package.json`; `mink init` создаёт YAML и не перезаписывает существующий файл.

## Возможности

- CLI: `ui`, `list`, `check`, `run`, `init`, `preset`, `favorite`, `doctor`, `plan`, `watch`.
- Палитра с нечётким поиском, избранным и историей; формы, предпросмотр, копирование команды и foreground stdin.
- YAML + JSON Schema и проверка ссылок/циклов до выполнения; импорт package scripts, базовых npm/pnpm/yarn workspaces, `scripts/*.sh`, Makefile, Taskfile и Compose.
- Параметры `string`, `number`, `boolean`, `select`, `port`, `path`, `secret`, defaults, условия и пресеты.
- DAG-пайплайны, вложенные пайплайны, типизированные `with`, однократные prerequisites и общий лимит процессов для корневого запуска.
- Потоковый stdout/stderr, exit code, длительность, timeout и cancellation с очисткой POSIX process groups или Windows Job Objects.
- Сервисы с process/TCP/HTTP readiness, непрерывным health-check и ограниченным restart; просмотр вывода, stop/restart/kill и открытие HTTP health URL.
- Локальное состояние с блокировкой и атомарной записью; параметры и вывод не сохраняются в истории.

Tab переключает вкладки Commands → Output → Services → Settings, Shift+Tab — обратно. В настройках (Ctrl+G) выбираются темы и язык интерфейса: English, Русский, Deutsch, Français, 中文. Поиск и незавершённый ввод сохраняются. В палитре: ↑↓ выбрать, Enter настроить/запустить, Ctrl+F избранное, Ctrl+S сервисы, Esc назад, Ctrl+C отменить/выйти. В форме: Ctrl+B — предыдущий параметр. В preview: `e` изменить, `p` загрузить preset, `s` сохранить, `c` копировать; Shift+Enter — запустить с stdin вне Ink.

## Конфигурация

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

YAML перекрывает обнаруженные команды с тем же ID. `--no-discovery` отключает импорт. Переносимые команды задавайте через `exec` и `args`: параметры передаются напрямую, без shell. `command` остаётся доверенным shell-кодом и использует `/bin/sh` на Linux/macOS или Windows PowerShell на Windows; `shell` можно выбрать явно. Секреты вводятся в маскированной форме или через `--secret-env token=ENV_NAME`, исключены из presets/clipboard/history. Вывод дочерней программы может содержать секреты и не редактируется автоматически.

## Документация и разработка

В корне есть [mink.yml](mink.yml) для работы над самим Mink. После сборки можно открыть
палитру с описанными командами, запустить проверки или выбрать набор тестов:

```sh
node packages/cli/dist/index.js ui --no-discovery
node packages/cli/dist/index.js run check --no-discovery
node packages/cli/dist/index.js run test --preset tui --no-discovery
node packages/cli/dist/index.js run verify --no-discovery
```

`check` проверяет схему, линтер, форматирование, типы и тесты, разделяя одну сборку
runtime-пакетов между задачами. `verify` дополнительно проверяет установку пакетов и собирает
документацию. `dev` запускает Vitest watch и сайт документации на `http://127.0.0.1:4319`;
сервисами можно управлять через Ctrl+S. `--no-discovery` оставляет только описанный каталог;
без этого флага также доступны автоматически найденные workspace-скрипты.

```sh
pnpm docs:dev       # сайт Nextra на localhost:3000
pnpm docs:build     # static export + Pagefind → apps/docs/out
pnpm og:generate    # Chromium + WebGL → apps/docs/public/og.png
pnpm build:packages
pnpm check          # ESLint + Prettier + TypeScript + Vitest
pnpm schema:check
pnpm test:pack       # установка tarballs в отдельный временный проект
```

[Содержимое документации](apps/docs/content) включает руководство, CLI, конфигурацию, параметры, discovery, пайплайны, сервисы, состояние, безопасность и [архитектуру](apps/docs/content/architecture.mdx). Главная страница сайта — отдельный лендинг с локализованными версиями `/ru/`, `/de/`, `/fr/` и `/zh/`, документация начинается с `/overview/`. Сайт автоматически публикуется в GitHub Pages при обновлении `main`. Перед публикацией задайте `NEXT_PUBLIC_SITE_URL`, чтобы canonical и Open Graph ссылались на реальный домен. `og:generate` запускайте после `docs:build`: скрипт снимает карточку из собранного `og-card` через Chromium с аппаратным WebGL.

Ядро в `packages/core` не зависит от React/Ink. CLI и TUI используют общий preflight, планировщик и runtime. Подробности API — в [README ядра](packages/core/README.md).

Дополнительно: `mink plan verify --json` и `mink run verify --dry-run` показывают план без выполнения и скрывают секреты; `mink doctor` проверяет окружение, конфигурацию, инструменты, порты и хранилище. `mink watch test --path src --mode restart` перезапускает задачу после изменений и ждёт завершения отменённого запуска. В логах: `/` поиск, Ctrl+L поток, Ctrl+N процесс, Ctrl+U сброс. `mink run verify --log-file run.jsonl` сохраняет новый JSONL-файл и маскирует известные секреты, включая разделённые между чанками. В Output клавиша `f` повторяет неуспешные ветки с prerequisites.

Для задач доступны `run.retry`, для сервисов — `run.health` и `run.restart`, для пайплайнов — `fail_fast` и общий `timeout_ms`. Примеры и семантика: [конфигурация](docs/configuration.md).

Ограничения alpha: PTY-эмуляция, сохранение сервисов между сессиями, плагины, inheritance и remote/Git integrations отложены. `ready` проверяет запуск; необязательный `health` продолжает проверки после него; лимит `max_parallel` корня покрывает задачи и запуск сервисов, готовые сервисы продолжают работать за пределами этого бюджета.
