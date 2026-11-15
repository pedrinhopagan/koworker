import { useQuery } from "@tanstack/react-query";
import { FileCode2 } from "lucide-react";
import { useEffect, useRef, useState, type MouseEventHandler } from "react";

import { orpc, type RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { relativeTimeFrom } from "@/lib/relative-time";

type HtmlArtifact = Pick<
	RouterOutputs["mostruario"]["list"][number]["artifacts"][number],
	"name" | "mtime" | "metadata"
>;

export function HtmlCardPreview({
	path,
	name,
	mtime,
}: {
	path: string;
	name: string;
	mtime: number;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const { data, isError } = useQuery(
		orpc.system.readFile.queryOptions({
			input: { path },
			enabled: visible,
			staleTime: 60_000,
			throwOnError: false,
		}),
	);

	useEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}

		const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
		const resize = new ResizeObserver(([entry]) =>
			setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
		);
		intersection.observe(element);
		resize.observe(element);

		return () => {
			intersection.disconnect();
			resize.disconnect();
		};
	}, []);

	return (
		<div
			ref={ref}
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-muted"
		>
			{isError && (
				<Text as="span" size="xs" tone="muted" className="absolute left-4 top-4">
					Prévia indisponível
				</Text>
			)}
			{visible && size.width > 0 && data?.kind === "document" && data.format === "html" && (
				<iframe
					key={`${data.url}:${mtime}`}
					src={`${data.url}?v=${mtime}`}
					title={`Prévia de ${name}`}
					tabIndex={-1}
					sandbox="allow-scripts"
					loading="lazy"
					className="absolute left-0 top-0 w-[1280px] origin-top-left border-0"
					style={{
						height: Math.max(960, (size.height * 1280) / size.width),
						transform: `scale(${size.width / 1280})`,
					}}
				/>
			)}
		</div>
	);
}

export function HtmlArtifactCard({
	artifact,
	path,
	onClick,
	onAuxClick,
}: {
	artifact: HtmlArtifact;
	path?: string;
	onClick: MouseEventHandler<HTMLButtonElement>;
	onAuxClick: MouseEventHandler<HTMLButtonElement>;
}) {
	const title = artifact.metadata?.title ?? artifact.name;
	const headings = artifact.metadata?.headings ?? [];

	return (
		<button
			type="button"
			onClick={onClick}
			onAuxClick={onAuxClick}
			className="group relative h-96 w-full overflow-hidden border border-border bg-card text-left transition-colors hover:border-[var(--project-accent,var(--primary))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:border-ring"
		>
			{path && <HtmlCardPreview path={path} name={artifact.name} mtime={artifact.mtime} />}
			<div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 border border-border bg-card/80 p-4 text-foreground backdrop-blur-sm transition-transform duration-200 ease-out group-hover:translate-y-[calc(100%_-_5.5rem)] group-focus-visible:translate-y-[calc(100%_-_5.5rem)] motion-reduce:transition-none">
				<Title
					as="span"
					size="lg"
					title={title}
					className="flex h-14 shrink-0 items-center leading-snug"
				>
					<span className="line-clamp-2">{title}</span>
				</Title>
				<div className="flex flex-col gap-2 transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0 motion-reduce:transition-none">
					<Text as="span" size="xs" tone="muted" className="flex items-center gap-2">
						<FileCode2 className="size-4" />
						HTML · {relativeTimeFrom(artifact.mtime)}
					</Text>
					{artifact.metadata?.subtitle && (
						<Text as="span" size="sm" tone="muted" className="line-clamp-2">
							{artifact.metadata.subtitle}
						</Text>
					)}
					{headings.length > 0 && (
						<Text
							as="span"
							size="xs"
							tone="muted"
							className="line-clamp-2 border-t border-border pt-2"
						>
							{headings.join(" · ")}
						</Text>
					)}
					{title !== artifact.name && (
						<Text
							as="span"
							size="xs"
							tone="muted"
							title={artifact.name}
							className="truncate font-mono"
						>
							{artifact.name}
						</Text>
					)}
				</div>
			</div>
		</button>
	);
}
