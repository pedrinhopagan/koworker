import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

import { Text } from "@/components/typography";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import type { TaskFull } from "@/types/tasks";

type TaskMetadataProps = {
	task: NonNullable<TaskFull>;
};

export function TaskMetadata({ task }: TaskMetadataProps) {
	const [copied, setCopied] = useState(false);

	const metadata = useMemo(
		() => ({
			id: task.id,
			projectId: task.projectId,
			categoryId: task.categoryId,
			priorityId: task.priorityId,
			status: task.status,
			createdAt: task.createdAt,
			updatedAt: task.updatedAt,
			completedAt: task.completedAt,
			deletedAt: task.deletedAt,
			aiMetadata: task.aiMetadata,
			subtasks: task.subtasks?.map((s) => ({
				id: s.id,
				title: s.title,
				status: s.status,
				createdAt: s.createdAt,
				completedAt: s.completedAt,
			})),
		}),
		[task],
	);

	const metadataJson = JSON.stringify(metadata, null, 2);

	async function handleCopy() {
		await navigator.clipboard.writeText(metadataJson);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<Accordion type="single" collapsible>
			<AccordionItem value="metadata" className="border border-border bg-background">
				<AccordionTrigger className="hover:no-underline px-4 py-3">
					<div className="flex items-center justify-between w-full pr-2">
						<Text size="xs" tone="muted" className="uppercase tracking-wide">
							Metadados
						</Text>
						<Text size="xs" tone="muted" className="font-mono">
							{task.id.slice(0, 8)}...
						</Text>
					</div>
				</AccordionTrigger>
				<AccordionContent className="pt-0 pb-0">
					<div className="relative border-t border-border">
						<button
							type="button"
							onClick={handleCopy}
							className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-popover transition-colors"
							title="Copiar JSON"
						>
							{copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
						</button>
						<pre className="p-4 bg-black text-foreground text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
							<code>{metadataJson}</code>
						</pre>
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
