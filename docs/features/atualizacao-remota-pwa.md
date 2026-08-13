---
anchors:
  - src/routes/_app/configuracoes.tsx#RedeployAppCard
  - src/api/helpers/redeploy.ts#acquireRedeployLock
  - scripts/desktop/remote-redeploy.ts:updateState
  - scripts/desktop/hot-deploy.ts#persistRepoDirForBackend
  - src/lib/redeploy-state.ts#writeRedeployState
  - src/lib/register-sw.ts#activateLatestPwa
timestamp: 2026-08-13T10:12:52-03:00
---

# Atualização remota do PWA

“Atualizar aplicativo” publica somente o conteúdo já enviado para `origin/main`. O botão não alcança mudanças locais do computador do usuário; a entrega que contém essas mudanças precisa chegar à `main` antes do clique.

A confirmação na interface inicia um processo destacado sob lock atômico. O processo faz `fetch`, abre `origin/main` num worktree descartável e executa o deploy a partir desse snapshot. O clone canônico pode estar em outra branch ou conter arquivos locais sem contaminar o build.

O deploy instala os artefatos por troca atômica e preserva no serviço o caminho do clone canônico, não o worktree temporário. Assim o próximo clique continua encontrando o repositório depois que o worktree é removido.

O caminho remoto ativa um perfil próprio de deploy: publica frontend, backend e CLI, exige que o backend de produção seja gerenciado por systemd e não constrói, abre, encerra nem substitui a GUI Electron. Isso impede que uma chamada feita pelo PWA fique presa no ciclo de vida do desktop e garante que o coordenador sobreviva ao restart necessário para verificar a nova versão.

O estado `running | succeeded | failed`, o commit e a mensagem vivem fora do processo do backend. A interface continua acompanhando o mesmo deploy durante o restart e só considera sucesso depois da verificação de saúde executada pelo deploy.

Após o sucesso, o cliente pede a atualização do service worker, espera a troca do controller quando necessária e recarrega uma vez. O identificador do deploy aplicado fica no navegador para impedir um ciclo de reload ao reabrir Configurações.
