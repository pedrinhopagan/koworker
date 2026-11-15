import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SquareTerminal } from "lucide-react";
import { useState } from "react";
import { orpc } from "@/client";
import { NewSessionDialog } from "@/components/agent-radar/new-session-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/orpc-errors";

export function ConversationNewSession() {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const onSuccess = async () => {
		await queryClient.invalidateQueries({ queryKey: orpc.kwTerminal.overview.key() });
	};
	const { mutateAsync: startConversation } = useMutation(
		orpc.kwTerminal.sessionStart.mutationOptions({
			onSuccess,
			onError: (error) => toast.error(errorMessage(error, "Não foi possível abrir a sessão")),
		}),
	);
	const { mutateAsync: resumeConversation } = useMutation(
		orpc.kwTerminal.sessionResumeLast.mutationOptions({
			onSuccess,
			onError: (error) => toast.error(errorMessage(error, "Não foi possível retomar a sessão")),
		}),
	);

	return (
		<>
			<Button variant="outline" className="min-h-11 w-full" onClick={() => setOpen(true)}>
				<SquareTerminal className="size-4" />
				Abrir no kw-terminal
			</Button>
			{open && (
				<NewSessionDialog
					open={open}
					defaultCli="codex"
					actions={{ startConversation, resumeConversation }}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	);
}
