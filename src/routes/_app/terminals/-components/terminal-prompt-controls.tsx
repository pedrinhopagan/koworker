import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CornerDownLeft, X } from "lucide-react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";

const KEYS = [
	{ key: "Up", label: "Acima", icon: ArrowUp },
	{ key: "Down", label: "Abaixo", icon: ArrowDown },
	{ key: "Left", label: "Esquerda", icon: ArrowLeft },
	{ key: "Right", label: "Direita", icon: ArrowRight },
] as const;

export function TerminalPromptControls({
	pending,
	onSend,
}: {
	pending: boolean;
	onSend: (keys: (typeof KEYS)[number]["key"][] | ["Enter"] | ["Escape"]) => void;
}) {
	return (
		<div className="mx-auto mb-2 w-full max-w-3xl border border-warning/50 bg-warning/10 p-2">
			<div className="mb-2 flex items-center justify-between gap-3">
				<Text size="xs" className="font-semibold text-foreground">
					Controle do prompt nativo
				</Text>
				<Text size="xs" tone="muted" className="hidden sm:block">
					Navegue, confirme ou escreva abaixo
				</Text>
			</div>
			<div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
				{KEYS.map((item) => (
					<Button
						key={item.key}
						type="button"
						variant="outline"
						size="icon-lg"
						aria-label={item.label}
						disabled={pending}
						onClick={() => onSend([item.key])}
					>
						<item.icon className="size-4" />
					</Button>
				))}
				<Button
					type="button"
					variant="outline"
					size="lg"
					disabled={pending}
					onClick={() => onSend(["Escape"])}
				>
					<X className="size-4" />
					Cancelar
				</Button>
				<Button
					type="button"
					size="lg"
					disabled={pending}
					onClick={() => onSend(["Enter"])}
					className="ml-auto"
				>
					<CornerDownLeft className="size-4" />
					Confirmar
				</Button>
			</div>
		</div>
	);
}
