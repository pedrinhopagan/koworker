import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// O redeploy precisa publicar exatamente o estado atual do diretório de trabalho (WIP incluído),
// sem tocar nele. Técnica: um índice git temporário (`GIT_INDEX_FILE`) recebe `add -A` —
// modificados, deletados e não-trackeados não ignorados —, vira árvore com `write-tree` e ganha um
// commit efêmero com `commit-tree`. O repositório real e os arquivos ficam intocados; o build roda
// num worktree desse commit, então o que sai é uma fotografia imutável do instante do clique.

export type WorkingTreeSnapshot = {
	commit: string;
	label: string;
	dirty: boolean;
};

function capture(args: string[], cwd: string, env?: Record<string, string>): string {
	const result = Bun.spawnSync(args, {
		cwd,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		env: env ? { ...process.env, ...env } : process.env,
	});

	if (result.exitCode !== 0) {
		const stderr = result.stderr.toString().trim();
		throw new Error(stderr || `Comando falhou: ${args.join(" ")}`);
	}

	return result.stdout.toString().trim();
}

async function withTempIndex<T>(
	repoDir: string,
	use: (env: Record<string, string>) => T,
): Promise<T> {
	const indexDir = await mkdtemp(join(tmpdir(), "kowork-snapshot-"));
	const env = { GIT_INDEX_FILE: join(indexDir, "index") };

	try {
		return await use(env);
	} finally {
		await rm(indexDir, { force: true, recursive: true });
	}
}

export async function resolveWorkingTreeSnapshot(repoDir: string): Promise<WorkingTreeSnapshot> {
	const head = capture(["git", "rev-parse", "HEAD"], repoDir);
	const shortHead = head.slice(0, 12);
	const branch = capture(["git", "rev-parse", "--abbrev-ref", "HEAD"], repoDir);
	const status = capture(["git", "status", "--porcelain"], repoDir);

	if (!status) {
		return { commit: head, label: `${branch}@${shortHead}`, dirty: false };
	}

	const commit = await withTempIndex(repoDir, (indexEnv) => {
		capture(["git", "read-tree", "HEAD"], repoDir, indexEnv);
		capture(["git", "add", "-A"], repoDir, indexEnv);
		const tree = capture(["git", "write-tree"], repoDir, indexEnv);
		const headTree = capture(["git", "rev-parse", "HEAD^{tree}"], repoDir);

		if (tree === headTree) {
			return head;
		}

		const message = `snapshot de deploy: ${branch}@${shortHead} + wip`;
		const authorEnv = {
			GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? "Kowork Deploy",
			GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? "deploy@kowork.local",
			GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? "Kowork Deploy",
			GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? "deploy@kowork.local",
		};

		return capture(["git", "commit-tree", tree, "-m", message], repoDir, {
			...indexEnv,
			...authorEnv,
		});
	});

	if (commit === head) {
		return { commit: head, label: `${branch}@${shortHead}`, dirty: false };
	}

	return { commit, label: `${branch}@${shortHead}+wip`, dirty: true };
}

// Carimbo leve para embutir no build (`dist/revision.json`). O pipeline de deploy injeta a revisão
// esperada por env; builds manuais caem para o estado atual do git. Aqui não há commit efêmero:
// só identificação do que está sendo compilado.
export async function resolveBuildRevision(
	repoDir: string,
): Promise<{ revision: string; commit: string; builtAt: number }> {
	const envRevision = process.env.KOWORK_BUILD_REVISION?.trim();
	const envCommit = process.env.KOWORK_BUILD_COMMIT?.trim();

	if (envRevision && envCommit) {
		return { revision: envRevision, commit: envCommit, builtAt: Date.now() };
	}

	const snapshot = await resolveWorkingTreeSnapshot(repoDir);

	return { revision: snapshot.label, commit: snapshot.commit, builtAt: Date.now() };
}
