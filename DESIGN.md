# Sistema visual do Koworker

A interface usa a geometria de cantos retos do Koworker e os componentes Radix existentes.
A paleta padrão é Torra, importada do tema ativo do T3 Code, com versões clara e escura.
A base de tokens e controles inclui referências do [T3 Code](https://github.com/pingdotgg/t3code), revisão `8bc40b4e07bb7b4b0f71876d59520360c9bf958c`, em `apps/web/src/index.css` e `apps/web/src/components/ui/`.
A atribuição está em `third-party/T3-CODE-LICENSE`.

## Paleta e tipografia

O app oferece Torra, Koworker, Ember, Gruvbox Medium, NieR: Automata e Warm Earth.
Warm Earth só tem aparência escura; as demais possuem versões clara e escura.
A escolha fica em Configurações, no card Tema. O botão do topo só alterna claro e escuro.
O root recebe a classe do modo e a da paleta (`dark torra`). Os tokens de cada paleta sobrescrevem os da base.

Torra usa superfícies neutras quentes e destaque âmbar. Suas cores incluem sidebar, mensagens, campos, código, busca e terminal.
Koworker usa canvas cinza azulado, painel quase branco e azul como cor primária.
Ember usa tons de areia e marrom, com laranja como cor primária.
No escuro, o painel de conteúdo é um pouco mais claro que o canvas.
Custom properties de tema usam valores fixos em oklch: o bundler do Bun troca `color-mix()` com `var()` por um fallback errado.

As cores dos projetos continuam identificando projetos e seus conteúdos.
Sucesso, alerta e erro possuem cores próprias, independentes da cor primária.

A interface usa Inter Variable com eixo óptico. Código, caminhos e identificadores usam JetBrains Mono Variable.
As duas fontes vêm de `@fontsource-variable` e funcionam offline.
Títulos usam caixa normal. Metadata tem menos contraste que o conteúdo.

## Geometria e controles

Todos os cantos da interface são retos, incluindo campos, botões, cards, mensagens, menus, dialogs, indicadores e switches.
A escala de raios em `src/index.css` permanece zerada. Markdown e editor usam a mesma geometria.

Botões de desktop medem 32 px; botões compactos medem 28 px.
No celular, os botões comuns e os ícones mantêm alvos de 44 px.
Ações principais usam a cor primária da paleta. Ações secundárias usam `outline`, `ghost` ou `ghost-muted`.

Campos e selects medem 32 px. O tamanho base não usa variante responsiva: a altura e a fonte passadas por quem usa o componente sempre vencem.
Campos usam superfície neutra, borda discreta e foco visível. Botão, campo e select marcam o foco do mesmo jeito: borda e anel de 1 px na cor de foco, sem recuo.
Selects usam `CustomSelect`, com a mesma superfície do campo. O item escolhido leva um check à direita; o realce de teclado e mouse fica só no fundo.
Menus de contexto seguem a anatomia do dropdown: mesmo recuo, mesmo realce e rótulos de grupo pequenos e esmaecidos.
Switches mantêm 2 px de folga em volta do indicador nos dois estados.
Rótulos de status usam `Chip`, o único componente de etiqueta. Estados usam o fundo suave da cor semântica com o texto na própria cor.
Todos os ícones de interface vêm de Lucide.

## Navegação

O shell segue o layout da Dogama. Sidebar, topo e barra de status ficam sobre o canvas (`bg-chrome`), sem bordas.
O conteúdo vive num painel recortado (`data-component="app-panel"`) com borda e fundo `background`.
No celular, o painel ocupa a tela inteira, sem recorte.

A sidebar reúne a busca de páginas, o projeto em foco e as páginas agrupadas.
A seleção usa fundo tingido pela cor primária, texto destacado e ícone na cor primária.
A sidebar mantém o modo compacto escolhido pelo usuário.
A marca no topo da sidebar usa a silhueta da logo oficial, na cor primária do tema.

O topo mostra breadcrumbs clicáveis, voltar, seleção de projeto, cópia da rota e troca de tema.
A busca fica na sidebar; o topo só mostra o ícone de busca quando a sidebar está oculta.
Nas tarefas, a hierarquia é nome do projeto, Tarefas, nome da feature e nome da tarefa.
O nome do projeto leva à home. Na home, o nome abre o seletor de projetos.
Sem projeto em foco, o breadcrumb mostra Todos os projetos.
O nome da tarefa trunca quando falta espaço. Os links preservam o projeto.
A cópia do padrão da rota usa apenas um ícone com tooltip.
Os ícones do topo e os controles do seletor de modelo não possuem moldura.
A busca abre com Ctrl+K ou Cmd+K e aceita setas, Enter e Escape.
Ctrl+B ou Cmd+B recolhe a sidebar. Os atalhos Alt+0 a Alt+9 continuam disponíveis.
Alt+P abre o seletor de projetos.

O workspace de terminais usa os mesmos fundos de seleção e os mesmos controles.
Suas abas diferenciam a conversa ativa com borda e superfície.

## Superfícies

Cabeçalhos de página não têm linha divisória. O título usa 22 px e o ícone usa a cor primária.
Cards usam uma borda e fundo `card`, sem sombra.
Listas agrupadas possuem uma moldura externa; linhas internas compartilham separadores.
A conversa usa mensagens neutras e um compositor com ações compactas.

Dialog, sheet, popover, select e menus portam para `[data-theme-root]`.
Dialogs possuem header, corpo rolável e footer com ações à direita.
Menus possuem padding externo e itens com cantos retos.

Superfícies roláveis usam apenas `shadow-xs` ou `shadow-sm`, ambas sem blur.
Sombras com blur ficam nos overlays, conforme a medição de desempenho do desktop.
Movimento respeita `prefers-reduced-motion`.
