import {
	AlertCircle,
	ArrowRightLeft,
	Check,
	ChevronDown,
	CircleHelp,
	Loader2,
	Sparkles,
} from "lucide-react";
import {
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import type { CliModelOption, ModelCatalog } from "@/api/schemas/agent-radar";
import { CliLogo } from "@/components/icons/cli-logos";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { agentRadarAgentLabel } from "@/constants/agent-radar";
import { effortLabel, INVOKE_CLIS } from "@/constants/invoke";
import { type ModelSession, type ModelTarget, modelOptionLabel } from "@/lib/model-target";
import { cn } from "@/lib/utils";
import { EffortSparks } from "./effort-sparks";

export type ModelApplyStatus = "idle" | "applying" | "applied" | "failed";

type ModelPickerProps = {
	catalog: ModelCatalog | undefined;
	session: ModelSession;
	value: ModelTarget;
	onChange: (target: ModelTarget) => void;
	status?: ModelApplyStatus;
	disabled?: boolean;
	allowCliChange?: boolean;
};

// Borda do trilho até o centro do primeiro e do último degrau: é o que alinha o polegar às marcas.
const EDGE = 11;

const STATUS_TEXT: Record<ModelApplyStatus, string> = {
	idle: "",
	applying: "Aplicando no terminal…",
	applied: "Aplicado nesta sessão",
	failed: "A troca falhou",
};

const CHIP =
	"relative inline-flex h-12 min-w-0 shrink-0 cursor-pointer touch-manipulation select-none items-center gap-1.5 px-2.5 text-xs font-medium text-muted-foreground transition-[background-color,color,transform] duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 data-[open]:bg-muted data-[open]:text-foreground motion-reduce:active:scale-100 sm:h-10";

// Os toques no seletor não tiram o foco do campo: no celular isso fecharia o teclado a cada escolha.
function keepFocus(event: { preventDefault: () => void }) {
	event.preventDefault();
}

function modelRows(options: CliModelOption[]) {
	return [
		...options.filter((option) => !option.legacy),
		...options.filter((option) => option.legacy),
	];
}

function ModelMenu({
	options,
	session,
	value,
	active,
	onActive,
	onPick,
	onCli,
	allowCliChange,
}: {
	options: CliModelOption[];
	session: ModelSession;
	value: ModelTarget;
	active: number;
	onActive: (index: number) => void;
	onPick: (option: CliModelOption) => void;
	onCli: (cli: ModelTarget["cli"]) => void;
	allowCliChange: boolean;
}) {
	const list = useRef<HTMLDivElement>(null);
	const glow = useRef<HTMLSpanElement>(null);
	const placed = useRef(false);

	useLayoutEffect(() => {
		const row = list.current?.querySelectorAll<HTMLElement>("[role=option]")[active];
		const node = glow.current;
		if (!node) {
			return;
		}
		if (!row) {
			node.style.opacity = "0";
			return;
		}
		if (!placed.current) {
			node.style.transition = "none";
		}
		node.style.transform = `translateY(${row.offsetTop}px)`;
		node.style.height = `${row.offsetHeight}px`;
		node.style.opacity = "1";
		if (!placed.current) {
			void node.offsetHeight;
			node.style.transition = "";
			placed.current = true;
		}
		row.scrollIntoView?.({ block: "nearest" });
	}, [active, options]);

	return (
		<div data-component="model-picker-panel" className="flex flex-col">
			{allowCliChange && (
				<div
					role="radiogroup"
					aria-label="CLI"
					className="mb-1 grid grid-cols-2 gap-0.5 bg-muted p-0.5"
				>
					{INVOKE_CLIS.map((cli) => (
						<button
							key={cli}
							type="button"
							role="radio"
							aria-checked={cli === value.cli}
							data-slot="cli"
							data-value={cli}
							onMouseDown={keepFocus}
							onClick={() => onCli(cli)}
							className={cn(
								"flex h-12 items-center justify-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:h-9 md:text-xs",
								cli === value.cli
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<CliLogo cli={cli} className="size-3.5" />
							{agentRadarAgentLabel(cli)}
						</button>
					))}
				</div>
			)}

			<div ref={list} role="listbox" aria-label="Modelos" className="relative">
				<span
					ref={glow}
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 bg-foreground/8 opacity-0 transition-[transform,height,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity"
				/>
				{options.length === 0 && (
					<div className="flex min-h-12 items-center px-2.5 text-xs text-muted-foreground">
						Carregando modelos…
					</div>
				)}
				{options.map((option, index) => {
					const checked = option.id === value.model;
					const current = value.cli === session.cli && option.id === session.model;

					return (
						<div key={option.id}>
							{option.legacy && !options[index - 1]?.legacy && (
								<div className="mt-1 border-t border-border px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
									Versões anteriores
								</div>
							)}
							<button
								type="button"
								role="option"
								aria-selected={checked}
								data-slot="model"
								data-value={option.id}
								onMouseDown={keepFocus}
								onPointerEnter={() => onActive(index)}
								onClick={() => onPick(option)}
								className="relative z-[1] flex min-h-12 w-full items-center gap-2.5 px-2.5 py-1.5 text-left focus-visible:outline-none md:min-h-9"
							>
								<span className="shrink-0 text-sm font-medium text-foreground md:text-[13px]">
									{option.label}
								</span>
								{option.hint && (
									<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
										{option.hint}
									</span>
								)}
								<span className="ml-auto flex shrink-0 items-center gap-1.5">
									{current && <span className="text-[11px] text-muted-foreground/60">atual</span>}
									<Check
										className={cn(
											"size-3.5 text-primary transition-opacity",
											!checked && "opacity-0",
										)}
									/>
								</span>
							</button>
						</div>
					);
				})}
			</div>

			{value.cli !== session.cli && (
				<div className="mt-1 flex items-start gap-2 border-t border-border px-2.5 pt-2 pb-1.5">
					<ArrowRightLeft className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
					<span className="text-xs text-muted-foreground">
						Ao enviar, a conversa é resumida e continua em uma sessão{" "}
						{agentRadarAgentLabel(value.cli)}.
					</span>
				</div>
			)}
		</div>
	);
}

function EffortPanel({
	efforts,
	index,
	onPreview,
	onCommit,
}: {
	efforts: string[];
	index: number;
	onPreview: (index: number) => void;
	onCommit: (index: number) => void;
}) {
	const maxed = efforts.length > 1 && index === efforts.length - 1;
	const stepAt = (step: number) =>
		`calc(${EDGE}px + (100% - ${EDGE * 2}px) * ${step / Math.max(1, efforts.length - 1)})`;
	const fillAt = (step: number) =>
		step === efforts.length - 1 ? "100%" : `calc(${stepAt(step)} + 7px)`;

	function fromPointer(event: PointerEvent<HTMLDivElement>) {
		const rect = event.currentTarget.getBoundingClientRect();
		const ratio = (event.clientX - rect.left - EDGE) / Math.max(1, rect.width - 2 * EDGE);

		return Math.max(0, Math.min(efforts.length - 1, Math.round(ratio * (efforts.length - 1))));
	}

	function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		const target = {
			ArrowRight: index + 1,
			ArrowUp: index + 1,
			ArrowLeft: index - 1,
			ArrowDown: index - 1,
			Home: 0,
			End: efforts.length - 1,
		}[event.key];
		if (target === undefined) {
			return;
		}
		event.preventDefault();
		onCommit(Math.max(0, Math.min(efforts.length - 1, target)));
	}

	return (
		<div
			data-component="effort-panel"
			data-max={maxed || undefined}
			className="group/effort relative isolate overflow-hidden px-3.5 pt-3 pb-3.5"
		>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(140%_120%_at_0%_100%,color-mix(in_oklch,var(--primary)_26%,transparent),transparent_62%)] opacity-0 transition-opacity duration-500 group-data-[max]/effort:opacity-100"
			/>
			<EffortSparks active={maxed} />
			<div className="flex items-center gap-2 text-[13px]">
				<span className="text-muted-foreground">Esforço</span>
				<span className="font-medium text-foreground">{effortLabel(efforts[index])}</span>
				<CircleHelp
					aria-label="Mais esforço pensa mais antes de responder e gasta o limite mais rápido"
					className="ml-auto size-3.5 text-muted-foreground/60"
				/>
			</div>
			<div className="mt-3 flex justify-between text-xs text-muted-foreground">
				<span>Mais rápido</span>
				<span>Mais capaz</span>
			</div>
			<div
				role="slider"
				tabIndex={0}
				aria-label="Esforço"
				aria-valuemin={0}
				aria-valuemax={efforts.length - 1}
				aria-valuenow={index}
				aria-valuetext={effortLabel(efforts[index])}
				data-slot="effort-slider"
				onPointerDown={(event) => {
					if (event.button !== 0) {
						return;
					}
					event.currentTarget.setPointerCapture?.(event.pointerId);
					onPreview(fromPointer(event));
				}}
				onPointerMove={(event) => {
					if (event.buttons & 1) {
						onPreview(fromPointer(event));
					}
				}}
				onPointerUp={(event) => onCommit(fromPointer(event))}
				onKeyDown={onKeyDown}
				style={{ "--effort-x": stepAt(index), "--effort-fill": fillAt(index) } as CSSProperties}
				className="relative mt-1 flex h-12 cursor-pointer touch-none select-none items-center outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<span className="absolute inset-x-0 h-[22px] bg-foreground/8" />
				<span className="absolute left-0 h-[22px] w-[var(--effort-fill)] bg-foreground/18 transition-[width,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-data-[max]/effort:bg-primary/35 motion-reduce:transition-colors" />
				{efforts.map((effort, step) => (
					<i
						key={effort}
						className="absolute -ml-0.5 size-1 rounded-full bg-foreground/30"
						style={{ left: stepAt(step) }}
					/>
				))}
				<span className="absolute -ml-[7px] h-7 w-3.5 bg-foreground shadow-xs transition-[left,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [left:var(--effort-x)] group-data-[max]/effort:bg-primary motion-reduce:transition-colors" />
			</div>
			<div className="mt-1 flex justify-between">
				{efforts.map((effort, step) => (
					<button
						key={effort}
						type="button"
						data-slot="effort"
						data-value={effort}
						aria-label={effortLabel(effort)}
						onMouseDown={keepFocus}
						onClick={() => onCommit(step)}
						className={cn(
							"min-h-12 min-w-0 flex-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:min-h-7",
							step === index
								? "font-semibold text-foreground"
								: "text-muted-foreground/60 hover:text-foreground",
						)}
					>
						{effortLabel(effort)}
					</button>
				))}
			</div>
		</div>
	);
}

export function ModelPicker({
	catalog,
	session,
	value,
	onChange,
	status = "idle",
	disabled = false,
	allowCliChange = true,
}: ModelPickerProps) {
	const [menu, setMenu] = useState<"model" | "effort" | null>(null);
	const root = useRef<HTMLDivElement>(null);
	// O menu abre acima da caixa de mensagem inteira, como no prompt bar: ancorado no chip, ele
	// cobriria o campo que a pessoa está digitando.
	const anchor = useRef({
		getBoundingClientRect: () =>
			(
				root.current?.closest("[data-component=thread-composer]")?.firstElementChild ?? root.current
			)?.getBoundingClientRect() ?? new DOMRect(),
	});
	const [active, setActive] = useState(0);
	const [preview, setPreview] = useState<number | null>(null);
	const options = modelRows(catalog?.[value.cli] ?? []);
	const selected = options.find((option) => option.id === value.model);
	const efforts = selected?.efforts ?? [];
	const effortIndex = preview ?? Math.max(0, efforts.indexOf(value.effort ?? ""));
	const maxed = efforts.length > 1 && effortIndex === efforts.length - 1;
	const pending = value.cli !== session.cli;
	const modelLabel =
		modelOptionLabel(options, value.model) ?? `${agentRadarAgentLabel(value.cli)} · padrão`;

	function open(next: "model" | "effort" | null) {
		setMenu(next);
		setPreview(null);
		if (next === "model") {
			setActive(Math.max(0, options.indexOf(selected!)));
		}
	}

	function pick(option: CliModelOption) {
		onChange({
			...value,
			model: option.id,
			effort:
				value.effort && option.efforts.includes(value.effort) ? value.effort : option.defaultEffort,
		});
		setMenu(null);
	}

	function changeCli(cli: ModelTarget["cli"]) {
		if (cli === value.cli) {
			return;
		}
		const back = cli === session.cli;
		onChange({ cli, model: back ? session.model : null, effort: back ? session.effort : null });
		setActive(0);
	}

	function commitEffort(index: number) {
		setPreview(null);
		const effort = efforts[index];
		if (effort && effort !== value.effort) {
			onChange({ ...value, effort });
		}
	}

	function onModelKey(event: KeyboardEvent<HTMLButtonElement>) {
		if (menu !== "model" || options.length === 0) {
			return;
		}
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			setActive((active + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
		}
		if (event.key === "Enter" || event.key === "Tab") {
			event.preventDefault();
			pick(options[active]!);
		}
	}

	function onEffortKey(event: KeyboardEvent<HTMLButtonElement>) {
		if (menu !== "effort") {
			return;
		}
		const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
		if (step) {
			event.preventDefault();
			commitEffort(Math.max(0, Math.min(efforts.length - 1, effortIndex + step)));
		}
	}

	const popover =
		"w-[min(22rem,calc(100vw-1rem))] max-h-[min(var(--radix-popover-content-available-height),30rem)] overflow-y-auto overscroll-contain p-1";

	return (
		<div
			ref={root}
			data-component="model-picker"
			data-pending={pending || undefined}
			data-status={status}
			className="flex min-w-0 flex-1 items-center gap-0.5"
		>
			<Popover open={menu === "model"} onOpenChange={(next) => open(next ? "model" : null)}>
				<PopoverTrigger asChild>
					<button
						type="button"
						aria-label="Escolher modelo"
						data-slot="model-trigger"
						data-open={menu === "model" || undefined}
						disabled={disabled}
						onMouseDown={keepFocus}
						onKeyDown={onModelKey}
						className={cn(CHIP, "flex-1 justify-start sm:flex-none")}
					>
						<CliLogo cli={value.cli} className="size-4 shrink-0" />
						<span className="min-w-0 truncate">{modelLabel}</span>
						{status === "applying" && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
						{status === "applied" && <Check className="size-3.5 shrink-0 text-primary" />}
						{status === "failed" && <AlertCircle className="size-3.5 shrink-0 text-destructive" />}
						{status === "idle" && <ChevronDown className="size-3.5 shrink-0 opacity-60" />}
						{pending && (
							<span
								aria-hidden
								className="absolute top-1.5 right-1 size-1.5 rounded-full bg-primary"
							/>
						)}
					</button>
				</PopoverTrigger>
				<PopoverAnchor virtualRef={anchor} />
				<PopoverContent
					side="top"
					align="start"
					sideOffset={8}
					collisionPadding={8}
					onOpenAutoFocus={keepFocus}
					onCloseAutoFocus={keepFocus}
					className={popover}
				>
					<ModelMenu
						options={options}
						session={session}
						value={value}
						active={active}
						onActive={setActive}
						onPick={pick}
						onCli={changeCli}
						allowCliChange={allowCliChange}
					/>
				</PopoverContent>
			</Popover>

			{efforts.length > 0 && (
				<Popover open={menu === "effort"} onOpenChange={(next) => open(next ? "effort" : null)}>
					<PopoverTrigger asChild>
						<button
							type="button"
							aria-label="Escolher esforço"
							data-slot="effort-trigger"
							data-open={menu === "effort" || undefined}
							data-max={maxed || undefined}
							disabled={disabled}
							onMouseDown={keepFocus}
							onKeyDown={onEffortKey}
							className={cn(CHIP, "data-[max]:text-primary")}
						>
							<Sparkles className="size-3.5 shrink-0 max-sm:hidden" />
							<span className="truncate">{effortLabel(efforts[effortIndex])}</span>
						</button>
					</PopoverTrigger>
					<PopoverAnchor virtualRef={anchor} />
					<PopoverContent
						side="top"
						align="start"
						sideOffset={8}
						collisionPadding={8}
						onOpenAutoFocus={keepFocus}
						onCloseAutoFocus={keepFocus}
						className="w-[min(18rem,calc(100vw-1rem))] p-0"
					>
						<EffortPanel
							efforts={efforts}
							index={effortIndex}
							onPreview={setPreview}
							onCommit={commitEffort}
						/>
					</PopoverContent>
				</Popover>
			)}

			<span role="status" aria-live="polite" className="sr-only">
				{STATUS_TEXT[status]}
			</span>
		</div>
	);
}
