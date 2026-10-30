---
name: kw
description: Use em toda interação de trabalho em um projeto cadastrado no Koworker, ao receber /kw ou ao trabalhar em .koworker/.
---

# Koworker

Cada tarefa é uma pasta de contexto dentro de `.koworker/`, na raiz do projeto cadastrado no app. O banco mantém seu cadastro; os arquivos guardam planos, decisões, pesquisas, resultados e artefatos entre sessões.

## Encontre a tarefa

Execute `kw-cli` na raiz cadastrada do projeto: o `cwd` precisa corresponder ao `main_route`. `kw-cli project list` mostra os caminhos registrados.

A cada pedido, identifique a tarefa pelo contexto ou busque com `kw-cli task list "<busca>" --all`. Reutilize a tarefa correspondente; quando ela estiver concluída e o trabalho continuar, reabra com `kw-cli task reopen <taskId|caminho>`.

Quando o pedido trouxer `/kw <caminho>`, a pasta indica a tarefa inteira; um arquivo indica o foco da ação. Leia os arquivos da tarefa antes de avançar.

Se o assunto ainda não tiver tarefa, liste as features com `kw-cli feature list`. Reutilize uma adequada ou crie uma com `kw-cli feature create "<nome>"`. Crie a tarefa com `kw-cli task create "<título>" --feature <nome|id>` e use o `taskId` e o `folder_path` retornados. `kw-cli task show <taskId|caminho>` confirma a feature e os arquivos.

## Registre pela CLI

Crie tarefas e grave seus arquivos Markdown pela CLI, que mantém o cadastro, a ordem dos arquivos e os avisos ao app. Criar uma pasta manualmente deixa a tarefa sem registro no banco.

Conteúdo longo vai para um arquivo temporário fora de `.koworker/` e entra por `--from`. Conteúdo curto entra por `--stdin` ou `--content`.

```bash
kw-cli task file create <taskId|caminho> plano.md --from /caminho/temporario/plano.md
kw-cli task file write <taskId|caminho> plano.md --stdin
kw-cli task file list <taskId|caminho>
```

Confira a gravação com `task file list` e `task file read`. Use o caminho canônico retornado pela CLI: projetos podem ter layouts diferentes, e renomear a tarefa ou feature preserva a pasta.

## Preserve o contexto útil

Cada entrega durável ganha um arquivo com nome curto e descritivo: plano, pesquisa, decisão, revisão ou resultado. Atualize um arquivo existente quando o pedido for revisá-lo. Perguntas rápidas e status ficam no chat; registre as decisões que alterarem o trabalho.

Uma mudança de código relevante gera um resumo na tarefa com o que mudou, o motivo e a validação. Arquivos do produto, como código e documentação do repositório, permanecem no destino pedido pelo usuário.

Mantenha `index.md` como mapa da tarefa: um cabeçalho por arquivo de ação, na ordem em que aconteceu, seguido de uma ou duas linhas sobre seu conteúdo. Ao criar um arquivo, acrescente sua entrada; ao editá-lo, atualize a entrada correspondente.

Use o formato `## <descrição curta>: <arquivo.md>`. Em planos com escolhas do usuário, use checkboxes GFM (`- [ ]` e `- [x]`) e explique o que ele deve selecionar.

Artefatos como HTML e PDF ficam ao lado dos Markdown, na pasta canônica da tarefa. O app os encontra e os exibe no Mostruário. O Koworker adiciona `.koworker/` ao `.gitignore` ao criar a tarefa; esse contexto permanece local.

Ao delegar, mantenha a escrita dos Markdown com o agente responsável pela tarefa: receba o conteúdo dos subagentes e registre pela CLI. Assim, todos os resultados ficam vinculados à mesma tarefa.

Quando a entrega estiver concluída e validada, marque a tarefa com `kw-cli task done <taskId|caminho>`.

## Consulte a versão instalada

`kw-cli` sem argumentos mostra o help completo da versão instalada.

Use `kw-cli storage preview` para diagnosticar divergências entre arquivos e cadastro. A reconciliação é uma operação explícita com backup, separada do fluxo normal de uma tarefa.
