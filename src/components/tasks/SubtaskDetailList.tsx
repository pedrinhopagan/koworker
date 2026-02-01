import { Text } from "@/components/typography";
import type { SubtaskFull } from "@/types/tasks";
import { SubtaskDetailItem } from "./SubtaskDetailItem";

type SubtaskDetailListProps = {
	subtasks: SubtaskFull[];
};

export function SubtaskDetailList({ subtasks }: SubtaskDetailListProps) {
	if (subtasks.length === 0) {
		return (
			<Text size="sm" tone="muted">
				Nenhuma subtask criada.
			</Text>
		);
	}

	return (
		<div className="space-y-2">
			{subtasks.map((subtask) => (
				<SubtaskDetailItem key={subtask.id} subtask={subtask} />
			))}
		</div>
	);
}
