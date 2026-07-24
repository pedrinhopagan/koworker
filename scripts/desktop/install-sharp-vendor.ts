import { access, cp, mkdir, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const libvipsPackage = "@img/sharp-libvips-linux-x64";

// O backend compilado embute o addon do sharp, mas o rpath do addon não encontra o libvips fora do
// node_modules; o getSharp (src/api/helpers/koworker-assets.ts) pré-carrega o .so deste vendor.
// Instala via tmp + rename pra nunca deixar o vendor pela metade.
export async function installSharpVendor(sourceRootDir: string) {
	const vendorDir = join(homedir(), ".local/lib/kowork/vendor/node_modules", libvipsPackage);
	const tmp = `${vendorDir}.tmp.${crypto.randomUUID()}`;
	const backup = join(
		homedir(),
		"Documents",
		"backups",
		"kowork-sharp-vendor",
		new Date().toISOString().replaceAll(":", "-"),
		libvipsPackage,
	);

	await mkdir(dirname(vendorDir), { recursive: true });
	await cp(join(sourceRootDir, "node_modules", libvipsPackage), tmp, {
		recursive: true,
		dereference: true,
	});

	const exists = await access(vendorDir)
		.then(() => true)
		.catch(() => false);
	if (exists) {
		await mkdir(dirname(backup), { recursive: true });
		await rename(vendorDir, backup);
	}
	try {
		await rename(tmp, vendorDir);
	} catch (error) {
		if (exists) await rename(backup, vendorDir);
		throw error;
	}
}
