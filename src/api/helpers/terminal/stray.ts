// Chromes headless e daemons do agent-browser são spawnados por sessões de agentes e não morrem
// junto com a aba do multiplexador — acumulam e travam a máquina. Aqui matamos os processos órfãos
// por padrão de comando. `pkill -f` casa a linha de comando inteira; ele retorna 1 quando não acha
// nada, o que não é erro (só não havia órfão). Padrões: os Chromes vivem em `.agent-browser/browsers/`
// e o daemon é o binário `agent-browser/bin/agent-browser-linux-x64`.
const STRAY_PATTERNS = [".agent-browser/browsers/", "agent-browser/bin/agent-browser-linux-x64"];

async function pkill(pattern: string): Promise<void> {
	const proc = Bun.spawn(["pkill", "-f", pattern], {
		stdout: "ignore",
		stderr: "ignore",
		stdin: "ignore",
	});
	await proc.exited;
}

export async function killStrayAgentBrowsers(): Promise<void> {
	for (const pattern of STRAY_PATTERNS) {
		await pkill(pattern);
	}
}
