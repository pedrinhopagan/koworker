import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, MoreHorizontal, Square, X } from "lucide-react";
import { useState } from "react";
import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Text } from "@/components/typography";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/orpc-errors";

export function ConversationPaneActions({
	paneId,
	busy,
	disabled,
}: {
	paneId: string;
	busy: boolean;
	disabled: boolean;
}) {
	const [closing, setClosing] = useState(false);
	const navigate = useNavigate();
	const { mutate: interrupt, isPending: interrupting } = useMutation(
		orpc.agentRadar.interrupt.mutationOptions({
			onError: (error) =>
				toast.error(errorMessage(error, "Não foi possível interromper a execução")),
		}),
	);
	const {
		mutate: close,
		isPending: closingPane,
		error: closeError,
		reset: resetClose,
	} = useMutation(
		orpc.agentRadar.close.mutationOptions({
			onSuccess: async () => {
				setClosing(false);
				await navigate({ to: "/chat", search: {} });
			},
		}),
	);

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="size-11 shrink-0"
						aria-label="Ações da sessão"
						disabled={disabled || interrupting || closingPane}
					>
						{interrupting && <Loader2 className="size-4 animate-spin" />}
						{!interrupting && <MoreHorizontal className="size-5" />}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						className="min-h-11"
						disabled={!busy}
						onSelect={() => interrupt({ paneId })}
					>
						<Square />
						Interromper execução
					</DropdownMenuItem>
					<DropdownMenuItem
						className="min-h-11 text-destructive"
						onSelect={() => {
							resetClose();
							setClosing(true);
						}}
					>
						<X />
						Encerrar sessão
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog
				open={closing}
				onClose={() => !closingPane && setClosing(false)}
				title="Encerrar sessão"
				description="A sessão será fechada no kw-terminal. O histórico da conversa continuará disponível."
				footer={
					<Button
						variant="destructive"
						className="min-h-11"
						disabled={closingPane}
						onClick={() => close({ paneId })}
					>
						{closingPane && <Loader2 className="size-4 animate-spin" />}Encerrar sessão
					</Button>
				}
			>
				<Text size="sm">A execução em andamento também será encerrada.</Text>
				{closeError && (
					<Text role="alert" size="sm" tone="destructive" className="mt-3">
						{closeError.message}
					</Text>
				)}
			</Dialog>
		</>
	);
}
