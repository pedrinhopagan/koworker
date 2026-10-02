export type DefaultAgentCategory = {
	name: string;
	color: string;
	agents: { slug: string; icon: string }[];
};

export const DEFAULT_AGENT_CATEGORIES: DefaultAgentCategory[] = [
	{
		name: "Execução",
		color: "#f59e0b",
		agents: [
			{ slug: "task-runner", icon: "Workflow" },
			{ slug: "builder", icon: "Hammer" },
			{ slug: "patcher", icon: "Wrench" },
			{ slug: "typist", icon: "Keyboard" },
		],
	},
	{
		name: "Investigação",
		color: "#0ea5e9",
		agents: [
			{ slug: "scout", icon: "Compass" },
			{ slug: "investigator", icon: "Microscope" },
			{ slug: "researcher", icon: "BookOpen" },
		],
	},
	{
		name: "Revisão",
		color: "#a855f7",
		agents: [
			{ slug: "reviewer", icon: "Eye" },
			{ slug: "skeptic", icon: "Scale" },
			{ slug: "verifier", icon: "ShieldCheck" },
		],
	},
	{
		name: "Entrega",
		color: "#10b981",
		agents: [{ slug: "shipper", icon: "Rocket" }],
	},
	{
		name: "Operações",
		color: "#ef4444",
		agents: [{ slug: "bateria-assinaturas", icon: "FlaskConical" }],
	},
];
