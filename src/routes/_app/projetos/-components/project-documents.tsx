import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, FileText } from "lucide-react";
import { useMemo } from "react";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { PROJECT_DOC_NAMES, resolveProjectDocIcon } from "@/constants/projects";
import { LucideIcon } from "@/lib/lucide-icon";

type ProjectDocumentsProps = {
	projectId: string;
};

export function ProjectDocuments({ projectId }: ProjectDocumentsProps) {
	const docsQuery = useQuery(orpc.projects.listDocs.queryOptions({ input: { id: projectId } }));
	const docs = useMemo(() => docsQuery.data ?? [], [docsQuery.data]);
	const groups = useMemo(
		() =>
			PROJECT_DOC_NAMES.map((name) => ({
				name,
				docs: docs
					.filter((doc) => doc.name === name)
					.sort(
						(a, b) =>
							a.dirLabel.split("/").filter(Boolean).length -
								b.dirLabel.split("/").filter(Boolean).length ||
							a.dirLabel.localeCompare(b.dirLabel),
					),
			})).filter((group) => group.docs.length > 0),
		[docs],
	);

	return (
		<section className="flex min-w-0 flex-col lg:h-full">
			<div className="border-b border-border pb-4">
				<Text size="xs" tone="faint" className="font-mono uppercase tracking-[0.14em]">
					Documentos
				</Text>
				<div className="mt-1 flex items-baseline justify-between gap-3">
					<Title as="h2" size="lg">
						Base do projeto
					</Title>
					<Text size="xs" tone="faint" className="font-mono tabular-nums">
						{docs.length} arquivos
					</Text>
				</div>
				<Text size="xs" tone="muted" className="mt-1">
					Arquivos de contexto encontrados na raiz e subpastas.
				</Text>
			</div>

			<div className="mt-4 space-y-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2 lg:[scrollbar-gutter:stable]">
				{docsQuery.isLoading && (
					<Text size="sm" tone="muted">
						Mapeando documentos...
					</Text>
				)}
				{!docsQuery.isLoading && docs.length === 0 && (
					<div className="border-l-2 border-border bg-muted/15 px-4 py-5">
						<FileText className="size-5 text-muted-foreground" />
						<Title as="div" size="sm" className="mt-3">
							Nenhum documento-base
						</Title>
						<Text size="xs" tone="muted" className="mt-1">
							CLAUDE.md, AGENTS.md e arquivos equivalentes aparecerão aqui.
						</Text>
					</div>
				)}
				{groups.map((group) => (
					<div key={group.name}>
						<div className="mb-1.5 flex items-center gap-2 text-muted-foreground">
							<LucideIcon name={resolveProjectDocIcon(group.name)} className="size-3.5" />
							<Text
								as="div"
								size="xs"
								tone="muted"
								className="font-mono font-semibold uppercase tracking-[0.1em]"
							>
								{group.name}
							</Text>
							<span className="font-mono text-[10px]">{group.docs.length}</span>
						</div>
						<div className="divide-y divide-border border-y border-border">
							{group.docs.map((doc) => (
								<Link
									key={doc.path}
									to="/projetos/$projetoId/docs/$"
									params={{ projetoId: projectId, _splat: doc.path }}
									className="group flex min-w-0 cursor-pointer items-center gap-3 px-1 py-3 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
								>
									<LucideIcon
										name={resolveProjectDocIcon(doc.name)}
										className="size-4 shrink-0 text-muted-foreground"
									/>
									<div className="min-w-0 flex-1">
										<Text as="div" size="xs" className="truncate font-mono font-semibold">
											{doc.dirLabel}
										</Text>
										<Text
											as="div"
											size="xs"
											tone="faint"
											className="truncate font-mono text-[10px]"
										>
											{doc.path}
										</Text>
									</div>
									<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
								</Link>
							))}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
