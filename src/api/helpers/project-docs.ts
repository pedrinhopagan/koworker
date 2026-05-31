import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

// Arquivos de agente/contexto reconhecidos em qualquer pasta do projeto. São os `.md` "principais"
// que a rota /projetos lista abaixo dos atalhos — distintos dos `.md` soltos do vault, que vivem em
// `.koworker/`. Conjunto fechado: define tanto o que se lista quanto o que se pode sobrescrever.
export const PROJECT_DOC_NAMES = [
	"CLAUDE.md",
	"AGENTS.md",
	"GEMINI.md",
	"README.md",
	"CONTRIBUTING.md",
] as const;

// Pastas que a busca recursiva nunca desce: dependências e artefatos onde esses nomes aparecem
// copiados, sem relação com a documentação do projeto. Pastas ocultas (`.git`, `.next`, `.koworker`,
// `.venv`…) também ficam de fora pelo prefixo ".".
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "out", "target", "vendor", "coverage"]);

export type ProjectDoc = {
	// Caminho relativo à raiz do projeto, com separadores `/`, ex: "apps/front/CLAUDE.md".
	path: string;
	name: string;
	// Pasta do arquivo como rótulo de rota, ex: "/apps/front/" — "/" quando está na raiz.
	dirLabel: string;
	content: string;
};

// Varre o projeto atrás dos docs principais em qualquer profundidade, pulando dependências e
// pastas ocultas. Devolve ordenado por caminho.
export async function listProjectDocs(projectRoute: string): Promise<ProjectDoc[]> {
	const matches: string[] = [];
	await collectDocs(projectRoute, matches);

	const docs = await Promise.all(
		matches.map(async (fullPath) => {
			const path = relative(projectRoute, fullPath).split(sep).join("/");
			return {
				path,
				name: path.split("/").at(-1) ?? path,
				dirLabel: toDirLabel(path),
				content: await Bun.file(fullPath).text(),
			};
		}),
	);

	return docs.sort((a, b) => a.path.localeCompare(b.path));
}

async function collectDocs(dir: string, matches: string[]): Promise<void> {
	const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);

	await Promise.all(
		entries.map(async (entry) => {
			if (entry.isDirectory()) {
				if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) return;
				await collectDocs(join(dir, entry.name), matches);
				return;
			}
			if (entry.isFile() && (PROJECT_DOC_NAMES as readonly string[]).includes(entry.name)) {
				matches.push(join(dir, entry.name));
			}
		}),
	);
}

function toDirLabel(path: string): string {
	const dir = dirname(path);
	return dir === "." ? "/" : `/${dir}/`;
}

// Sobrescreve um doc principal. O caminho já chega validado como relativo terminando num nome
// reconhecido; aqui resolvemos contra a raiz e confirmamos que o destino fica dentro do projeto e
// continua sendo um nome reconhecido — escrita não excede a leitura.
export async function writeProjectDoc(params: {
	projectRoute: string;
	path: string;
	content: string;
}): Promise<void> {
	const name = params.path.split("/").at(-1) ?? "";
	if (!(PROJECT_DOC_NAMES as readonly string[]).includes(name)) {
		throw new Error(`"${name}" não é um documento principal reconhecido`);
	}

	const root = resolve(params.projectRoute);
	const target = resolve(root, params.path);
	if (target !== root && !target.startsWith(root + sep)) {
		throw new Error("Caminho fora do projeto");
	}

	await Bun.write(target, params.content);
}
