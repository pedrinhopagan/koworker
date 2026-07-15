import { CheckCircle2, Copy, ExternalLink, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const GROQ_ENV_LINE = "GROQ_API_KEY=gsk_...";

const steps = [
	{
		icon: KeyRound,
		title: "Abra o painel de chaves",
		description:
			"Entre na sua conta GroqCloud. Se ainda não tiver uma, crie a conta e volte à página de chaves.",
	},
	{
		icon: CheckCircle2,
		title: "Crie e copie a chave",
		description:
			"Clique em Create API Key, dê o nome koworker e copie o valor que começa com gsk_ assim que ele for exibido.",
	},
	{
		icon: Copy,
		title: "Cole no ambiente do backend",
		description:
			"Em desenvolvimento, use o .env da raiz do projeto. No aplicativo instalado, use o arquivo backend.env da pasta de dados.",
	},
	{
		icon: RefreshCw,
		title: "Reinicie o Koworker",
		description:
			"No desenvolvimento, reinicie bun run dev:web. No aplicativo instalado, reinicie kowork-backend.service. Depois, volte aqui e transcreva uma gravação.",
	},
];

export function GroqSetupGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
	async function handleCopy() {
		const copied = await navigator.clipboard.writeText(GROQ_ENV_LINE).then(
			() => true,
			() => false,
		);
		toast[copied ? "success" : "error"](copied ? "Linha copiada" : "Não foi possível copiar");
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Ativar transcrição com Groq"
			description="Você faz isso uma única vez no computador que executa o backend."
			className="max-w-xl"
			footer={<Button onClick={onClose}>Entendi</Button>}
		>
			<div className="space-y-5">
				<div className="border border-primary bg-primary/10 p-4">
					<Title as="h3" size="sm">
						Comece pela GroqCloud
					</Title>
					<Text size="sm" tone="muted" className="mt-1">
						A criação da chave é feita no site oficial. Apenas proprietários e usuários com perfil
						de desenvolvedor podem gerenciar chaves.
					</Text>
					<Button asChild className="mt-3 w-full sm:w-auto">
						<a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
							Abrir página de chaves
							<ExternalLink className="size-4" />
						</a>
					</Button>
				</div>

				<ol className="space-y-4">
					{steps.map((step, index) => {
						const Icon = step.icon;

						return (
							<li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
								<span className="flex size-8 items-center justify-center border border-border bg-muted font-mono text-xs font-bold">
									{index + 1}
								</span>
								<div className="min-w-0 border-b border-border pb-4">
									<div className="flex items-center gap-2">
										<Icon className="size-4 text-primary" />
										<Title as="h3" size="sm">
											{step.title}
										</Title>
									</div>
									<Text size="sm" tone="muted" className="mt-1 leading-6">
										{step.description}
									</Text>
									{index === 2 && (
										<div className="mt-3 space-y-2">
											<div className="flex min-w-0 items-center gap-2 border border-border bg-background p-2">
												<code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs">
													{GROQ_ENV_LINE}
												</code>
												<Button
													type="button"
													size="icon-sm"
													variant="outline"
													onClick={() => void handleCopy()}
													aria-label="Copiar variável de ambiente"
												>
													<Copy className="size-4" />
												</Button>
											</div>
											<Text size="xs" tone="muted" className="font-mono break-all">
												Produção: ~/.local/share/com.pedro.kowork/backend.env
											</Text>
										</div>
									)}
									{index === 3 && (
										<code className="mt-3 block overflow-x-auto border border-border bg-background p-2 font-mono text-xs">
											systemctl --user restart kowork-backend.service
										</code>
									)}
								</div>
							</li>
						);
					})}
				</ol>

				<Text size="xs" tone="muted">
					A chave fica somente no backend. Nunca cole o valor em uma tarefa, gravação, commit ou
					tela do navegador.
				</Text>
			</div>
		</Dialog>
	);
}
