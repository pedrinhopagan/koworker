import { useState } from "react";

import { cn } from "@/lib/utils";

type ProjectLogoProps = {
	project: {
		id: string;
		color: string;
	};
};

export function ProjectLogo({ project }: ProjectLogoProps) {
	const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

	return (
		<div
			className="relative size-8 shrink-0 overflow-hidden bg-muted"
			style={{ backgroundColor: project.color }}
			aria-hidden
		>
			{status !== "error" && (
				<img
					src={`/api/project-logos/${encodeURIComponent(project.id)}`}
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
