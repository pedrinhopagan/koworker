import { InlineTaskCreateForm, type InlineTaskCreateFormSubmitInput } from "@/components/tasks";

type TaskFormProps = {
	onSubmit: (data: InlineTaskCreateFormSubmitInput) => void;
	loading: boolean;
};

/**
 * Wrapper da página /tarefas.
 * A lógica de projectId (store vs select transient + auto-submit) fica dentro do InlineTaskCreateForm.
 */
export function TaskForm({ onSubmit, loading }: TaskFormProps) {
	return <InlineTaskCreateForm onSubmit={onSubmit} loading={loading} resetMode="title" />;
}
