import { LayoutDashboard } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Icon } from "@/components/ui/icon";

export function DashboardHeader() {
	return (
		<div className="border-b border-border px-6 py-4">
			<div className="flex items-center gap-3">
				<Icon icon={LayoutDashboard} color="var(--project-accent, var(--primary))" size="md" />
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
