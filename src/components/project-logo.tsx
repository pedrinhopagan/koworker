import { FolderKanban } from "lucide-react";
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
		<div className={cn("relative size-8 shrink-0", className)} aria-hidden>
			{status === "error" && (
				<FolderKanban className="size-full" style={{ color: project.color }} />
			)}
			{status !== "error" && (
				<img
					src={`/api/project-logos/${encodeURIComponent(project.id)}?v=${PROJECT_LOGO_VERSION}`}
					alt=""
					onLoad={() => setStatus("loaded")}
					onError={() => setStatus("error")}
					className={cn(
						"absolute inset-0 size-full object-contain transition-opacity duration-150",
						status === "loaded" ? "opacity-100" : "opacity-0",
					)}
				/>
			)}
		</div>
	);
}
