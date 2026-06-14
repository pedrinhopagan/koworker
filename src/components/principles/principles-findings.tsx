import { Info, TriangleAlert } from "lucide-react";

import { Text } from "@/components/typography";
import { Chip } from "@/components/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PrinciplesFinding } from "@/lib/principles/lint";
import { cn } from "@/lib/utils";

// Badge dos findings de princípios sobre uma skill/agent. Um warn pesa mais que vários infos: se há
// qualquer warn o chip vira destructive com TriangleAlert; só-info fica discreto (outline + Info). O
// popover lista título + detalhe de cada finding. Sem finding nenhum, não renderiza nada.
export function PrinciplesFindings({ findings }: { findings: PrinciplesFinding[] }) {
	if (findings.length === 0) {
		return null;
	}

	const hasWarn = findings.some((finding) => finding.severity === "warn");

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button type="button" className="cursor-pointer">
					<Chip size="xs" variant={hasWarn ? "destructive" : "outline"} className="gap-1">
						{hasWarn ? <TriangleAlert className="size-3" /> : <Info className="size-3" />}
						{findings.length}
					</Chip>
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 p-3">
				<div className="flex flex-col gap-2.5">
					{findings.map((finding) => (
						<div key={finding.ruleId} className="flex flex-col gap-0.5">
							<div className="flex items-center gap-1.5">
								<TriangleAlert
									className={cn(
										"size-3 shrink-0",
										finding.severity === "warn" ? "text-destructive" : "text-muted-foreground/60",
									)}
								/>
								<Text size="xs" className="font-medium">
									{finding.title}
								</Text>
							</div>
							<Text size="xs" tone="muted" className="leading-snug">
								{finding.detail}
							</Text>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
