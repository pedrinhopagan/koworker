# ORIENTAÇÃO LOCAL DO DESKTOP

O wrapper atual vive em `electron/`. As referências a `src-tauri/` no `AGENTS.md` gerenciado descrevem a arquitetura anterior e não se aplicam ao código novo.

- `electron/main.ts`: janela, tray, instância única, permissões e IPC
- `electron/preload.ts`: única ponte exposta ao frontend
- `electron/backend.ts`: bootstrap e ciclo de vida do backend local
- `electron-builder.yml`: pacotes Linux, Windows e macOS
- `scripts/desktop/`: build, deploy e hot-deploy

O frontend acessa recursos nativos somente por `src/lib/desktop.ts`. O backend, ORPC, banco e terminais continuam fora do processo Electron.
