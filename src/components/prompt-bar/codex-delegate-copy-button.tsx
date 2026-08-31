import { useState } from "react";

import { CodexIcon } from "@/components/agent-radar/agent-cli";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuLabel,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { CODEX_MODEL_OPTIONS, INVOKE_INHERIT } from "@/constants/invoke";
import { usePromptBarStore } from "@/stores/prompt-bar";

const DELEGATE_MODEL_OPTIONS = CODEX_MODEL_OPTIONS.filter(
	(option) => option.value !== INVOKE_INHERIT,
);

export function CodexDelegateCopyButton({ onCopy }: { onCopy: (model: string) => void }) {
	const model = usePromptBarStore((state) => state.codexDelegateModel);
	const setModel = usePromptBarStore((state) => state.setCodexDelegateModel);
	const [menuOpen, setMenuOpen] = useState(false);
	const modelLabel =
		DELEGATE_MODEL_OPTIONS.find((option) => option.value === model)?.label ?? model;
	const actionLabel = `Copiar com Codex — ${modelLabel}, esforço médio`;

	return (
		<ContextMenu onOpenChange={setMenuOpen}>
			<ContextMenuTrigger asChild>
				<span className="inline-flex">
					<Tooltip
						label={`${actionLabel}. Clique direito para trocar o modelo.`}
						disabled={menuOpen}
					>
						<Button
							size="sm"
							variant="outline"
							aria-label={actionLabel}
							className="size-12 px-0 md:size-8"
							onClick={() => onCopy(model)}
						>
							<CodexIcon className="size-4" />
						</Button>
					</Tooltip>
				</span>
			</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuLabel>Modelo do Codex</ContextMenuLabel>
				<ContextMenuRadioGroup value={model} onValueChange={setModel}>
					{DELEGATE_MODEL_OPTIONS.map((option) => (
						<ContextMenuRadioItem key={option.value} value={option.value}>
							{option.label}
						</ContextMenuRadioItem>
					))}
				</ContextMenuRadioGroup>
				<ContextMenuSeparator />
				<ContextMenuLabel className="font-normal text-muted-foreground">
					Volta para Sol ao reiniciar o app
				</ContextMenuLabel>
			</ContextMenuContent>
		</ContextMenu>
	);
}
