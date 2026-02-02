import { useMutation, useQueryClient } from "@tanstack/react-query";
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

type TaskDescriptionProps = {
	task: NonNullable<TaskFull>;
	disabled?: boolean;
};

export function TaskDescription({ task, disabled }: TaskDescriptionProps) {
	const queryClient = useQueryClient();
	const [localDescription, setLocalDescription] = useState(task.description ?? "");

	const updateMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	function handleBlur() {
		const newDesc = localDescription || undefined;
		if (newDesc !== (task.description ?? undefined)) {
			updateMutation.mutate({ id: task.id, description: newDesc });
		}
	}

	return (
		<Accordion type="single" collapsible defaultValue="description">
			<AccordionItem value="description" className="border-none">
				<AccordionTrigger className="hover:no-underline px-0">
					<Text size="xs" tone="muted" className="uppercase tracking-wide">
						Descrição
					</Text>
				</AccordionTrigger>
				<AccordionContent className="pt-2 pb-0">
					<textarea
						value={localDescription}
						onChange={(e) => setLocalDescription(e.target.value)}
						onBlur={handleBlur}
						placeholder="Descrição da tarefa..."
						disabled={disabled || updateMutation.isPending}
						rows={8}
						className={cn(
							"w-full px-3 py-2 bg-card border border-border",
							"text-foreground text-sm resize-none",
							"focus:border-primary focus:outline-none transition-all duration-200",
							"disabled:opacity-50 disabled:cursor-not-allowed hover:border-muted-foreground/50",
						)}
					/>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
