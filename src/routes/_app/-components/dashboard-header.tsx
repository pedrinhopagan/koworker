import { LayoutDashboard } from "lucide-react";
import { Text, Title } from "@/components/typography";

export function DashboardHeader() {
	return (
		<div className="border-b border-border px-6 py-4">
			<div className="flex items-center gap-3">
				<div className="p-2 bg-primary/10">
					<LayoutDashboard size={20} className="text-primary" />
				</div>
				<div>
					<Title size="md">Dashboard</Title>
					<Text size="sm" tone="muted">
						Seu painel de controle
					</Text>
				</div>
			</div>
		</div>
	);
}
