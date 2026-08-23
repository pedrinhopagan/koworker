import { readdir } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

const IMAGE_EXTENSIONS = new Set([".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const SKIPPED_DIRECTORIES = new Set([
	".cache",
	".git",
	".next",
	".output",
	".turbo",
	".venv",
	"build",
	"coverage",
	"dist",
	"node_modules",
	"out",
	"target",
	"vendor",
]);
const MAX_SCAN_DEPTH = 5;

const PROJECT_LOGO_OVERRIDES: Record<string, string> = {
	"aab-arquitetura": "src/assets/Logos/logo-almond.svg",
	"advocacia-orlandi": "web/src/assets/icon.svg",
	"dogama-app": "apps/front/public/icons/icon-512.png",
	"dogama-app-worktree-1": "apps/front/public/icons/icon-512.png",
	grind: "assets/icon.svg",
	"grind-rpg": "assets/icon.svg",
	jupe: "apps/front/public/jupe_logo.svg",
	koworker: "static/logo.svg",
	"kw-code": "apps/desktop/resources/icon.png",
	"kw-diff": "assets/icon.svg",
	"kw-lawyer": "apps/web/public/logo.svg",
	"kw-terminal": "assets/logo.svg",
	"lp-eng-lenzi": "public/brand/logo.svg",
	"lp-gustavo-biagini": "public/logo/logo.png",
	"lp-ker-cabana": "public/logo/icon-512.png",
	"lp-pizza-napoletana": "public/favicon.svg",
	"next-portfolio": "public/pedro_logo.svg",
	"pagan-agency": "apps/web/public/icon.svg",
};

function scoreLogo(relativePath: string) {
	const normalized = relativePath.toLowerCase();
	const name = basename(normalized, extname(normalized));
	let score = 0;

	if (name === "logo" || name === "logomark") {
		score += 100;
	}
	if (name === "icon" || name === "app-icon" || name === "app_icon") {
		score += 80;
	}
	if (name.includes("logo")) {
		score += 60;
	}
	if (name.includes("icon")) {
		score += 40;
	}
	if (name.includes("favicon")) {
		score += 20;
	}
	if (normalized.includes("/public/") || normalized.includes("/static/")) {
		score += 15;
	}
	if (normalized.includes("/assets/") || normalized.includes("/brand/")) {
		score += 10;
	}
	if (normalized.includes("placeholder") || normalized.includes("apple-touch")) {
		score -= 30;
	}

	return score - relativePath.split(/[\\/]/).length * 2;
}

async function findLogoCandidates(projectRoot: string) {
	const candidates: { path: string; score: number }[] = [];

	async function scan(directory: string, depth: number) {
		if (depth > MAX_SCAN_DEPTH) {
			return;
		}

		const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (!SKIPPED_DIRECTORIES.has(entry.name)) {
					await scan(join(directory, entry.name), depth + 1);
				}
				continue;
			}

			if (!entry.isFile() || !IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
				continue;
			}

			const path = join(directory, entry.name);
			const projectRelativePath = relative(projectRoot, path);
			const score = scoreLogo(projectRelativePath);
			if (score > 0) {
				candidates.push({ path, score });
			}
		}
	}

	await scan(projectRoot, 0);

	return candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

export async function resolveProjectLogo(projectRoute: string) {
	const projectRoot = resolve(projectRoute);
	const override = PROJECT_LOGO_OVERRIDES[basename(projectRoot)];

	if (override) {
		const path = join(projectRoot, override);
		if (await Bun.file(path).exists()) {
			return path;
		}
	}

	return (await findLogoCandidates(projectRoot)).at(0)?.path ?? null;
}
