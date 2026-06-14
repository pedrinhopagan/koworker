import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { HeadingAnchor } from "@/lib/heading-anchor";

// Identidade estável de um documento, independente da URL. A âncora de leitura é indexada por esta
// chave — assim mover o arquivo ativo da tarefa pra URL (Slice B) não invalida a memória de scroll.
// É a chave central compartilhada por todas as superfícies de doc (tarefa/vault/docs/skill).
export type DocSessionParams =
	| { kind: "task"; taskId: string; file: string }
	| { kind: "vault"; projectId: string; fileName: string }
	| { kind: "docs"; projectId: string; path: string }
	| { kind: "skill"; variantPath: string }
	| { kind: "agent"; variantPath: string };

export function docSessionKey(params: DocSessionParams): string {
	switch (params.kind) {
		case "task":
			return `task:${params.taskId}:${params.file}`;
		case "vault":
			return `vault:${params.projectId}:${params.fileName}`;
		case "docs":
			return `docs:${params.projectId}:${params.path}`;
		case "skill":
			return `skill:${params.variantPath}`;
		case "agent":
			return `agent:${params.variantPath}`;
	}
}

// Entrada no MRU (most-recently-used) de sessões — alimenta o switcher Alt+`. `nav` reconstrói a
// rota; `projectId` restaura o foco de projeto nas superfícies que dependem dele (vault/skill) e não
// da URL. A âncora de leitura não vive aqui: o switcher a lê do mapa `anchors` pela mesma `key`.
export type DocSessionMeta = {
	key: string;
	kind: DocSessionParams["kind"];
	title: string;
	// Linha secundária no card: nome do arquivo (tarefa/vault), slug (skill) ou diretório (docs).
	subtitle?: string;
	projectName?: string;
	projectId?: string;
	// Ícone próprio da skill (nome lucide + cor); nas outras superfícies o card usa o ícone do kind.
	icon?: string;
	iconColor?: string;
	nav: { to: string; params: Record<string, string> };
	lastVisited: number;
	// Fixada manualmente: nunca expira pelo teto e sobrevive ao "Limpar recentes".
	pinned?: boolean;
};

// Inverso parcial de `docSessionKey`, só pro agrupamento do switcher: arquivos da mesma tarefa
// compartilham o taskId entre os dois primeiros `:`. As outras superfícies não têm entidade-pai e
// entram como cards soltos, então devolvem null.
function taskIdFromKey(key: string): string | null {
	if (!key.startsWith("task:")) {
		return null;
	}
	const rest = key.slice("task:".length);
	const sep = rest.indexOf(":");
	return sep === -1 ? null : rest.slice(0, sep);
}

// `flatIndex` é a posição do card na sequência achatada `cards` (== ordem de render). Realce e hover
// são por posição. Cada chave aparece uma única vez: fixadas saem do geral e ficam só na seção "Fixadas".
export type SessionGroupCard = DocSessionMeta & { isCurrent: boolean; flatIndex: number };

// Toda caixa do overlay é um bloco com cabeçalho + cards: uma tarefa (cabeçalho = título da tarefa,
// arquivos juntos) ou um kind avulso (cabeçalho = "Vault"/"Docs"/"Skills", os cards daquele kind no
// projeto colapsados numa caixa). Não há mais card nu — todo card vive dentro de uma caixa.
export type SessionBlock =
	| { type: "task"; taskId: string; title: string; cards: SessionGroupCard[] }
	| { type: "kind"; kind: DocSessionParams["kind"]; cards: SessionGroupCard[] };

export type SessionProjectGroup = { projectName: string | null; blocks: SessionBlock[] };

// Agrupa o MRU pro switcher em projeto → (caixa de tarefa | caixa de kind) → cards. A entrada já vem
// em ordem MRU (mais recente primeiro), então a primeira aparição de cada projeto/tarefa/kind define a
// ordem — o trabalho mais recente flutua pro topo. A caixa de kind colapsa os cards do mesmo kind na
// posição do PRIMEIRO deles, então cards soltos não-contíguos do mesmo kind sobem pra caixa: o achatado
// reordena de propósito. `cards` é a mesma sequência achatada na ordem renderizada — é por ela que o
// teclado cicla, e ordem-de-render == ordem-do-flatten vale por construção (ambas derivam de `blocks`).
export function groupSessions(
	list: DocSessionMeta[],
	currentKey: string | null,
	// Ordem canônica das seções de projeto (nomes em display_order, vinda de `projects.list`). Sem ela,
	// os grupos ficam na ordem de primeira aparição no MRU — que flutua a cada visita/remoção. Com ela, a
	// ordem das seções é estável e igual à do app; nomes ausentes caem depois dos conhecidos e "Sem
	// projeto" (null) por último. Os cards dentro de cada grupo seguem MRU em qualquer caso.
	projectOrder?: string[],
): {
	pinned: SessionGroupCard[];
	skills: SessionGroupCard[];
	agents: SessionGroupCard[];
	groups: SessionProjectGroup[];
	cards: SessionGroupCard[];
} {
	const groups: SessionProjectGroup[] = [];
	const byProject = new Map<string | null, SessionProjectGroup>();
	// Chaveado só pelo taskId: uma tarefa pertence a um único projeto, sem colisão entre eles.
	const byTask = new Map<string, Extract<SessionBlock, { type: "task" }>>();
	// A caixa de kind é por projeto — o mesmo kind ("Vault"/"Docs") reaparece em projetos diferentes —,
	// então o índice é por grupo. Chaveado pelo objeto do grupo: byProject já garante um grupo por projeto.
	const byKind = new Map<
		SessionProjectGroup,
		Map<string, Extract<SessionBlock, { type: "kind" }>>
	>();

	// Skills são globais (sem vínculo de projeto): saem dos grupos pra uma seção própria, FLAT. Dedupe por
	// slug porque a mesma skill visitada sob projetos diferentes deixou chaves distintas no MRU (legado).
	const skills: SessionGroupCard[] = [];
	const seenSkill = new Set<string>();

	// Agents são globais e únicos como as skills: mesma seção FLAT, mesmo dedupe por slug.
	const agents: SessionGroupCard[] = [];
	const seenAgent = new Set<string>();

	function toCard(meta: DocSessionMeta): SessionGroupCard {
		return { ...meta, isCurrent: meta.key === currentKey, flatIndex: 0 };
	}

	for (const meta of list) {
		const card = toCard(meta);

		// Fixadas vivem só na seção "Fixadas": saem do geral (grupos de projeto e Skills) pra não duplicar.
		if (meta.pinned) {
			continue;
		}

		if (meta.kind === "skill") {
			const slug = meta.nav.params.slug ?? meta.key;
			if (!seenSkill.has(slug)) {
				seenSkill.add(slug);
				skills.push(card);
			}
			continue;
		}

		if (meta.kind === "agent") {
			const slug = meta.nav.params.slug ?? meta.key;
			if (!seenAgent.has(slug)) {
				seenAgent.add(slug);
				agents.push(card);
			}
			continue;
		}

		const projectName = meta.projectName ?? null;

		let group = byProject.get(projectName);
		if (!group) {
			group = { projectName, blocks: [] };
			byProject.set(projectName, group);
			groups.push(group);
		}

		const taskId = taskIdFromKey(meta.key);
		if (taskId) {
			let block = byTask.get(taskId);
			if (!block) {
				block = { type: "task", taskId, title: meta.title, cards: [] };
				byTask.set(taskId, block);
				group.blocks.push(block);
			}
			block.cards.push(card);
			continue;
		}

		let kindMap = byKind.get(group);
		if (!kindMap) {
			kindMap = new Map();
			byKind.set(group, kindMap);
		}
		let kindBlock = kindMap.get(meta.kind);
		if (!kindBlock) {
			kindBlock = { type: "kind", kind: meta.kind, cards: [] };
			kindMap.set(meta.kind, kindBlock);
			group.blocks.push(kindBlock);
		}
		kindBlock.cards.push(card);
	}

	// Seção "Fixadas" no topo: os fixados em ordem MRU, FLAT (sem caixas por kind — é cross-cutting de
	// projetos/kinds). Os fixados foram pulados no loop acima, então só aparecem aqui.
	const pinned = list.filter((meta) => meta.pinned).map(toCard);

	// Reordena as seções pela ordem canônica do app (se fornecida). `sort` é estável, então projetos de
	// mesmo rank (ausentes do projectOrder, ou ambos null) preservam a ordem MRU de primeira aparição.
	if (projectOrder) {
		const rank = (name: string | null): number => {
			if (name === null) {
				return Number.MAX_SAFE_INTEGER;
			}
			const index = projectOrder.indexOf(name);
			return index === -1 ? Number.MAX_SAFE_INTEGER - 1 : index;
		};
		groups.sort((a, b) => rank(a.projectName) - rank(b.projectName));
	}

	// Ordem de render = Fixadas, grupos de projeto, Skills e Agents (seções globais, no fim). `cards` é o
	// achatamento nessa ordem; o flatIndex de cada card é sua posição. Como fixadas não duplicam no geral,
	// cada chave ocupa uma única posição.
	const cards = [
		...pinned,
		...groups.flatMap((group) => group.blocks.flatMap((block) => block.cards)),
		...skills,
		...agents,
	];
	cards.forEach((card, index) => {
		card.flatIndex = index;
	});

	return { pinned, skills, agents, groups, cards };
}

// Índice inicial da seleção do teclado no switcher: o doc anterior — o primeiro não-atual na ordem MRU
// — mapeado pra sua posição na sequência agrupada. O agrupamento reordena, então "primeiro não-atual
// na ordem de render" não serve: seria um doc mais velho do mesmo projeto. Isto preserva o flick-pro-
// anterior do Alt+Tab. Cai em 0 se a lista só tiver a sessão atual (o switcher não abre nesse caso).
export function initialSwitcherIndex(
	list: DocSessionMeta[],
	currentKey: string | null,
	projectOrder?: string[],
): number {
	const { cards } = groupSessions(list, currentKey, projectOrder);
	const previousKey = list.find((r) => r.key !== currentKey)?.key;
	const index = cards.findIndex((c) => c.key === previousKey);
	return Math.max(index, 0);
}

// Índice (em `cards`) do primeiro card de cada bloco/caixa, em ordem de render: a seção Fixadas (se
// houver) e depois cada bloco de cada grupo. Cada bloco ocupa uma faixa contígua no achatado, então o
// "começo" basta pra mapear posição→caixa — é por aqui que o ↑↓ pula entre caixas.
export function blockStartIndices(
	list: DocSessionMeta[],
	currentKey: string | null,
	projectOrder?: string[],
): number[] {
	const { pinned, skills, agents, groups } = groupSessions(list, currentKey, projectOrder);
	const starts: number[] = [];
	let index = 0;
	if (pinned.length > 0) {
		starts.push(index);
		index += pinned.length;
	}
	for (const group of groups) {
		for (const block of group.blocks) {
			starts.push(index);
			index += block.cards.length;
		}
	}
	if (skills.length > 0) {
		starts.push(index);
		index += skills.length;
	}
	if (agents.length > 0) {
		starts.push(index);
	}
	return starts;
}

// Salta a seleção uma caixa pra frente/trás: acha a caixa que contém o índice atual (o maior começo
// ≤ índice) e vai pro começo da vizinha, clampando nas pontas (sem wrap, ao contrário do ←→).
export function jumpToBlock(starts: number[], index: number, direction: 1 | -1): number {
	let pos = 0;
	for (let k = 0; k < starts.length; k++) {
		if (starts[k] <= index) {
			pos = k;
		} else {
			break;
		}
	}
	const next = Math.min(Math.max(pos + direction, 0), starts.length - 1);
	return starts[next] ?? index;
}

// Cards distintos por chave (1ª ocorrência), na ordem do achatado — o mapeamento dos atalhos 1–9. O
// fixado duplicado conta uma vez, e o dígito leva à sua 1ª ocorrência (a da seção Fixadas).
export function distinctCards(cards: SessionGroupCard[]): SessionGroupCard[] {
	const seen = new Set<string>();
	const distinct: SessionGroupCard[] = [];
	for (const card of cards) {
		if (!seen.has(card.key)) {
			seen.add(card.key);
			distinct.push(card);
		}
	}
	return distinct;
}

// Teto do mapa de âncoras pra não inchar o localStorage. Re-salvar reordena pro fim (LRU);
// ao exceder, descarta as mais antigas.
const ANCHOR_CAP = 200;

// O switcher só mostra um punhado de sessões; manter a lista curta evita inchar o storage. O teto
// vale só pras automáticas: fixadas ficam sempre (custo é deliberado), então a lista pode passar de
// 12 quando há muitas pinadas.
const RECENTS_CAP = 12;

// Mantém a ordem MRU; ao exceder o teto, descarta as não-fixadas mais antigas (do fim) até caber.
function capRecents(list: DocSessionMeta[]): DocSessionMeta[] {
	if (list.length <= RECENTS_CAP) {
		return list;
	}
	const next = [...list];
	for (let i = next.length - 1; i >= 0 && next.length > RECENTS_CAP; i--) {
		if (!next[i].pinned) {
			next.splice(i, 1);
		}
	}
	return next;
}

interface DocSessionsState {
	anchors: Record<string, HeadingAnchor>;
	getAnchor: (key: string) => HeadingAnchor | null;
	saveAnchor: (key: string, anchor: HeadingAnchor) => void;
	recents: DocSessionMeta[];
	recordVisit: (meta: Omit<DocSessionMeta, "lastVisited">) => void;
	togglePin: (key: string) => void;
	removeRecent: (key: string) => void;
	// Remove todas as sessões cuja chave começa por `prefix` — uma tarefa tem uma sessão por arquivo.
	removeRecentsByPrefix: (prefix: string) => void;
	// Remove em lote pelas chaves exatas — o switcher fecha de uma vez todos os arquivos de uma tarefa
	// ou de um projeto, derivando as chaves dos cards já agrupados. Tira fixadas também, como o X de cada
	// card; chave única cobre as duas ocorrências de um fixado (Fixadas + grupo).
	removeRecentsByKeys: (keys: string[]) => void;
	// Limpa só as automáticas; fixadas permanecem (é o propósito de fixar).
	clearLoose: () => void;
}

export const useDocSessionsStore = create<DocSessionsState>()(
	persist(
		(set, get) => ({
			anchors: {},
			getAnchor: (key) => get().anchors[key] ?? null,
			saveAnchor: (key, anchor) =>
				set((state) => {
					const next: Record<string, HeadingAnchor> = {};
					for (const [existing, value] of Object.entries(state.anchors)) {
						if (existing !== key) {
							next[existing] = value;
						}
					}
					next[key] = anchor;

					const keys = Object.keys(next);
					if (keys.length > ANCHOR_CAP) {
						for (const stale of keys.slice(0, keys.length - ANCHOR_CAP)) {
							delete next[stale];
						}
					}

					return { anchors: next };
				}),
			recents: [],
			recordVisit: (meta) =>
				set((state) => {
					// Re-gravar preserva o pin: o dwell não deve desfixar uma sessão fixada.
					const prev = state.recents.find((r) => r.key === meta.key);
					const entry: DocSessionMeta = {
						...meta,
						pinned: prev?.pinned ?? false,
						lastVisited: Date.now(),
					};
					const next = [entry, ...state.recents.filter((r) => r.key !== meta.key)];
					return { recents: capRecents(next) };
				}),
			togglePin: (key) =>
				set((state) => ({
					recents: state.recents.map((r) => (r.key === key ? { ...r, pinned: !r.pinned } : r)),
				})),
			removeRecent: (key) =>
				set((state) => ({ recents: state.recents.filter((r) => r.key !== key) })),
			removeRecentsByPrefix: (prefix) =>
				set((state) => ({ recents: state.recents.filter((r) => !r.key.startsWith(prefix)) })),
			removeRecentsByKeys: (keys) =>
				set((state) => {
					const drop = new Set(keys);
					return { recents: state.recents.filter((r) => !drop.has(r.key)) };
				}),
			clearLoose: () => set((state) => ({ recents: state.recents.filter((r) => r.pinned) })),
		}),
		{
			name: "doc-sessions-storage",
			partialize: (state) => ({ anchors: state.anchors, recents: state.recents }),
		},
	),
);
