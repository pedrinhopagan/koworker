import { Check, ChevronDown } from "lucide-react";

import { Text } from "@/components/typography";
import { CustomSelect } from "@/components/ui/custom-select";
import {
	CODEX_APPROVAL_OPTIONS,
	CODEX_EFFORT_OPTIONS,
	CODEX_MODEL_OPTIONS,
	type CodexApprovalMode,
	INVOKE_CLI_OPTIONS,
	INVOKE_EFFORT_OPTIONS,
	INVOKE_MODEL_OPTIONS,
	INVOKE_PERMISSION_OPTIONS,
	type InvokeCli,
	type InvokePermissionMode,
	reflectValue,
} from "@/constants/invoke";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";

type SettingItem = { id: string; label: string; hint: string };

function toItems(options: { value: string; label: string; hint: string }[]): SettingItem[] {
	return options.map((option) => ({ id: option.value, label: option.label, hint: option.hint }));
}

function SettingSelect({
	label,
	items,
	value,
	onChange,
}: {
	label: string;
	items: SettingItem[];
	value: string;
	onChange: (value: string) => void;
}) {
	const active = items.find((item) => item.id === value);

	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<Text
				as="span"
				size="xs"
				className="font-semibold uppercase tracking-[0.14em] text-muted-foreground"
			>
				{label}
			</Text>
			<CustomSelect
				items={items}
				value={value}
				onValueChange={onChange}
				triggerClassName="h-10 w-full border-input bg-card px-3 text-sm text-foreground hover:border-primary/60"
				contentClassName="border-border"
				renderTrigger={() => (
					<>
						<span className="min-w-0 flex-1 truncate text-left font-medium text-foreground">
							{active?.label ?? value}
						</span>
						<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
					</>
				)}
				renderItem={(item, selected) => (
					<div className="flex min-w-0 items-start gap-2">
						<Check
							className={cn("mt-0.5 size-3.5 shrink-0 text-primary", !selected && "opacity-0")}
						/>
						<span className="flex min-w-0 flex-col">
							<span className="truncate font-medium text-foreground">{item.label}</span>
							<span className="truncate text-[11px] text-muted-foreground">{item.hint}</span>
						</span>
					</div>
				)}
			/>
		</div>
	);
}

export function ExecutionSettings() {
	const cli = usePromptBarStore((state) => state.cli);
	const setCli = usePromptBarStore((state) => state.setCli);
	const invoke = usePromptBarStore((state) => state.invoke);
	const patchClaudeSession = usePromptBarStore((state) => state.patchClaudeSession);
	const patchCodexSession = usePromptBarStore((state) => state.patchCodexSession);
	const isCodex = cli === "codex";
	const session = isCodex ? invoke.codex : invoke.claude;
	const mode = isCodex ? invoke.codex.approvalMode : invoke.claude.permissionMode;

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<SettingSelect
				label="CLI"
				items={toItems(INVOKE_CLI_OPTIONS)}
				value={cli}
				onChange={(value) => setCli(value as InvokeCli)}
			/>
			<SettingSelect
				label="Modelo"
				items={toItems(
					reflectValue(isCodex ? CODEX_MODEL_OPTIONS : INVOKE_MODEL_OPTIONS, session.model),
				)}
				value={session.model}
				onChange={(model) =>
					isCodex ? patchCodexSession({ model }) : patchClaudeSession({ model })
				}
			/>
			<SettingSelect
				label="Esforço"
				items={toItems(
					reflectValue(isCodex ? CODEX_EFFORT_OPTIONS : INVOKE_EFFORT_OPTIONS, session.effort),
				)}
				value={session.effort}
				onChange={(effort) =>
					isCodex ? patchCodexSession({ effort }) : patchClaudeSession({ effort })
				}
			/>
			<SettingSelect
				label={isCodex ? "Aprovação" : "Permissão"}
				items={toItems(isCodex ? CODEX_APPROVAL_OPTIONS : INVOKE_PERMISSION_OPTIONS)}
				value={mode}
				onChange={(value) =>
					isCodex
						? patchCodexSession({ approvalMode: value as CodexApprovalMode })
						: patchClaudeSession({ permissionMode: value as InvokePermissionMode })
				}
			/>
		</div>
	);
}
