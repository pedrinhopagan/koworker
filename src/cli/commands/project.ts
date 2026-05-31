import { dbProjects } from "@/api/db/projects";
import { parseArgs } from "../args";
import { assertHexColor, canonicalPath } from "../resolve";

export function runProject(args: string[]): Promise<void> {
	const [sub, ...rest] = args;

	if (sub === "list") {
		return runProjectList();
	}
	if (sub === "create") {
		return runProjectCreate(rest);
	}
	if (sub === "set") {
		return runProjectSet(rest);
	}

	throw new Error(
		`Subcomando desconhecido: project ${sub ?? ""}. Use: project list | project create | project set`,
	);
}

async function runProjectList(): Promise<void> {
	const projects = await dbProjects.getAll();

	for (const project of projects) {
		console.log(`${project.id}\t${project.name}\t${project.main_route}`);
	}
}

async function runProjectCreate(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const name = positionals.join(" ").trim();
	if (!name) {
		throw new Error(
			"Uso: kowork project create <nome> [--route <caminho>] [--color #rrggbb] [--desc ...]",
		);
	}

	// Sem --route, registra o cwd: 'kowork project create "Meu Projeto"' fica registrando o
	// diretório atual, que é o caso comum.
	const mainRoute = flags.route?.trim() || canonicalPath(process.cwd());

	const id = crypto.randomUUID();
	await dbProjects.create({
		id,
		name,
		description: flags.desc,
		color: assertHexColor(flags.color),
		main_route: mainRoute,
	});

	console.log(`✅ Projeto "${name}" criado (com rotas padrão).`);
	console.log(`projectId: ${id}`);
	console.log(mainRoute);
}

async function runProjectSet(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const id = positionals[0];
	if (!id) {
		throw new Error(
			"Uso: kowork project set <id> [--name ...] [--route ...] [--color #rrggbb] [--desc ...]",
		);
	}

	const project = await dbProjects.getById(id);
	if (!project) {
		throw new Error(`Projeto não encontrado: ${id}`);
	}

	await dbProjects.update({
		id,
		name: flags.name,
		description: flags.desc,
		color: assertHexColor(flags.color),
		main_route: flags.route,
	});

	console.log(`✅ Projeto "${flags.name ?? project.name}" atualizado.`);
}
