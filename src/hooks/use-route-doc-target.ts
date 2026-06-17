import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { orpc } from "@/client";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useSkillQuery } from "@/hooks/use-skills";

type RouteKind = "task" | "vault" | "docs" | "skill" | "none";

export type RouteDocTarget = {
	kind: RouteKind;
	// Caminho relativo à raiz do projeto pra anexar como `/kw <path>`. `null` enquanto carrega
	// (tarefa/skill dependem de query) ou quando a rota não anexa nada.
	path: string | null;
	// Projeto certo pro autocomplete de skill: o da tarefa na rota de tarefa; o do foco global
	// nas demais. Sem isso, uma tarefa cujo projeto ≠ foco listaria as skills erradas.
	projectName?: string;
};

// Traduz a rota atual no alvo `/kw`, derivando tudo da URL + params + queries em cache (sem store
// de contexto). Compartilhado pelo footer global e pela ação "Copiar caminho da rota".
export function useRouteDocTarget(): RouteDocTarget {
	const params = useParams({ strict: false });
	const { selectedProject } = useProjectFocus();

	const taskId = params.taskId;
	const file = params.file;
	const fileName = params.fileName;
	const slug = params.slug;
	const splat = params._splat;

	const kind: RouteKind = taskId
		? "task"
		: fileName
			? "vault"
			: slug
				? "skill"
				: splat
					? "docs"
					: "none";

	const taskQuery = useQuery({
		...orpc.tasks.getFull.queryOptions({ input: { id: taskId ?? "" } }),
		enabled: kind === "task",
	});

	const skillQuery = useSkillQuery(slug ?? "", selectedProject?.name, {
		enabled: kind === "skill",
	});

	if (kind === "task") {
		const task = taskQuery.data ?? null;
		const folder = task?.folderPath ?? null;
		// Lendo um `.md` específico da tarefa (rota `$taskId/$file`), o alvo é esse arquivo — é ele que
		// o agent invocado deve executar. Na index da tarefa (sem `file`), o alvo é a pasta inteira.
		const path = folder && file ? `${folder}/${file}` : folder;
		return { kind, path, projectName: task?.project?.name };
	}

	if (kind === "vault") {
		return { kind, path: `.koworker/${fileName}`, projectName: selectedProject?.name };
	}

	if (kind === "docs") {
		return { kind, path: splat ?? null, projectName: selectedProject?.name };
	}

	if (kind === "skill") {
		const dir = skillQuery.skill?.primaryDir ?? null;
		return {
			kind,
			path: dir ? `${dir}/SKILL.md` : null,
			projectName: selectedProject?.name,
		};
	}

	return { kind: "none", path: null, projectName: selectedProject?.name };
}
