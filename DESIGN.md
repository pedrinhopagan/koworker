# Sistema visual do Kowork

## Tema: Oficina editorial

O Kowork é uma bancada de trabalho para projetos, tarefas, documentos e agents. O visual combina a clareza editorial dos melhores painéis do Collect UI com a linguagem utilitária de um terminal: quente, preciso, denso onde há dados e espaçoso onde há decisão.

O elemento memorável é o contraste entre uma estrutura monocromática, de linhas retas, e uma única assinatura de cor herdada do projeto em foco.

## Direção

- **Densidade:** confortável no shell e nos formulários; compacta apenas em listas, tabelas, terminais e barras de status.
- **Paleta:** papel mineral no claro e grafite quente no escuro. A cor primária e a cor do projeto não decoram: indicam ação, seleção e progresso.
- **Geometria:** cantos retos. Círculos ficam reservados a status, presença, avatares e controles que realmente giram.
- **Profundidade:** superfícies roláveis usam borda e `shadow-xs`/`shadow-sm` rente. Blur começa somente em overlays.
- **Tipografia:** a fonte da interface carrega títulos e corpo; a fonte de leitura fica nos documentos. Código, paths, ids e números operacionais usam mono e algarismos tabulares.
- **Movimento:** 150–250 ms, apenas cor, opacidade e transform. Uma entrada discreta por página; nenhum movimento ambiente sem estado real.

## Hierarquia de tinta

Há três intensidades:

1. `foreground`: título, valor e ação principal.
2. `muted-foreground`: corpo, rótulo e controle secundário.
3. `muted-foreground/60`: metadata, atalho e detalhe auxiliar.

Cor saturada só aparece em ação primária, seleção, status semântico e assinatura do projeto.

## Anatomias

### Shell

A sidebar tem marca, projeto em foco, navegação agrupada e controle de recolhimento. A barra superior é chrome de janela e contexto, não uma segunda navegação. Prompt e status fecham o quadro sem competir com a página.

### Página

O `PageShell` possui header estável, com ícone em bloco, eyebrow “Workspace”, título, descrição e uma área de ações. O conteúdo começa depois de um único intervalo vertical e ocupa até `82rem`.

### Card

Card padrão: `bg-card`, uma borda, sombra rente e padding de 20–24 px. Header, conteúdo e footer seguem o mesmo eixo. Card clicável muda borda e superfície no hover; não salta mais de 1 px.

### Listas e tabelas

Uma moldura externa possui o fundo e a borda; linhas internas usam `divide-y`. Headers são pequenos, em caixa alta e com tracking. Valores ficam mais fortes que labels. Números alinham e usam tabular.

### Formulários

Labels sempre visíveis. Inputs têm 40 px no fluxo confortável e 36 px no compacto. Placeholder é exemplo, não label. Foco usa uma única ring de 1 px. Erro aparece junto ao campo.

### Overlays

Dialog, sheet, popover, select e menus portam para `[data-theme-root]`. Usam superfície `popover`, borda nítida e sombra com blur. Dialog: header fixo, corpo rolável, footer fixo e ações à direita.

### Estados vazios

Ícone em bloco, título curto, uma frase de orientação e, quando existe próximo passo, uma única ação.

## Regras de consistência

- Um conceito tem uma anatomia compartilhada; variantes mudam tokens, não estrutura.
- Um separador é desenhado por um único elemento.
- Ícones Lucide usam 16 px em controles, 18–20 px em navegação e 20–24 px em empty states.
- Ações primárias são únicas por tela. As demais são `outline` ou `ghost`.
- `primary` nunca substitui cor semântica de sucesso, alerta ou erro.
- Hex e famílias de cor Tailwind não entram em componentes de produto; exceções são cores persistidas pelo usuário/projeto.
- Mobile preserva alvos de toque de 44 px, mesmo quando o desktop é compacto.

## Referência Collect UI

Do Collect UI, o Kowork adota a composição clara por blocos, headers com hierarquia inequívoca, cards com uma função por superfície, filtros alinhados e vazios orientados à ação. Não copia uma tela específica: aplica essa gramática ao fluxo real do produto e mantém a identidade quente, quadrada e operacional do Kowork.
