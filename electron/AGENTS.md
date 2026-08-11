# ELECTRON DESKTOP

## RESPONSABILIDADE

O shell Electron fornece janela, tray, instância única, diálogo de pasta, DevTools e ciclo de vida do backend. Lógica de negócio permanece no backend Bun e no frontend React.

## PROCESSOS

- `main.ts` cria a janela sem moldura, registra IPC e controla tray e instância única.
- `preload.ts` expõe `window.kowork` com `contextIsolation`, sandbox e Node desativado no renderer.
- `backend.ts` reutiliza a porta ocupada ou inicia o backend local e o encerra junto com o app.
- Em produção, o pacote inicializa o par canônico `~/.local/lib/kowork/bin/kowork-backend` e `<appData>/dist` a partir de `resources`.

## IDENTIDADE

- Produção: `kowork`, título `Kowork`, porta 2842 e atalho do WM `Alt+K`.
- Desenvolvimento: `kowork-dev`, título `Kowork Dev`, porta 2841 e atalho do WM `Alt+L`.
- `--show`, `--hide`, `--toggle` e `--quit` são encaminhados à instância viva por `requestSingleInstanceLock`.

## BUILD

- `bun run electron:build` compila main e preload para `electron/out/`.
- `bun run desktop:pack` gera a pasta desempacotada do host.
- `bun run desktop:build` gera os pacotes configurados do host.
