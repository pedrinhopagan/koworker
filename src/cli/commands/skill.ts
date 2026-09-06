import { dbSkillCategories } from "@/api/db/skill-categories";
import { dbSkillSourcePaths } from "@/api/db/skill-source-paths";
import { applySkillSyncInFs, previewSkillSyncInFs } from "@/api/helpers/skills-sync";
import { deleteAllSkillInFs, getSkillFromFs, installSkillInFs } from "@/api/helpers/skills-fs";
import { SkillDeleteAllSchema } from "@/api/schemas/skills";
import { dbSkillSettings } from "@/api/db/skill-settings";
import { listSkillsFromFs } from "@/api/helpers/skills-fs";
import { parseArgs } from "../args";
import { assertHexColor } from "../resolve";

export function runSkill(args: string[]): Promise<void> {
	const [sub, ...rest] = args;

	if (sub === "style") {
		return runSkillStyle(rest);
	}
	if (sub === "list") {
		return runSkillList(rest);
	}

	if (sub === "install") {
		return runSkillInstall(rest);
	}
	if (sub === "paths") {
		return dbSkillSourcePaths.list().then((rows) => console.log(JSON.stringify(rows, null, 2)));
	}
	if (sub === "categories") {
		return dbSkillCategories.getAll().then((rows) => console.log(JSON.stringify(rows, null, 2)));
	}
	if (sub === "category") {
		return runSkillCategory(rest);
	}
	if (sub === "sync") {
		return runSkillSync(rest);
	}
	if (sub === "remove") {
		return runSkillRemove(rest);
	}

	throw new Error(
		`Subcomando desconhecido: skill ${sub ?? ""}. Use: skill style | list | paths | categories | category | install | sync | remove`,
	);
}

async function runSkillStyle(args: string[]): Promise<void> {
	const { positionals, flags } = parseArgs(args);
	const slug = positionals[0];
	if (!slug) {
		throw new Error("Uso: kw-cli skill style <slug> [--label ...] [--icon ...] [--color #rrggbb]");
	}

	if (flags.label === undefined && flags.icon === undefined && flags.color === undefined) {
		throw new Error("Informe ao menos um de --label, --icon ou --color.");
	}

	await dbSkillSettings.upsert({
		slug,
		label: flags.label,
		icon: flags.icon,
		color: assertHexColor(flags.color),
	});

	console.log(`✅ Aparência da skill "${slug}" atualizada.`);
}

// Lista as skills globais do disco com a aparência atual (label/icon/color) mesclada do banco.
async function runSkillList(args: string[]): Promise<void> {
	const [records, settings] = await Promise.all([listSkillsFromFs(), dbSkillSettings.getAll()]);
	const bySlug = new Map(settings.map((row) => [row.slug, row]));
	if (args.includes("--json")) {
		console.log(
			JSON.stringify(
				records.map((record) => ({
					...record,
					settings: bySlug.get(record.slug) ?? null,
				})),
				null,
				2,
			),
		);
		return;
	}

	for (const record of records) {
		const override = bySlug.get(record.slug);
		const style = override
			? [
					override.label && `label=${override.label}`,
					override.icon && `icon=${override.icon}`,
					override.color && `color=${override.color}`,
				]
					.filter(Boolean)
					.join(" ")
			: "";
		console.log(`${record.slug}\t${record.name}${style ? `\t${style}` : ""}`);
	}
}

async function runSkillCategory(args: string[]) {
	const [slug, category] = args;
	if (!slug || !category) {
		throw new Error("Uso: kw-cli skill category <slug> <categoria-id|nome>");
	}
	SkillDeleteAllSchema.parse({ slug });
	if (!(await getSkillFromFs(slug))) {
		throw new Error("Skill não encontrada");
	}
	const categories = await dbSkillCategories.getAll();
	const chosen =
		categories.find((row) => row.id === category) ??
		(await dbSkillCategories.findByNormalizedName(category));
	if (!chosen) {
		throw new Error("Categoria não encontrada. Consulte kw-cli skill categories");
	}
	await dbSkillSettings.upsert({ slug, categoryId: chosen.id });
	console.log(`Skill ${slug}: ${chosen.name}`);
}

async function runSkillSync(args: string[]) {
	const { positionals, flags } = parseArgs(args);
	const slug = positionals[0];
	if (slug) {
		SkillDeleteAllSchema.parse({ slug });
	}
	const plan = await previewSkillSyncInFs(slug);
	if (flags.preview !== undefined) {
		console.log(JSON.stringify(plan, null, 2));
		return;
	}
	const choices = plan.skills.flatMap((skill) => {
		if (!flags.source) {
			return [];
		}
		const chosen = skill.sources.find((source) => source.tool === flags.source);
		if (!chosen) {
			throw new Error(`Fonte ${flags.source} não encontrada para ${skill.slug}`);
		}
		return [{ slug: skill.slug, sourcePath: chosen.path, hash: chosen.hash }];
	});
	console.log(
		JSON.stringify(await applySkillSyncInFs({ planHash: plan.planHash, choices, slug }), null, 2),
	);
}

async function runSkillRemove(args: string[]) {
	const input = SkillDeleteAllSchema.parse({ slug: args[0] });
	const result = await deleteAllSkillInFs(input);
	await dbSkillSettings.remove(input.slug);
	console.log(JSON.stringify(result, null, 2));
}

async function runSkillInstall(args: string[]) {
	const { positionals, flags } = parseArgs(args);
	const sourceDir = positionals[0];
	if (!sourceDir || !flags.category) {
		throw new Error("Uso: kw-cli skill install <pasta> --category <id|nome> [--replace]");
	}
	const category =
		(await dbSkillCategories.getAll()).find((row) => row.id === flags.category) ??
		(await dbSkillCategories.findByNormalizedName(flags.category));
	if (!category) {
		throw new Error("Categoria não encontrada. Consulte kw-cli skill categories");
	}
	const result = await installSkillInFs({
		sourceDir,
		replace: flags.replace !== undefined,
	});
	await dbSkillSettings.upsert({ slug: result.slug, categoryId: category.id });
	console.log(JSON.stringify({ ...result, category: category.name }, null, 2));
}
