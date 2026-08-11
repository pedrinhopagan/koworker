# Desktop Electron + Bun

O Electron hospeda a interface React servida pelo backend local. Dados, ORPC, banco e terminais continuam no processo Bun.

## Runtime

`electron/main.ts` cria a janela sem moldura, o tray e os handlers IPC. `electron/preload.ts` expõe somente `window.kowork`; o renderer permanece com sandbox e isolamento de contexto, sem Node.

O backend usa a porta 2841 em desenvolvimento e 2842 em produção. O shell reutiliza um servidor saudável nessa porta. Se a porta estiver livre, inicia `bun --watch src/server.ts` em desenvolvimento ou o binário compilado em produção.

Uma instalação nova carrega `dist` e `kowork-backend` nos recursos do pacote. No primeiro início de cada versão, o shell publica esses arquivos nos caminhos canônicos:

- `~/.local/lib/kowork/bin/kowork-backend`
- `<appData>/dist`
- `<appData>/kowork.db`
- `<appData>/jwt.secret`

## Janela e instância única

A primeira instância inicia oculta. `--show`, `--hide`, `--toggle` e `--quit` chegam à instância viva por `app.requestSingleInstanceLock()`.

Fechar a janela esconde o app no tray. O item Sair encerra o backend que o próprio shell iniciou. Um backend externo ou gerenciado por systemd permanece vivo.

O atalho continua no gerenciador de janelas:

- Produção: `Alt+K` executa `kowork --toggle`.
- Desenvolvimento: `Alt+L` executa o Electron de desenvolvimento com `--toggle`.

## Build

```bash
bun run electron:build
bun run desktop:pack
bun run desktop:build
```

`desktop:pack` gera a pasta executável do host. `desktop:build` gera AppImage e DEB no Linux e acrescenta RPM quando `rpmbuild` está instalado; Windows gera NSIS e macOS gera DMG. Os artefatos ficam em `electron/release/`.

## Deploy

`bun run deploy:fast` recompila frontend, backend, CLI e AppImage, instala os artefatos de forma atômica e verifica a porta 2842. Quando existe `kowork-backend.service`, o script reinicia a unidade; caso contrário, o Electron controla o backend.

`bun run deploy` cria uma release a partir da branch remota principal, atualiza a versão em `package.json`, gera os pacotes e publica commit e tag.
