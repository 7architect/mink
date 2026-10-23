<div align="center">
  <img src="assets/logo-rounded.png" alt="Mink — логотип с норкой" width="112" height="112">

# Mink

**Пульт управления репозиторием прямо в терминале.**

Находите команды, заполняйте параметры, запускайте пайплайны и управляйте локальными сервисами из одной палитры.
</div>

Mink 0.1 — первая рабочая alpha для **Linux/macOS и Node.js 24+**. Пакеты пока не опубликованы: запуск доступен из собранного репозитория. Лицензия MIT.

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

- CLI: `ui`, `list`, `check`, `run`, `init`, `preset`, `favorite`.
- Палитра с нечётким поиском, избранным и историей; формы, предпросмотр, копирование команды и foreground stdin.
- YAML + JSON Schema и проверка ссылок/циклов до выполнения; импорт package scripts, базовых npm/pnpm/yarn workspaces и `scripts/*.sh`.
- Параметры `string`, `number`, `boolean`, `select`, `port`, `path`, `secret`, defaults, условия и пресеты.
- DAG-пайплайны, вложенные пайплайны, типизированные `with`, однократные prerequisites и общий лимит процессов для корневого запуска.
- Потоковый stdout/stderr, exit code, длительность, timeout и cancellation с очисткой принадлежащих сессии POSIX process groups.
- Сервисы с process/TCP/HTTP readiness; просмотр вывода, stop/restart/kill и открытие HTTP health URL.
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
    command: node -e 'console.log("Hello, " + process.env.PERSON)'
    params:
      person: { type: string, env: PERSON, default: team }
  check:
    kind: pipeline
    name: Check the project
    max_parallel: 2
    steps:
      greeting: { uses: greet, with: { person: Mink } }
```

YAML перекрывает обнаруженные команды с тем же ID. `--no-discovery` отключает импорт. Параметры передаются через env или отдельно экранированные аргументы; `command` остаётся доверенным shell-кодом. Секреты вводятся в маскированной форме или через `--secret-env token=ENV_NAME`, исключены из presets/clipboard/history. Вывод дочерней программы может содержать секреты и не редактируется автоматически.

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

[Содержимое документации](apps/docs/content) включает руководство, CLI, конфигурацию, параметры, discovery, пайплайны, сервисы, состояние, безопасность и [архитектуру](apps/docs/content/architecture.mdx). Главная страница сайта — отдельный лендинг с локализованными версиями `/ru/`, `/de/`, `/fr/` и `/zh/`, документация начинается с `/overview/`. Сайт можно разместить на любом static hosting; автоматическая публикация не включена. Перед публикацией задайте `NEXT_PUBLIC_SITE_URL`, чтобы canonical и Open Graph ссылались на реальный домен. `og:generate` запускайте после `docs:build`: скрипт снимает карточку из собранного `og-card` через Chromium с аппаратным WebGL.

Ядро в `packages/core` не зависит от React/Ink. CLI и TUI используют общий preflight, планировщик и runtime. Подробности API — в [README ядра](packages/core/README.md).

Ограничения alpha: Windows, PTY-эмуляция, сохранение сервисов между сессиями, Make/Taskfile/Compose imports, плагины, inheritance и remote/Git integrations отложены. Readiness проверяет запуск, а не непрерывное здоровье сервиса; лимит `max_parallel` корня покрывает задачи и запуск сервисов, готовые сервисы продолжают работать за пределами этого бюджета.
