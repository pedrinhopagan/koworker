import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion, MotionConfig, type PanInfo } from "motion/react";
import { create } from "zustand";

type ToastKind = "success" | "error" | "info" | "warning";

interface ToastOptions {
	id?: string;
	description?: string;
	action?: { label: string; onClick: () => void };
	duration?: number;
}

interface ToastEntry extends ToastOptions {
	id: string;
	kind: ToastKind;
	message: string;
	version: number;
}

type ToastStore = {
	toasts: ToastEntry[];
	dismiss: (id: string) => void;
};

const TOAST_DEFAULT_DURATION = 4000;
const TOAST_VISIBLE_LIMIT = 3;
const TOAST_SWIPE_DISTANCE = 80;
const TOAST_SWIPE_VELOCITY = 500;

export const useToastStore = create<ToastStore>((set) => ({
	toasts: [],
	dismiss(id) {
		set((state) => ({ toasts: state.toasts.filter((entry) => entry.id !== id) }));
	},
}));

function show(kind: ToastKind, message: string, options?: ToastOptions) {
	const id = options?.id ?? crypto.randomUUID();

	useToastStore.setState((state) => {
		const current = state.toasts.find((entry) => entry.id === id);

		if (!current) {
			return { toasts: [...state.toasts, { ...options, id, kind, message, version: 0 }] };
		}

		return {
			toasts: state.toasts.map((entry) =>
				entry.id === id ? { ...options, id, kind, message, version: entry.version + 1 } : entry,
			),
		};
	});

	return id;
}

export const toast = {
	success: (message: string, options?: ToastOptions) => show("success", message, options),
	error: (message: string, options?: ToastOptions) => show("error", message, options),
	info: (message: string, options?: ToastOptions) => show("info", message, options),
	warning: (message: string, options?: ToastOptions) => show("warning", message, options),
};

const TOAST_ICONS = {
	success: <CircleCheck aria-hidden className="size-[18px] shrink-0 text-success" />,
	error: <CircleAlert aria-hidden className="size-[18px] shrink-0 text-destructive" />,
	warning: <TriangleAlert aria-hidden className="size-[18px] shrink-0 text-warning" />,
	info: <Info aria-hidden className="size-[18px] shrink-0 text-muted-foreground" />,
};

export function Toaster() {
	const toasts = useToastStore((state) => state.toasts);

	return (
		<MotionConfig reducedMotion="user">
			<ol
				aria-label="Notificações"
				className="toaster group fixed right-4 bottom-4 z-[100] flex w-[356px] max-w-[calc(100vw-32px)] flex-col gap-2.5"
			>
				<AnimatePresence initial={false}>
					{toasts.slice(-TOAST_VISIBLE_LIMIT).map((entry) => (
						<SwipeToast key={entry.id} entry={entry} />
					))}
				</AnimatePresence>
			</ol>
		</MotionConfig>
	);
}

function SwipeToast({ entry }: { entry: ToastEntry }) {
	const dismiss = useToastStore((state) => state.dismiss);

	function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
		const swiped =
			Math.abs(info.offset.x) > TOAST_SWIPE_DISTANCE ||
			Math.abs(info.velocity.x) > TOAST_SWIPE_VELOCITY;

		if (swiped) {
			dismiss(entry.id);
		}
	}

	return (
		<motion.li
			layout
			role={entry.kind === "error" ? "alert" : "status"}
			initial={{ opacity: 0, y: 16, scale: 0.96 }}
			animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
			exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
			transition={{ type: "spring", stiffness: 420, damping: 34 }}
			drag="x"
			dragSnapToOrigin
			dragElastic={0.6}
			onDragEnd={handleDragEnd}
			className="relative flex min-h-[60px] touch-pan-y cursor-grab items-center gap-2.5 overflow-hidden border border-border bg-popover py-3 pr-12 pl-3.5 text-[13px] text-popover-foreground shadow-[0_6px_24px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.12)] active:cursor-grabbing max-sm:pr-[54px]"
		>
			{TOAST_ICONS[entry.kind]}
			<div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.4]">
				<span className="font-semibold break-words">{entry.message}</span>
				{entry.description && (
					<span className="text-muted-foreground break-words">{entry.description}</span>
				)}
			</div>
			{entry.action && (
				<button
					type="button"
					onClick={() => {
						entry.action?.onClick();
						dismiss(entry.id);
					}}
					className="ml-auto min-h-7 shrink-0 bg-foreground px-[9px] py-[5px] text-xs leading-[1.2] text-background transition-colors duration-150 ease-out hover:bg-muted-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					{entry.action.label}
				</button>
			)}
			<button
				type="button"
				aria-label="Fechar notificação"
				onClick={() => dismiss(entry.id)}
				className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring max-sm:right-1 max-sm:size-11"
			>
				<X aria-hidden className="size-4" />
			</button>
			<span
				key={entry.version}
				aria-hidden
				onAnimationEnd={() => dismiss(entry.id)}
				style={{ animationDuration: `${entry.duration ?? TOAST_DEFAULT_DURATION}ms` }}
				className="toast-fuse absolute bottom-0 left-0 h-0.5 w-full origin-left bg-current opacity-25"
			/>
		</motion.li>
	);
}
