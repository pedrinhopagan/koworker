import { dbProjectRoutes } from "@/api/db/project-routes";
import { dbProjects } from "@/api/db/projects";
import { parseArgs } from "../args";

export function runRoute(args: string[]): Promise<void> {
	const [sub, ...rest] = args;

	if (sub === "add") {
		return runRouteAdd(rest);
	}
	if (sub === "rm") {
		return runRouteRm(rest);
	}

	throw new Error(`Subcomando desconhecido: route ${sub ?? ""}. Use: route add | route rm`);
}

async function runRouteAdd(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const [projectId, name] = positionals;
	if (!projectId || !name) {
		throw new Error(
			"Uso: kw-cli route add <projetoId> <nome> [--command ...] [--icon ...] [--route <caminho>]",
		);
	}

	const project = await dbProjects.getById(projectId);
	if (!project) {
		throw new Error(`Projeto não encontrado: ${projectId}`);
	}

	const id = crypto.randomUUID();
	await dbProjectRoutes.create({
		id,
		project_id: project.id,
		name,
		route: flags.route?.trim() || project.main_route,
		icon: flags.icon,
		command: flags.command,
	});

	console.log(`✅ Rota "${name}" adicionada ao projeto "${project.name}".`);
	console.log(`routeId: ${id}`);
}

async function runRouteRm(args: string[]): Promise<void> {
	const id = args[0];
	if (!id) {
		throw new Error("Uso: kw-cli route rm <routeId>");
	}

	const route = await dbProjectRoutes.getById(id);
	if (!route) {
		throw new Error(`Rota não encontrada: ${id}`);
	}

	await dbProjectRoutes.delete(id);
	console.log(`🗑️  Rota "${route.name}" removida.`);
}
