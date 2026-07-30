import { SnakeLoader } from "@/components/ui/snake-loader";

type SidebarAgentPulseProps = {
	layout: "compact" | "expanded" | "drawer";
	count: number;
};

// A cobrinha de "tem agent trabalhando" no item Terminais. Expandido e no drawer ela anda ao lado do
// rótulo; recolhido não existe rótulo, então ela se agarra ao canto do ícone.
export function SidebarAgentPulse({ layout, count }: SidebarAgentPulseProps) {
	if (count <= 0) {
		return null;
	}

	const label = `${count} agent${count > 1 ? "s" : ""} trabalhando`;

	if (layout === "compact") {
		return (
			<SnakeLoader label={label} className="absolute -right-1.5 -bottom-1.5 z-10 text-primary" />
		);
	}

	return <SnakeLoader label={label} className="text-primary" />;
}
