import { ArrowRightLeft, Check, ChevronDown } from "lucide-react";
import { type ComponentProps, useState } from "react";

import type { ModelCatalog } from "@/api/schemas/agent-radar";
import { CliLogo } from "@/components/icons/cli-logos";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { agentRadarAgentLabel } from "@/constants/agent-radar";
import { effortLabel, INVOKE_CLIS } from "@/constants/invoke";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import {
	type ModelSession,
	type ModelTarget,
	modelOptionLabel,
	modelTargetDiff,
} from "@/lib/model-target";
import { cn } from "@/lib/utils";

type ModelPickerProps = {
	catalog: ModelCatalog | undefined;
	session: ModelSession;
	value: ModelTarget;
	onChange: (target: ModelTarget) => void;
	disabled?: boolean;
};

function switchNotice(target: ModelTarget, cliChanged: boolean) {
	if (cliChanged) {
		return `Ao enviar, a conversa é resumida e continua em uma sessão ${agentRadarAgentLabel(target.cli)}.`;
	}
	if (target.cli === "codex") {
		return "Ao enviar, a conversa reabre com a nova configuração.";
	}

	return "Vale a partir do próximo envio.";
}

function ModelPickerPanel({
	catalog,
	session,
	value,
	onChange,
}: Omit<ModelPickerProps, "disabled">) {
	const options = catalog?.[value.cli] ?? [];
	const selected = options.find((option) => option.id === value.model);
	const efforts = selected?.efforts ?? options[0]?.efforts ?? [];
	const diff = modelTargetDiff(value, session);

	return (
		<div data-component="model-picker-panel" className="flex flex-col">
			<div
				role="radiogroup"
				aria-label="CLI"
				className="m-3 grid grid-cols-2 gap-0.5 bg-muted p-0.5"
			>
				{INVOKE_CLIS.map((cli) => {
					const checked = cli === value.cli;
					const backToSession = cli === session.cli;

					return (
						<button
							key={cli}
							type="button"
							role="radio"
							aria-checked={checked}
							data-slot="cli"
							data-value={cli}
							onClick={() => {
								if (!checked) {
									onChange({
										cli,
										model: backToSession ? session.model : null,
										effort: backToSession ? session.effort : null,
									});
								}
							}}
							className={cn(
								"flex h-11 items-center justify-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:h-10 md:text-xs",
								checked
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<CliLogo cli={cli} className="size-3.5" />
							{agentRadarAgentLabel(cli)}
						</button>
					);
				})}
			</div>

			<div role="radiogroup" aria-label="Modelo" className="flex flex-col border-t border-border">
				{options.length === 0 && (
					<Text size="xs" tone="muted" className="px-4 py-3">
						Carregando modelos…
					</Text>
				)}
				{options.map((option) => {
					const checked = option.id === value.model;
					const current = value.cli === session.cli && option.id === session.model;

					return (
						<button
							key={option.id}
							type="button"
							role="radio"
							aria-checked={checked}
							data-slot="model"
							data-value={option.id}
							onClick={() => {
								onChange({
									...value,
									model: option.id,
									effort:
										value.effort && option.efforts.includes(value.effort) ? value.effort : null,
								});
							}}
							className={cn(
								"flex min-h-12 items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
								checked && "bg-muted/60",
							)}
						>
							<span className="min-w-0 flex-1">
								<span className="flex flex-wrap items-center gap-x-2">
									<Text as="span" size="sm" className="font-medium">
										{option.label}
									</Text>
									{current && (
										<Text as="span" size="xs" tone="muted">
											atual
										</Text>
									)}
								</span>
								{option.hint && (
									<Text as="span" size="xs" tone="muted" className="block break-words">
										{option.hint}
									</Text>
								)}
							</span>
							{checked && <Check className="size-4 shrink-0 text-primary" />}
						</button>
					);
				})}
			</div>

			{efforts.length > 0 && (
				<div className="border-t border-border px-4 py-3">
					<Text size="xs" tone="muted" className="mb-2 font-semibold uppercase tracking-[0.12em]">
						Esforço
					</Text>
					<div
						role="radiogroup"
						aria-label="Esforço"
						className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-1.5"
					>
						{efforts.map((effort) => {
							const checked = effort === value.effort;

							return (
								<button
									key={effort}
									type="button"
									role="radio"
									aria-checked={checked}
									data-slot="effort"
									data-value={effort}
									onClick={() => {
										onChange({ ...value, effort });
									}}
									className={cn(
										"min-h-11 border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:min-h-9 md:text-xs",
										checked
											? "border-primary bg-primary text-primary-foreground"
											: "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground",
									)}
								>
									{effortLabel(effort)}
								</button>
							);
						})}
					</div>
				</div>
			)}

			{diff && (
				<div className="flex items-start gap-2 border-t border-border bg-muted/40 px-4 py-2.5">
					<ArrowRightLeft className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
					<Text size="xs" tone="muted">
						{switchNotice(value, diff.cli)}
					</Text>
				</div>
			)}
		</div>
	);
}

export function ModelPicker({
	catalog,
	session,
	value,
	onChange,
	disabled = false,
}: ModelPickerProps) {
	const [open, setOpen] = useState(false);
	const isMobile = useIsMobileViewport();
	const options = catalog?.[value.cli];
	const pending = modelTargetDiff(value, session) !== null;
	const modelLabel = modelOptionLabel(options, value.model) ?? agentRadarAgentLabel(value.cli);
	const description = `Sessão atual: ${session.cli ? agentRadarAgentLabel(session.cli) : "sem CLI"}${
		session.model
			? ` · ${modelOptionLabel(catalog?.[session.cli ?? value.cli], session.model)}`
			: ""
	}${session.effort ? ` · ${effortLabel(session.effort)}` : ""}`;

	function trigger(props: ComponentProps<"button">) {
		return (
			<button
				type="button"
				aria-label="Selecionar modelo da sessão"
				aria-haspopup="dialog"
				aria-expanded={open}
				data-component="model-picker"
				data-pending={pending || undefined}
				disabled={disabled}
				className="relative flex h-11 min-w-0 max-w-48 items-center gap-1.5 border border-input bg-background px-2.5 text-xs shadow-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:h-10 md:max-w-56"
				{...props}
			>
				<CliLogo cli={value.cli} className="size-4 shrink-0" />
				<span className="flex min-w-0 flex-1 flex-col items-start md:flex-row md:items-center md:gap-1.5">
					<span className="max-w-full truncate font-medium">{modelLabel}</span>
					{value.effort && (
						<span className="text-muted-foreground md:shrink-0">
							<span className="hidden md:inline">· </span>
							{effortLabel(value.effort)}
						</span>
					)}
				</span>
				<ChevronDown className="size-3.5 shrink-0 opacity-60" />
				{pending && (
					<span aria-hidden className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" />
				)}
			</button>
		);
	}

	const panel = (
		<ModelPickerPanel catalog={catalog} session={session} value={value} onChange={onChange} />
	);

	const footer = (
		<div className="shrink-0 border-t border-border p-4">
			<Button
				data-component="model-picker-done"
				className="h-11 w-full"
				onClick={() => setOpen(false)}
			>
				Concluir
			</Button>
		</div>
	);

	if (isMobile) {
		return (
			<>
				{trigger({ onClick: () => setOpen(true) })}
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetContent side="bottom" showClose={false} className="touch-pan-y">
						<div className="shrink-0 border-b border-border px-4 pt-3 pb-4">
							<SheetTitle>Modelo e esforço</SheetTitle>
							<SheetDescription className="mt-1 text-xs">{description}</SheetDescription>
						</div>
						<div className="min-h-0 overflow-y-auto overscroll-contain touch-pan-y">{panel}</div>
						{footer}
					</SheetContent>
				</Sheet>
			</>
		);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{trigger({})}</PopoverTrigger>
			<PopoverContent
				align="start"
				side="top"
				className="flex max-h-[var(--radix-popover-content-available-height)] w-80 flex-col p-0"
			>
				<div className="min-h-0 overflow-y-auto overscroll-contain">{panel}</div>
				{footer}
			</PopoverContent>
		</Popover>
	);
}
