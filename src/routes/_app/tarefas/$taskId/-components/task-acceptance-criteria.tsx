import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useState } from "react";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { TaskFull } from "@/types/tasks";

type TaskAcceptanceCriteriaProps = {
	task: NonNullable<TaskFull>;
};

export function TaskAcceptanceCriteria({ task }: TaskAcceptanceCriteriaProps) {
	const queryClient = useQueryClient();
	const [criteria, setCriteria] = useState(task.acceptanceCriteria ?? []);
	const [newItem, setNewItem] = useState("");

	const updateMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	const doneCount = criteria.filter((item) => item.done).length;
	const isMutating = updateMutation.isPending;

	function commitCriteria(next: typeof criteria) {
		setCriteria(next);
		updateMutation.mutate({ id: task.id, acceptanceCriteria: next });
	}

	function handleToggle(id: string) {
		const next = criteria.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
		commitCriteria(next);
	}

	function handleTextChange(id: string, value: string) {
		setCriteria((prev) => prev.map((item) => (item.id === id ? { ...item, text: value } : item)));
	}

	function handleTextBlur(id: string, value: string) {
		const trimmed = value.trim();
		const current = criteria.find((item) => item.id === id);
		if (!current) return;
		const nextText = trimmed || current.text;
		if (nextText === current.text) return;
		const next = criteria.map((item) => (item.id === id ? { ...item, text: nextText } : item));
		commitCriteria(next);
	}

	function handleAdd() {
		const text = newItem.trim();
		if (!text) return;
		const next = [...criteria, { id: crypto.randomUUID(), text, done: false }];
		commitCriteria(next);
		setNewItem("");
	}

	function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			e.preventDefault();
			handleAdd();
		}
	}

	return (
		<Accordion type="single" collapsible defaultValue="criteria">
			<AccordionItem value="criteria" className="border-none">
				<AccordionTrigger className="hover:no-underline px-0">
					<div className="flex items-center gap-2">
						<Text size="xs" tone="muted" className="uppercase tracking-wide">
							Criterios de aceite
						</Text>
						{criteria.length > 0 && (
							<Text size="xs" tone="muted">
								{doneCount}/{criteria.length} concluidos
							</Text>
						)}
					</div>
				</AccordionTrigger>
				<AccordionContent className="pt-2 pb-0">
					{criteria.length === 0 ? (
						<div className="py-4 text-center border border-dashed border-border text-sm text-muted-foreground">
							Nenhum criterio definido
						</div>
					) : (
						<ul className="space-y-2">
							{criteria.map((item) => {
								const isDone = item.done;
								return (
									<li
										key={item.id}
										className={cn(
											"flex items-start gap-2 rounded-md border border-border/60 px-3 py-2 bg-card",
											isDone && "opacity-60"
										)}
									>
										<button
											type="button"
											onClick={() => handleToggle(item.id)}
											disabled={isMutating}
											className={cn("mt-0.5 text-muted-foreground", isDone && "text-primary")}
											title={isDone ? "Marcar como pendente" : "Marcar como concluido"}
										>
											{isDone ? <CheckCircle2 size={14} /> : <Circle size={14} />}
										</button>
										<input
											value={item.text}
											onChange={(e) => handleTextChange(item.id, e.target.value)}
											onBlur={(e) => handleTextBlur(item.id, e.target.value)}
											disabled={isMutating}
											className={cn(
												"flex-1 bg-transparent text-sm text-foreground",
												"focus:outline-none",
												isDone && "line-through text-muted-foreground"
											)}
											placeholder="Descreva o criterio..."
										/>
									</li>
								);
							})}
						</ul>
					)}

					<div className="flex items-center gap-2 pt-3">
						<Plus className="size-4 text-muted-foreground" />
						<input
							type="text"
							value={newItem}
							onChange={(e) => setNewItem(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Adicionar criterio..."
							disabled={isMutating}
							className={cn(
								"flex-1 bg-transparent text-foreground text-sm",
								"focus:outline-none border-b border-transparent focus:border-primary transition-colors",
								"placeholder:text-muted-foreground/60 disabled:opacity-50 disabled:cursor-not-allowed"
							)}
						/>
						<button
							type="button"
							onClick={handleAdd}
							disabled={!newItem.trim() || isMutating}
							className={cn(
								"px-3 py-1 text-xs bg-primary text-primary-foreground",
								"hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							)}
						>
							Adicionar
						</button>
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
