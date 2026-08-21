import type { LucideIcon } from "lucide-react";

import { CliLogo, cliLogoVisual, ClaudeLogo, CodexLogo } from "@/components/icons/cli-logos";
import { Text } from "@/components/typography";
import { agentRadarAgentLabel } from "@/constants/agent-radar";
import { cn } from "@/lib/utils";

export const ClaudeCodeIcon = ClaudeLogo;
export const CodexIcon = CodexLogo;

type AgentCliVisual = {
	label: string;
	icon: LucideIcon;
	tone: string;
};

export function agentCliVisual(agent: string): AgentCliVisual {
	return {
		label: agentRadarAgentLabel(agent),
		...cliLogoVisual(agent),
	};
}

export function AgentCliIcon({ agent, className }: { agent: string; className?: string }) {
	return <CliLogo cli={agent} className={cn("size-3.5", className)} />;
}

export function AgentCliName({
	agent,
	className,
	iconClassName,
}: {
	agent: string;
	className?: string;
	iconClassName?: string;
}) {
	return (
		<span className={cn("flex min-w-0 items-center gap-1.5", className)}>
			<AgentCliIcon agent={agent} className={iconClassName} />
			<Text as="span" size="xs" className="truncate font-semibold">
				{agentRadarAgentLabel(agent)}
			</Text>
		</span>
	);
}
