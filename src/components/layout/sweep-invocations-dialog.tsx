import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { orpc, type RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { closeInvocationTerminals } from "@/lib/terminal";

type InvocationSessionInfo = RouterOutputs["terminal"]["listInvocationSessions"][number];

// Dialog da vassoura: lista os projetos com invocações de agent/skill abertas no terminal, todos
// pré-selecionados. Desmarcar poupa o projeto; confirmar fecha só as abas de invocação dos marcados.
export function SweepInvocationsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());

	const [sessions, setSessions] = useState<InvocationSessionInfo[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(false);
	const [closing, setClosing] = useState(false);

	// Snapshot vivo do tmux a cada abertura: o estado muda fora do React (invocações abrem/fecham nos
	// terminais), então não dá pra cachear. Tudo pré-selecionado ao chegar.
	useEffect(() => {
		if (!open) {
			return;
		}

		const projects = (projectsQuery.data ?? []).map((p) => ({ id: p.id, name: p.name }));
		let cancelled = false;
		setLoading(true);

		orpc.terminal.listInvocationSessions
			.call({ projects })
			.then((result) => {
				if (cancelled) {
					return;
				}
				setSessions(result);
				setSelected(new Set(result.map((s) => s.projectId)));
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [open, projectsQuery.data]);

	function toggle(projectId: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(projectId)) {
				next.delete(projectId);
			} else {
				next.add(projectId);
			}
			return next;
		});
	}

	async function handleConfirm() {
		const chosen = sessions
			.filter((s) => selected.has(s.projectId))
			.map((s) => ({ id: s.projectId, name: s.projectName }));

		if (chosen.length === 0) {
			return;
		}

		setClosing(true);
		await closeInvocationTerminals(chosen);
		setClosing(false);
		onClose();
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Fechar invocações"
			description="Encerra as abas de agent/skill dos projetos marcados"
			footer={
				<>
					<Button variant="ghost" onClick={onClose} disabled={closing}>
						Cancelar
					</Button>
					<Button
						variant="destructive"
						onClick={() => void handleConfirm()}
						disabled={selected.size === 0 || closing}
					>
						Fechar selecionados ({selected.size})
					</Button>
				</>
			}
		>
			{loading ? (
				<Text size="sm" tone="muted">
					Carregando sessões...
				</Text>
			) : sessions.length === 0 ? (
				<Text size="sm" tone="muted">
					Nenhuma invocação de agent/skill aberta.
				</Text>
			) : (
				<ul className="flex flex-col gap-1">
					{sessions.map((session) => (
						<li key={session.projectId}>
							<label className="flex cursor-pointer items-center gap-3 border border-border bg-card px-3 py-2 transition-colors hover:border-muted-foreground">
								<Checkbox
									checked={selected.has(session.projectId)}
									onCheckedChange={() => toggle(session.projectId)}
								/>
								<span className="min-w-0 flex-1 truncate text-sm text-foreground">
									{session.projectName}
								</span>
								<span className="shrink-0 text-xs text-muted-foreground">
									{session.windowCount} aba{session.windowCount > 1 ? "s" : ""}
								</span>
							</label>
						</li>
					))}
				</ul>
			)}
		</Dialog>
	);
}
