import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import sharp from "sharp";
import { resolveProjectLogo } from "../src/api/helpers/project-logo";

const projectsRoot = resolve(process.argv[2] ?? "/mnt/data/Projects");
const iconsRoot = join(homedir(), ".local", "share", "icons", "koworker-projects");
const darkBackgroundProjects = new Set(["aab-arquitetura"]);

function colorFromName(name: string) {
	let hue = 0;
	for (const character of name) {
		hue = (hue * 31 + (character.codePointAt(0) ?? 0)) % 360;
	}
	return `hsl(${hue} 42% 38%)`;
}

function fallbackSvg(name: string) {
	const initials = name
		.split(/[-_\s]+/)
		.filter((part) => !!part)
		.slice(0, 2)
		.map((part) => part.at(0)?.toUpperCase())
		.join("");

	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
	<rect x="24" y="24" width="464" height="464" rx="104" fill="${colorFromName(name)}"/>
	<text x="256" y="286" text-anchor="middle" fill="white" font-family="DejaVu Sans, sans-serif" font-size="156" font-weight="700">${initials}</text>
</svg>`);
}

async function renderIcon(name: string, logoPath: string | null, destination: string) {
	if (!logoPath) {
		await sharp(fallbackSvg(name)).png().toFile(destination);
		return;
	}

	const background = darkBackgroundProjects.has(name) ? "#292825" : "#f5f5f4";
	const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
	<rect x="24" y="24" width="464" height="464" rx="104" fill="${background}" stroke="#a8a29e" stroke-opacity=".35" stroke-width="4"/>
</svg>`);
	const logo = await sharp(logoPath, { density: 300 })
		.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.resize({ width: 352, height: 352, fit: "inside", withoutEnlargement: false })
		.png()
		.toBuffer();
	const metadata = await sharp(logo).metadata();

	await sharp(tile)
		.composite([
			{
				input: logo,
				left: Math.round((512 - (metadata.width ?? 0)) / 2),
				top: Math.round((512 - (metadata.height ?? 0)) / 2),
			},
		])
		.png()
		.toFile(destination);
}

async function setDirectoryIcon(directory: string, iconPath: string) {
	const metadataPath = join(directory, ".directory");
	const current = await readFile(metadataPath, "utf8").catch(() => "");
	const sectionMatch = current.match(/\[Desktop Entry\][\s\S]*?(?=\n\[|$)/);
	let next: string;

	if (sectionMatch) {
		const section = sectionMatch[0];
		const updatedSection = /^Icon=.*$/m.test(section)
			? section.replace(/^Icon=.*$/m, `Icon=${iconPath}`)
			: section.replace("[Desktop Entry]", `[Desktop Entry]\nIcon=${iconPath}`);
		next = current.replace(section, updatedSection);
	} else {
		next = `[Desktop Entry]\nIcon=${iconPath}\n${current}`;
	}

	await writeFile(metadataPath, next.endsWith("\n") ? next : `${next}\n`);
}

await mkdir(iconsRoot, { recursive: true });

const projects = (await readdir(projectsRoot, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory() && entry.name !== ".git")
	.sort((a, b) => a.name.localeCompare(b.name));
const manifest: { name: string; logo: string | null; icon: string; applied: boolean }[] = [];

for (const project of projects) {
	const projectRoute = join(projectsRoot, project.name);
	const logo = await resolveProjectLogo(projectRoute);
	const icon = join(iconsRoot, `${basename(projectRoute)}.png`);

	await renderIcon(project.name, logo, icon);
	const applied = await setDirectoryIcon(projectRoute, icon)
		.then(() => true)
		.catch((error) => {
			console.warn(`sem permissão\t${project.name}\t${String(error)}`);
			return false;
		});
	manifest.push({ name: project.name, logo, icon, applied });
	console.log(`${logo ? "logo" : "fallback"}\t${project.name}${logo ? `\t${logo}` : ""}`);
}

await writeFile(join(iconsRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
