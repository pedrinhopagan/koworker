export const projectColorFamilies = [
	{
		name: "Vermelhos",
		colors: [
			{ value: "#d95d75", label: "Vermelho profundo" },
			{ value: "#f7768e", label: "Vermelho" },
			{ value: "#f38ba8", label: "Framboesa" },
			{ value: "#eba0ac", label: "Salmão" },
		],
	},
	{
		name: "Laranjas",
		colors: [
			{ value: "#d97757", label: "Terracota" },
			{ value: "#ff9e64", label: "Coral" },
			{ value: "#fab387", label: "Pêssego" },
			{ value: "#ffc9a3", label: "Areia" },
		],
	},
	{
		name: "Dourados",
		colors: [
			{ value: "#d4a054", label: "Dourado profundo" },
			{ value: "#e0af68", label: "Dourado" },
			{ value: "#ebcb8b", label: "Amarelo" },
			{ value: "#f9e2af", label: "Creme" },
		],
	},
	{
		name: "Verdes",
		colors: [
			{ value: "#74a465", label: "Verde profundo" },
			{ value: "#9ece6a", label: "Verde" },
			{ value: "#a6e3a1", label: "Verde claro" },
			{ value: "#cbe5b6", label: "Menta" },
		],
	},
	{
		name: "Turquesas",
		colors: [
			{ value: "#4fbfa6", label: "Turquesa profundo" },
			{ value: "#73daca", label: "Turquesa" },
			{ value: "#94e2d5", label: "Água" },
			{ value: "#c0ede4", label: "Espuma" },
		],
	},
	{
		name: "Céus",
		colors: [
			{ value: "#58b7e0", label: "Céu profundo" },
			{ value: "#7dcfff", label: "Céu" },
			{ value: "#89dceb", label: "Ciano" },
			{ value: "#b8e8f5", label: "Gelo" },
		],
	},
	{
		name: "Azuis",
		colors: [
			{ value: "#6584e8", label: "Azul profundo" },
			{ value: "#7aa2f7", label: "Azul" },
			{ value: "#89b4fa", label: "Azul claro" },
			{ value: "#b4befe", label: "Lavanda" },
		],
	},
	{
		name: "Roxos",
		colors: [
			{ value: "#9d7cd8", label: "Roxo profundo" },
			{ value: "#bb9af7", label: "Violeta" },
			{ value: "#cba6f7", label: "Roxo" },
			{ value: "#ddc7fa", label: "Lilás" },
		],
	},
	{
		name: "Rosas",
		colors: [
			{ value: "#d883b6", label: "Rosa profundo" },
			{ value: "#f0a3d1", label: "Rosa" },
			{ value: "#f5c2e7", label: "Rosa claro" },
			{ value: "#f2cdcd", label: "Rosado" },
		],
	},
	{
		name: "Neutros",
		colors: [
			{ value: "#737994", label: "Grafite" },
			{ value: "#9399b2", label: "Cinza" },
			{ value: "#a5adcb", label: "Cinza claro" },
			{ value: "#c6cbe0", label: "Névoa" },
		],
	},
];

export const projectColorOptions = projectColorFamilies.flatMap((family) => family.colors);

export const defaultProjectColor = "#9ece6a";
