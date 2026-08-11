const args = ["bun", "x", "electron-builder"];

if (process.platform === "linux") {
	args.push("--linux", "AppImage", "deb");
	if (Bun.which("rpmbuild")) {
		args.push("rpm");
	} else {
		console.warn("RPM ignorado: instale rpmbuild para gerar esse formato");
	}
} else if (process.platform === "win32") {
	args.push("--win", "nsis");
} else if (process.platform === "darwin") {
	args.push("--mac", "dmg");
} else {
	throw new Error(`Plataforma desktop não suportada: ${process.platform}`);
}

const result = Bun.spawnSync(args, {
	cwd: process.cwd(),
	stdio: ["ignore", "inherit", "inherit"],
});

if (result.exitCode !== 0) {
	throw new Error("Falha ao gerar os pacotes Electron");
}
