import { Dialog } from "@/components/ui/dialog";
import type { TaskAgent } from "@/types/agents";
import { useAgentSettingsMutation } from "../-utils/use-agent-settings";
import { AgentAppearanceControls } from "./agent-appearance-controls";

// Dialog de aparência aberto pela engrenagem do card no grid — mesmo controle do popover da página
// de detalhe, salvando direto em `agent_settings` via mutation.
export function AgentAppearanceDialog({
	agent,
	onClose,
}: {
	agent: TaskAgent | null;
	onClose: () => void;
}) {
	const settingsMutation = useAgentSettingsMutation();

	return (
		<Dialog
			open={agent !== null}
			onClose={onClose}
			title="Aparência do agent"
			description="Ícone e cor são metadados do koworker e não alteram o arquivo do agent."
			className="max-w-sm"
		>
			{agent ? (
				<div className="px-5 py-4">
					<AgentAppearanceControls
						slug={agent.slug}
						label={agent.label}
						icon={agent.icon}
						color={agent.color}
						onChange={(settings) => settingsMutation.mutate(settings)}
					/>
				</div>
			) : null}
		</Dialog>
	);
}
