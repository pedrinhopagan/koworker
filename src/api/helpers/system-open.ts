const APPLICATION_START_MS = 500;

export async function runSystemOpen(commands: string[][], env: Record<string, string | undefined>) {
	let failure = "Nenhum aplicativo disponível para abrir o arquivo.";

	for (const command of commands) {
		if (!Bun.which(command[0], { PATH: env.PATH })) {
			failure = `O comando ${command[0]} não foi encontrado.`;
			continue;
		}

		const child = Bun.spawn(command, {
			stdin: "ignore",
			stdout: "ignore",
			stderr: "inherit",
			detached: process.platform !== "win32",
			env,
		});
		let timer: ReturnType<typeof setTimeout> | undefined;

		try {
			const exitCode = await Promise.race([
				child.exited,
				new Promise<null>((resolve) => {
					timer = setTimeout(() => resolve(null), APPLICATION_START_MS);
				}),
			]);

			if (exitCode === null || exitCode === 0) {
				return;
			}

			failure = `${command[0]} saiu com código ${exitCode}`;
		} finally {
			clearTimeout(timer);
			child.unref();
		}
	}

	throw new Error(failure);
}
