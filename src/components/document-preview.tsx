import { ExternalLink, Loader2, RotateCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { openLinkTarget, fileHref } from "@/lib/link-navigation";

export function DocumentPreview({
	path,
	name,
	format,
	url,
	onReload,
}: {
	path: string;
	name: string;
	format: "html" | "pdf";
	url: string;
	onReload: () => Promise<unknown>;
}) {
	const [revision, setRevision] = useState(0);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);

	return (
		<div className="flex h-full min-h-0 flex-col" data-component="document-preview">
			<div className="flex h-10 shrink-0 items-center justify-end gap-1 border-b border-border px-2">
				{loading && (
					<Loader2
						className="mr-auto size-4 animate-spin text-muted-foreground"
						aria-label="Carregando documento"
					/>
				)}
				{failed && (
					<span role="alert" className="mr-auto text-sm text-muted-foreground">
						Não foi possível carregar o documento.
					</span>
				)}
				<Tooltip label="Recarregar documento">
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Recarregar documento"
						onClick={async () => {
							setLoading(true);
							setFailed(false);
							await onReload();
							setRevision((value) => value + 1);
						}}
					>
						<RotateCw className="size-4" />
					</Button>
				</Tooltip>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => void openLinkTarget(fileHref(path), undefined, undefined, true)}
				>
					<ExternalLink className="size-4" />
					Abrir externamente
				</Button>
			</div>
			<iframe
				key={revision}
				title={name}
				src={`${url}?v=${revision}`}
				sandbox={format === "html" ? "allow-scripts allow-downloads" : undefined}
				referrerPolicy="no-referrer"
				className="min-h-0 w-full flex-1 border-0 bg-background"
				onLoad={() => setLoading(false)}
				onError={() => {
					setLoading(false);
					setFailed(true);
				}}
			/>
		</div>
	);
}
