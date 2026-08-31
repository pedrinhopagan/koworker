import { InlineTaskCreateForm, type InlineTaskCreateFormSubmitInput } from "@/components/tasks";

type TaskFormProps = {
	projectId?: string;
	onSubmit: (data: InlineTaskCreateFormSubmitInput) => void | Promise<unknown>;
	loading: boolean;
};

/**
 * Wrapper da página /tarefas.
 * A lógica de projectId (store vs select transient + auto-submit) fica dentro do InlineTaskCreateForm.
 */
export function TaskForm({ projectId, onSubmit, loading }: TaskFormProps) {
	return (
		<InlineTaskCreateForm
			projectId={projectId}
			onSubmit={onSubmit}
			loading={loading}
			resetMode="title"
		/>
	);
}
