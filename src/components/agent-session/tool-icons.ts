import {
	FileCode,
	FilePen,
	FilePlus,
	Folder,
	Globe,
	ListTodo,
	Search,
	Sparkles,
	Terminal,
	Users,
	type LucideIcon,
} from "lucide-react";

// A chave é o rótulo que os tradutores dos CLIs dão à ferramenta, não o nome cru dela: quem desenha
// o passo lê o mesmo texto que aparece na tela.
export const TOOL_ICONS: Record<string, LucideIcon> = {
	Terminal,
	"Ler arquivo": FileCode,
	"Editar arquivo": FilePen,
	"Escrever arquivo": FilePlus,
	"Editar notebook": FilePen,
	"Alterar arquivos": FilePen,
	"Buscar no código": Search,
	"Listar arquivos": Folder,
	"Abrir página": Globe,
	"Pesquisar na web": Globe,
	"Atualizar plano": ListTodo,
	"Ver imagem": FileCode,
	"Gerar imagem": Sparkles,
	Subagente: Users,
	Skill: Sparkles,
	"Ferramenta MCP": Sparkles,
};
