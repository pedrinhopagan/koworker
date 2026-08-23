import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { errorMessage } from "@/lib/orpc-errors";
import { cn } from "@/lib/utils";
import { ShellTerminal } from "./shell-terminal";

export function ShellPane({ shellId, onDismiss }: { shellId: string; onDismiss: () => void }) {
	const queryClient = useQueryClient();
	const [confirmingClose, setConfirmingClose] = useState(false);
	const [liveTitle, setLiveTitle] = useState<string | null>(null);
	const [liveStatus, setLiveStatus] = useState<"live" | "exited" | "closed" | null>(null);

	const shellQuery = useQuery(
		orpc.shells.get.queryOptions({
			input: { id: shellId },
			retry: false,
		}),
	);

	const shell = shellQuery.data ?? null;
	const missing = !!shellQuery.error;
	const status = liveStatus ?? shell?.status ?? "live";

	function refreshMeta() {
		void queryClient.invalidateQueries({ queryKey: orpc.shells.list.key() });
		void queryClient.invalidateQueries({
			queryKey: orpc.shells.get.queryOptions({ input: { id: shellId } }).queryKey,
		});
	}

	const close = useMutation({
		...orpc.shells.close.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: orpc.shells.list.key() });
			toast.success("Shell fechado");
			onDismiss();
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível fechar o shell")),
	});

	if (missing) {
		return (
			<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-6">
				<EmptyFeedback
					icon={X}
					title="Shell não encontrado"
					subtitle="Ele encerrou junto com uma reiniciada do backend."
				/>
			</div>
		);
	}

	return (
		<div data-component="shell-pane" className="flex min-h-0 min-w-0 flex-1 flex-col">
			<header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
				<span
					aria-hidden
					className={cn(
						"size-2 shrink-0 rounded-full",
						status === "live" ? "bg-primary" : "bg-muted-foreground/40",
					)}
				/>
				<Text size="sm" className="min-w-0 truncate font-semibold">
					{liveTitle ?? shell?.title ?? shell?.label}
				</Text>
				<Text as="span" size="xs" tone="muted" className="hidden truncate font-mono sm:block">
					{shell?.cwd}
				</Text>
				<span className="flex-1" />
				<Button
					variant="outline"
					size="sm"
					onClick={function () {
						setConfirmingClose(true);
					}}
				>
					<X className="size-4" />
					Fechar
				</Button>
			</header>

			<div className="relative min-h-0 flex-1 p-1">
				<ShellTerminal
					shellId={shellId}
					className="h-full w-full"
					onTitle={(title) => {
						setLiveTitle(title);
						refreshMeta();
					}}
					onStatus={(next) => {
						setLiveStatus(next);
						refreshMeta();
					}}
				/>

				{status !== "live" && (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
						<Text size="sm" className="font-semibold">
							{status === "exited"
								? `Shell encerrado (código ${shell?.exitCode ?? "?"})`
								: "Shell fechado"}
						</Text>
						<Button variant="outline" size="sm" onClick={() => close.mutate({ id: shellId })}>
							Retirar da lista
						</Button>
					</div>
				)}
			</div>

			<Dialog
				open={confirmingClose}
				onClose={function () {
					setConfirmingClose(false);
				}}
				title="Fechar shell"
				description="O processo do shell vai receber SIGHUP e morrer. Não dá para desfazer."
				className="max-w-sm bg-card text-card-foreground"
				footer={
					<div className="flex w-full justify-end gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={function () {
								setConfirmingClose(false);
							}}
						>
							Cancelar
						</Button>
						<Button
							variant="destructive"
							size="sm"
							disabled={close.isPending}
							onClick={function () {
								close.mutate({ id: shellId });
							}}
						>
							Fechar shell
						</Button>
					</div>
				}
			>
				<span />
			</Dialog>
		</div>
	);
}
