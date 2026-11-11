<div align="center">

<img src="static/logo.svg" width="96" alt="Koworker logo">

# Koworker

**A local workspace for projects, tasks, and AI coding agents.**<br>
Keep your code, context, and conversations in one place.

![TypeScript](https://img.shields.io/badge/TypeScript-1d1f25?style=flat-square&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1d1f25?style=flat-square&logo=bun&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-1d1f25?style=flat-square&logo=react&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-1d1f25?style=flat-square&logo=electron&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-1d1f25?style=flat-square&logo=sqlite&logoColor=white)

[Run locally](#run-locally) · [Under the hood](#under-the-hood) · [Documentation](#documentation)

<br>

<img src="docs/screenshots/tasks.png" alt="Koworker task workspace with a feature index, grouped tasks, and project navigation">

<sub>Built with Koworker, managed in Koworker. Screenshots show the development workspace in Portuguese.</sub>

</div>

## Highlights

- **One workspace per project.** Open coding CLIs, run project commands, and find context files from a single launchpad.
- **Tasks backed by Markdown.** Plans, notes, and deliverables live in your project folder, readable by you and your agents.
- **Conversations with context.** Follow Codex and other terminal agents, with conversation history, tools, and results.
- **A shared skill library.** Browse, edit, and organize reusable instructions across coding CLIs.
- **Local data.** SQLite stores the app state. Project files stay on disk; coding agents use their configured providers.

## Follow the work

Read agent output as a conversation. Inspect tool activity, choose a model and reasoning effort, and respond to questions or approvals.

<p align="center">
  <img src="docs/screenshots/conversation.png" alt="A real Codex conversation in Koworker, with expandable tool activity, project history, and message controls">
  <br>
  <sub>A conversation from Koworker's own development, continued inside the app.</sub>
</p>

## Keep instructions close

Skills turn your workflow into reusable instructions. Group them by category and edit their files without leaving the workspace.

<p align="center">
  <img src="docs/screenshots/skills.png" alt="Koworker skill library with search, categories, and cards for reusable agent instructions">
</p>

## Run locally

Requires [Bun](https://bun.sh). Agent features also need the corresponding coding CLI installed and authenticated.

```bash
git clone https://github.com/pedrinhopagan/koworker.git
cd koworker
cp .env.example .env
```

In `.env`, set `DATABASE_URL` to an absolute SQLite path on your computer. Set a long, random `JWT_SECRET` and choose `KOWORK_ADMIN_USER` and `KOWORK_ADMIN_PASSWORD`.

```bash
bun run setup
bun dev
```

Setup installs dependencies, prepares SQLite, creates the configured admin account, and builds the frontend, backend, and Electron shell.

For the browser interface, use `bun run dev:web` and open [localhost:2841](http://localhost:2841). The same credentials apply.

<details>
<summary>Connect your agent with the kw skill</summary>

Register your project in the app with its repository path. Then, from the Koworker clone, register the CLI:

```bash
bun link
kw-cli version
```

Keep Bun's global binaries on your agent's `PATH`. Set `KOWORK_DATABASE_URL` to the same absolute path as the app's `DATABASE_URL`.

Install the bundled [kw skill](static/skills/kw/SKILL.md) in your agent's skill directory. For the shared directory:

```bash
mkdir -p ~/.agents/skills
cp -R static/skills/kw ~/.agents/skills/
```

Compare any existing `kw` skill before replacing it. Add this rule to your agent's global instructions, adjusting the path:

```text
For work in a project registered in Koworker, load and follow
~/.agents/skills/kw/SKILL.md.
```

Start a new agent session in the registered project and ask:

```text
Use the kw skill to plan report exports for this project.
```

The agent creates tasks through `kw-cli` and saves plans, decisions, and results under the project's `.koworker/` folder. The app lets you read, edit, organize, and complete them.

Each task has an `index.md` linking its deliverables. To resume later, ask your agent to read the task's existing files before continuing.

Task content stays outside Git. Back up both `.koworker/` and the SQLite database.

</details>

## Under the hood

| Layer | Built with |
| --- | --- |
| Interface | React 19, TanStack Router & Query, Zustand |
| Styling | Tailwind CSS 4, Radix UI |
| API & live updates | Bun, ORPC, WebSockets |
| Storage | SQLite, Kysely, Markdown files |
| Desktop | Electron with a local Bun backend |
| Agent CLI | `kw-cli`, with direct database access and storage locks |

<details>
<summary>Development commands</summary>

| Command | Purpose |
| --- | --- |
| `bun dev` | Start the desktop app in development mode |
| `bun run dev:web` | Start the browser interface and backend |
| `bun run typecheck` | Check TypeScript |
| `bun run oxlint` | Run the linter |
| `bun test` | Run the existing test suite |
| `bun run desktop:pack` | Build an unpacked desktop app |
| `bun run desktop:build` | Build desktop packages for the host platform |
| `bun run cli` | Show the agent CLI commands |

</details>

## Documentation

[Desktop architecture](docs/desktop/README.md) · [Terminal integration](docs/TERMINAL.md) · [Agent sessions](docs/SESSOES.md) · [Skills](docs/skills.md)
