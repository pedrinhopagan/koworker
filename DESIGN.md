# Sistema visual do Koworker

A interface segue a base visual do [T3 Code](https://github.com/pingdotgg/t3code), adaptada aos componentes Radix existentes.
A referência é a revisão `8bc40b4e07bb7b4b0f71876d59520360c9bf958c`.
Os tokens vêm de `apps/web/src/index.css`; controles e navegação vêm de `apps/web/src/components/ui/`.
A atribuição está em `third-party/T3-CODE-LICENSE`.

## Paleta e tipografia

O tema claro usa canvas zinc quase branco, cards brancos e navegação zinc-50.
O tema escuro usa canvas neutral-950, superfícies discretamente elevadas e sidebar preta.
As bordas separam superfícies; a seleção usa um fundo neutro.

O azul do T3 é a cor primária nos dois temas.
As cores dos projetos continuam identificando projetos e seus conteúdos.
Sucesso, alerta e erro possuem cores próprias, independentes da cor primária.

A interface usa a fonte do sistema. Código, caminhos e identificadores usam uma fonte monoespaçada.
Títulos usam caixa normal. Metadata tem menos contraste que o conteúdo.

## Geometria e controles

Os raios vêm de `src/index.css`: 6 px em detalhes, 8 px em controles, 10 px em campos e 14 px em cards.
Dialogs e compositores usam o próximo degrau, de 18 px.
Círculos ficam em status, avatares, switches e ações circulares.

Botões de desktop medem 32 px; botões compactos medem 28 px.
No celular, os botões comuns e os ícones mantêm alvos de 44 px.
Ações principais usam azul. Ações secundárias usam `outline`, `ghost` ou `ghost-muted`.

Campos usam superfície neutra, borda discreta e foco visível.
Selects usam `CustomSelect`, com itens arredondados dentro de uma superfície de popover.
Todos os ícones de interface vêm de Lucide.

## Navegação

A sidebar reúne projeto em foco e páginas agrupadas.
A seleção possui fundo neutro e texto destacado.
A sidebar mantém o modo compacto escolhido pelo usuário.

O topo mostra projeto e página atual, voltar, busca de páginas e troca de tema.
A busca abre com Ctrl+K ou Cmd+K e aceita setas, Enter e Escape.
Ctrl+B ou Cmd+B recolhe a sidebar. Os atalhos Alt+0 a Alt+9 continuam disponíveis.
Alt+P abre o seletor de projetos.

O workspace de terminais usa os mesmos fundos de seleção e os mesmos controles.
Suas abas diferenciam a conversa ativa com borda e superfície.

## Superfícies

Cards usam uma borda, fundo `card` e raio `xl`.
Listas agrupadas possuem uma moldura externa; linhas internas compartilham separadores.
A conversa usa mensagens neutras e um compositor arredondado com ações compactas.

Dialog, sheet, popover, select e menus portam para `[data-theme-root]`.
Dialogs possuem header, corpo rolável e footer com ações à direita.
Menus possuem padding externo e itens com raio menor que a superfície.

Superfícies roláveis usam apenas `shadow-xs` ou `shadow-sm`, ambas sem blur.
Sombras com blur ficam nos overlays, conforme a medição de desempenho do desktop.
Movimento respeita `prefers-reduced-motion`.
