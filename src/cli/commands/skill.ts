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
		return runSkillList();
	}

	throw new Error(`Subcomando desconhecido: skill ${sub ?? ""}. Use: skill style | skill list`);
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
async function runSkillList(): Promise<void> {
	const [records, settings] = await Promise.all([listSkillsFromFs(), dbSkillSettings.getAll()]);
	const bySlug = new Map(settings.map((row) => [row.slug, row]));

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
