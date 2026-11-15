export const CONVERSATION_PROFILES = [
	{ id: "default", label: "Padrão", command: "codex" },
	{ id: "personal", label: "Pessoal", command: "codex-personal" },
] as const;

export const CONVERSATION_DEFAULT_PERMISSION = "full";

export const CONVERSATION_PERMISSIONS = [
	{
		id: "workspace",
		label: "Acesso ao projeto",
		approvalPolicy: "on-request",
		sandbox: "workspace-write",
	},
	{ id: "full", label: "Acesso completo", approvalPolicy: "never", sandbox: "danger-full-access" },
] as const;

export const CONVERSATION_EFFORT_LABELS = {
	none: "Nenhum",
	minimal: "Mínimo",
	low: "Baixo",
	medium: "Médio",
	high: "Alto",
	xhigh: "Muito alto",
	max: "Máximo",
	ultra: "Ultra",
};

export const CONVERSATION_MESSAGE_LABELS = {
	sending: "Enviando",
	accepted: "Recebida pelo Codex",
	confirmed: "Confirmada",
	uncertain: "Entrega a confirmar",
	failed: "Envio falhou",
};

export const CONVERSATION_ITEM_LABELS: Record<string, string> = {
	commandExecution: "Comando",
	functionCallOutput: "Resultado de ferramenta",
	imageView: "Ver imagem",
	imageGeneration: "Gerar imagem",
	sleep: "Aguardar",
	subAgentActivity: "Atividade de agente",
	notice: "Aviso",
	fileChange: "Arquivos alterados",
	mcpToolCall: "Ferramenta",
	dynamicToolCall: "Ferramenta",
	collabAgentToolCall: "Agente",
	webSearch: "Pesquisa na web",
	contextCompaction: "Contexto compactado",
	plan: "Plano",
	reasoning: "Pensamento",
	enteredReviewMode: "Revisão",
	exitedReviewMode: "Revisão concluída",
};
