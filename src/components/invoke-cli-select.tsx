import { ChevronDown, SquareTerminal } from "lucide-react";

import { CustomSelect } from "@/components/ui/custom-select";
import { INVOKE_CLI_OPTIONS, type InvokeCli } from "@/constants/invoke";
import { usePromptBarStore } from "@/stores/prompt-bar";

const CLI_ITEMS = INVOKE_CLI_OPTIONS.map((option) => ({
	id: option.value,
	label: option.label,
	hint: option.hint,
}));

export function InvokeCliSelect({ compact = false }: { compact?: boolean }) {
	const cli = usePromptBarStore((state) => state.cli);
	const setCli = usePromptBarStore((state) => state.setCli);
	const active = CLI_ITEMS.find((option) => option.id === cli);

	return (
		<CustomSelect
			items={CLI_ITEMS}
			value={cli}
			onValueChange={(value) => setCli(value as InvokeCli)}
			{...(compact ? { size: "sm" as const, fitContent: true } : {})}
			{...(compact
				? {
						triggerClassName:
							"h-6 gap-1 border-border/70 bg-muted/40 px-2 text-[11px] text-muted-foreground hover:bg-muted/70 hover:text-foreground",
					}
				: { upperLabel: true, label: "CLI" })}
			{...(compact ? {} : {})}
			renderTrigger={() => (
				<>
					<SquareTerminal className="size-3 shrink-0" />
					<span className="min-w-0 flex-1 truncate text-left">{active?.label}</span>
					<ChevronDown className="size-3 shrink-0 opacity-50" />
				</>
			)}
			renderItem={(option) => (
				<div className="flex flex-col">
					<span className="text-xs font-medium">{option.label}</span>
					<span className="text-[11px] text-muted-foreground">{option.hint}</span>
				</div>
			)}
		/>
	);
}
