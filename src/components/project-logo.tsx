import { useState } from "react";

import { cn } from "@/lib/utils";

const PROJECT_LOGO_VERSION = 2;

type ProjectLogoProps = {
	project: {
		id: string;
		color: string;
	};
	className?: string;
};

export function ProjectLogo({ project, className }: ProjectLogoProps) {
	const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

	return (
		<div
			className={cn("relative size-8 shrink-0 overflow-hidden bg-muted", className)}
			style={{ backgroundColor: project.color }}
			aria-hidden
		>
			{status !== "error" && (
				<img
					src={`/api/project-logos/${encodeURIComponent(project.id)}?v=${PROJECT_LOGO_VERSION}`}
					alt=""
					onLoad={() => setStatus("loaded")}
					onError={() => setStatus("error")}
					className={cn(
						"absolute inset-0 size-full bg-card object-contain p-1 transition-opacity duration-150",
						status === "loaded" ? "opacity-100" : "opacity-0",
					)}
				/>
			)}
		</div>
	);
}
