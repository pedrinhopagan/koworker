import { dbProjects } from "@/api/db/projects";
import { applyTaskStorage } from "@/api/helpers/task-storage-coordinator";
import { previewTaskStorage } from "@/api/helpers/task-storage-scan";
import { hasFlag, parseArgs } from "../args";
import { resolveProjectByCwd } from "../resolve";
import { runBackup } from "./backup";

export function runStorage(args: string[]): Promise<void> {
	const [sub, ...rest] = args;

	if (sub === "preview") {
		return runStoragePreview(rest);
	}
	if (sub === "reconcile" || sub === "sync") {
		return runStorageReconcile(rest);
	}

	throw new Error(
		`Subcomando desconhecido: storage ${sub ?? ""}. Use: storage preview | storage reconcile`,
	);
}

async function selectedProjects(args: string[]) {
	const { flags } = parseArgs(args);
	if (hasFlag(flags, "all")) {
		return await dbProjects.getAll();
	}

	const project = await resolveProjectByCwd();
	if (!project) {
		throw new Error(
			`Nenhum projeto koworker registrado para ${process.cwd()}. Use --all ou rode no diretório de um projeto.`,
		);
	}

	return [project];
}

async function runStoragePreview(args: string[]) {
	const projects = await selectedProjects(args);
	console.log("projeto\tversão\ta mover\tcorretas\tbloqueios\tórfãs");
	for (const project of projects) {
		const plan = await previewTaskStorage(project.id);
		console.log(
			[
				project.name,
				`${plan.fromLayoutVersion}→${plan.toLayoutVersion}`,
				plan.totals.toApply,
				plan.totals.correct,
				plan.totals.blocked,
				plan.totals.orphaned,
			].join("\t"),
		);
	}
}

async function runStorageReconcile(args: string[]) {
	const projects = await selectedProjects(args);
	const plans = await Promise.all(
		projects.map(async (project) => ({ project, plan: await previewTaskStorage(project.id) })),
	);
	const blocked = plans.filter(({ plan }) => plan.totals.blocked > 0 || plan.totals.orphaned > 0);
	const ready = plans.filter(
		({ plan }) =>
			plan.totals.blocked === 0 &&
			plan.totals.orphaned === 0 &&
			(plan.totals.toApply > 0 || plan.fromLayoutVersion !== plan.toLayoutVersion),
	);

	if (ready.length === 0) {
		console.log("Nenhum projeto pronto para reconciliar.");
		printBlocked(blocked);
		return;
	}

	await runBackup(["run"]);

	const failed: { name: string; error: string }[] = [];
	for (const { project, plan } of ready) {
		try {
			await applyTaskStorage({ projectId: project.id, planHash: plan.planHash, confirmed: true });
			const verified = await previewTaskStorage(project.id);
			if (
				verified.fromLayoutVersion !== verified.toLayoutVersion ||
				verified.totals.blocked > 0 ||
				verified.totals.orphaned > 0 ||
				verified.totals.toApply > 0
			) {
				throw new Error("A verificação final não retornou um plano zerado");
			}
			console.log(`✅ ${project.name}: storage reconciliado.`);
		} catch (error) {
			failed.push({
				name: project.name,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	printBlocked(blocked);
	for (const failure of failed) {
		console.log(`❌ ${failure.name}: ${failure.error}`);
	}
}

function printBlocked(
	blocked: { project: { name: string }; plan: { totals: { blocked: number; orphaned: number } } }[],
) {
	for (const { project, plan } of blocked) {
		console.log(
			`⏭️  ${project.name}: ${plan.totals.blocked} bloqueio(s), ${plan.totals.orphaned} pasta(s) órfã(s).`,
		);
	}
}
