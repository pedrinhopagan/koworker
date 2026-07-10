// Paleta de cores de domínio: usada por projetos. value = hex #rrggbb.
// Tons soft/jewel harmonizados (Tokyo Night + Catppuccin + Nord), espaçados pelo círculo cromático
// pra dar variedade real em vez de vários degraus da mesma cor. Inclui o dourado #e0af68.
export const projectColorOptions = [
	{ value: "#f7768e", label: "Vermelho" },
	{ value: "#eba0ac", label: "Salmão" },
	{ value: "#ff9e64", label: "Coral" },
	{ value: "#e0af68", label: "Dourado" },
	{ value: "#ebcb8b", label: "Amarelo" },
	{ value: "#9ece6a", label: "Verde" },
	{ value: "#a6e3a1", label: "Verde claro" },
	{ value: "#73daca", label: "Turquesa" },
	{ value: "#94e2d5", label: "Água" },
	{ value: "#7dcfff", label: "Ciano" },
	{ value: "#89dceb", label: "Céu" },
	{ value: "#7aa2f7", label: "Azul" },
	{ value: "#89b4fa", label: "Azul claro" },
	{ value: "#b4befe", label: "Lavanda" },
	{ value: "#bb9af7", label: "Violeta" },
	{ value: "#cba6f7", label: "Roxo" },
	{ value: "#b48ead", label: "Ameixa" },
	{ value: "#f5c2e7", label: "Rosa" },
	{ value: "#f2cdcd", label: "Rosado" },
	{ value: "#f38ba8", label: "Framboesa" },
];

export const defaultProjectColor = projectColorOptions[5]?.value ?? "#9ece6a";
