import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/client";
import { CustomSelect } from "@/components/ui/custom-select";
import { Text } from "@/components/typography";
import { CONVERSATION_EFFORT_LABELS } from "@/constants/conversation";
import type { ConversationEffortSchema, ConversationProfileSchema } from "@/lib/conversation";
import type { z } from "zod";

export function ConversationModel({
	profileId,
	model,
	effort,
	onModel,
	onEffort,
	disabled,
}: {
	profileId: z.infer<typeof ConversationProfileSchema>;
	model?: string | null;
	effort?: z.infer<typeof ConversationEffortSchema> | null;
	onModel: (model: string) => void;
	onEffort: (effort: z.infer<typeof ConversationEffortSchema>) => void;
	disabled?: boolean;
}) {
	const {
		data: models,
		isPending,
		error,
	} = useQuery(
		orpc.conversations.models.queryOptions({
			input: { profileId },
			staleTime: 60_000,
			throwOnError: false,
			retry: false,
		}),
	);
	const selected =
		models?.find((entry) => entry.model === model) ?? models?.find((entry) => entry.isDefault);
	const efforts =
		selected?.supportedReasoningEfforts.map((entry) => ({
			id: entry.reasoningEffort,
			label: CONVERSATION_EFFORT_LABELS[entry.reasoningEffort],
		})) ?? [];
	return (
		<>
			<CustomSelect
				items={models ?? []}
				value={selected?.id ?? ""}
				onValueChange={(_id, entry) => {
					onModel(entry.model);
					onEffort(entry.defaultReasoningEffort);
				}}
				renderItem={(entry) => entry.displayName}
				variant="ghost"
				fitContent
				loading={isPending}
				disabled={disabled}
				ariaLabel="Modelo para a próxima mensagem"
				placeholder={model ?? "Modelo padrão"}
				className="h-11 max-w-48 px-2 sm:h-9"
				error={error ? "Não foi possível carregar os modelos." : null}
			/>
			{efforts.length > 0 && (
				<CustomSelect
					items={efforts}
					value={effort ?? selected?.defaultReasoningEffort ?? ""}
					onValueChange={(_id, entry) => onEffort(entry.id)}
					renderItem={(entry) => entry.label}
					variant="ghost"
					fitContent
					disabled={disabled}
					ariaLabel="Esforço para a próxima mensagem"
					className="h-11 px-2 sm:h-9"
				/>
			)}
			{disabled && (
				<Text size="xs" tone="faint" className="px-2">
					Modelo em uso
				</Text>
			)}
		</>
	);
}
