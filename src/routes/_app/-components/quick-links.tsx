import { memo, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
	ChevronRight,
	FileText,
	FolderPlus,
	Loader2,
	PlusCircle,
	Settings,
	Zap,
	type LucideIcon,
} from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";

type QuickLink = {
	id: string;
	title: string;
	description?: string;
	icon: LucideIcon;
	to: string;
	search?: Record<string, unknown>;
	color: string;
	isFixed?: boolean;
};

const LINK_COLORS: Record<string, string> = {
	"task-pending": "hsl(var(--warning))",
	"task-in-execution": "hsl(var(--primary))",
	"new-task": "hsl(var(--success))",
	"new-project": "hsl(var(--accent))",
	settings: "hsl(var(--muted-foreground))",
};

function getQuickLinks(tasks: TaskWithMeta[]): QuickLink[] {
	const links: QuickLink[] = [];

	const pendingCount = tasks.filter((t) => t.status === "pending").length;
	const inExecutionCount = tasks.filter((t) => t.status === "in_execution").length;

	if (inExecutionCount > 0) {
		links.push({
			id: "task-in-execution",
			title: "Tarefas em execução",
			description: `${inExecutionCount} tarefa(s) em andamento`,
			icon: Loader2,
			to: "/tarefas",
			search: { status: "in_execution" },
			color: LINK_COLORS["task-in-execution"],
		});
	}

	if (pendingCount > 0) {
		links.push({
			id: "task-pending",
			title: "Tarefas pendentes",
			description: `${pendingCount} tarefa(s) aguardando`,
			icon: FileText,
			to: "/tarefas",
			search: { status: "pending" },
			color: LINK_COLORS["task-pending"],
		});
	}

	// Fixed links (always shown)
	links.push({
		id: "new-task",
		title: "Criar nova tarefa",
		description: "Adicione uma tarefa ao projeto",
		icon: PlusCircle,
		to: "/tarefas",
		color: LINK_COLORS["new-task"],
		isFixed: true,
	});

	links.push({
		id: "new-project",
		title: "Novo projeto",
		description: "Configure um novo projeto",
		icon: FolderPlus,
		to: "/projetos/novo",
		color: LINK_COLORS["new-project"],
		isFixed: true,
	});

	links.push({
		id: "settings",
		title: "Configurações",
		description: "Ajuste preferências do app",
		icon: Settings,
		to: "/configuracoes",
		color: LINK_COLORS.settings,
		isFixed: true,
	});

	return links;
}

type QuickLinkItemProps = {
	link: QuickLink;
};

const QuickLinkItem = memo(function QuickLinkItem({ link }: QuickLinkItemProps) {
	const LinkIcon = link.icon;

	return (
		<Link
			to={link.to}
			search={link.search}
			className={cn(
				"group relative flex items-center gap-3 px-3 py-3",
				"bg-card border border-border",
				"transition-colors duration-200",
				"hover:border-primary/40 hover:bg-muted/30",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			)}
		>
			{/* Left accent bar */}
			<div
				className="absolute left-0 top-0 bottom-0 w-0.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200"
				style={{
					background: `linear-gradient(180deg, ${link.color} 0%, ${link.color}60 100%)`,
				}}
			/>

			{/* Hover gradient */}
			<div
				className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
				style={{
					background: `radial-gradient(ellipse at left center, ${link.color}08 0%, transparent 60%)`,
				}}
			/>

			<div
				className={cn(
					"relative p-2 bg-background/60 transition-colors duration-200",
					"group-hover:bg-background/80",
				)}
				style={{
					boxShadow: `inset 0 0 0 1px ${link.color}25`,
				}}
			>
				<LinkIcon
					size={14}
					style={{ color: link.color }}
					className="transition-colors duration-200"
				/>
			</div>

			<div className="relative flex-1 min-w-0">
				<Text
					as="span"
					size="sm"
					className={cn(
						"text-foreground transition-colors duration-200",
						"group-hover:text-primary",
					)}
				>
					{link.title}
				</Text>
				{link.description && (
					<Text
						as="p"
						size="xs"
						tone="muted"
						className="truncate mt-0.5 transition-colors duration-200"
					>
						{link.description}
					</Text>
				)}
			</div>

			<ChevronRight
				size={14}
				className="relative text-muted-foreground/50 group-hover:text-primary transition-colors duration-200"
			/>
		</Link>
	);
});

type QuickLinksProps = {
	tasks: TaskWithMeta[];
	className?: string;
};

export const QuickLinks = memo(function QuickLinks({ tasks, className }: QuickLinksProps) {
	const links = useMemo(() => getQuickLinks(tasks), [tasks]);
	const dynamicLinks = useMemo(() => links.filter((l) => !l.isFixed), [links]);
	const fixedLinks = useMemo(() => links.filter((l) => l.isFixed), [links]);

	return (
		<div className={cn("space-y-3", className)}>
			<div className="flex items-center gap-2 mb-3">
				<Icon icon={Zap} color="var(--project-accent, var(--primary))" size="xs" />
				<Title as="h3" size="sm" className="text-sm font-medium uppercase tracking-wide">
					Atalhos
				</Title>
			</div>

			{dynamicLinks.length > 0 && (
				<div className="space-y-1.5">
					{dynamicLinks.map((link) => (
						<QuickLinkItem key={link.id} link={link} />
					))}
				</div>
			)}

			{dynamicLinks.length > 0 && fixedLinks.length > 0 && (
				<div className="border-t border-border/30 my-2" />
			)}

			{fixedLinks.length > 0 && (
				<div className="space-y-1.5">
					{fixedLinks.map((link) => (
						<QuickLinkItem key={link.id} link={link} />
					))}
				</div>
			)}
		</div>
	);
});
