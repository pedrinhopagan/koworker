import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams, useSearch } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { orpc } from "@/client";
import { getActiveTabLabel } from "@/components/layout/mobile-nav-drawer";
import { cn } from "@/lib/utils";
import {
	canonicalTaskRoute,
	isTaskIdSegment,
	NO_FEATURE_ROUTE_ID,
} from "@/routes/_app/tarefas/-utils/task-route-resolution";

type Breadcrumb = {
	label: string;
	to: string;
	search?: { projectId?: string };
};

function BreadcrumbItems({ items, current }: { items: Breadcrumb[]; current: string }) {
	return items.map((item, index) => (
		<li
			key={item.to}
			className={cn(
				"flex min-w-0 items-center gap-1.5 sm:gap-2",
				index === 0 && "shrink-0",
				index > 0 && "flex-1 sm:flex-none",
			)}
		>
			<ChevronRight
				aria-hidden
				className={cn("size-3.5 shrink-0 text-muted-foreground", index === 0 && "hidden sm:block")}
			/>
			<Link
				to={item.to}
				search={item.search}
				aria-current={current === item.to ? "page" : undefined}
				title={item.label}
				className={cn(
					"truncate rounded-sm py-3 text-muted-foreground transition-colors hover:text-foreground sm:py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
					index === items.length - 1 && "max-w-80 font-medium text-foreground",
				)}
			>
				{item.label}
			</Link>
		</li>
	));
}

function TaskBreadcrumbs() {
	const { pathname } = useLocation();
	const { taskId: firstSegment, file: secondSegment } = useParams({ strict: false });
	const search = useSearch({ strict: false });
	const taskId = secondSegment && isTaskIdSegment(secondSegment) ? secondSegment : firstSegment;
	const { data: task } = useQuery(
		orpc.tasks.getFull.queryOptions({
			input: { id: taskId ?? "" },
			enabled: !!taskId && isTaskIdSegment(taskId),
		}),
	);
	const { data: groups, isPending } = useQuery(
		orpc.taskGroups.list.queryOptions({ input: {}, enabled: !!firstSegment }),
	);
	const featureId = task ? canonicalTaskRoute(task).featureId : firstSegment;
	const feature = groups?.find((group) => group.id === featureId);
	const featureLabel = feature?.name ?? (isPending ? "Carregando..." : "Feature indisponível");
	const projectId = task?.projectId ?? feature?.projectId ?? search.projectId;
	const items: Breadcrumb[] = [{ label: "Tarefas", to: "/tarefas", search: { projectId } }];

	if (featureId) {
		items.push({
			label: featureId === NO_FEATURE_ROUTE_ID ? "Sem feature" : featureLabel,
			to: `/tarefas/${encodeURIComponent(featureId)}`,
			search: { projectId },
		});
	}

	if (task) {
		items.push({
			label: task.displayTitle,
			to: `/tarefas/${encodeURIComponent(canonicalTaskRoute(task).featureId)}/${encodeURIComponent(task.id)}`,
			search: { projectId },
		});
	}

	return <BreadcrumbItems items={items} current={pathname.replace(/\/$/, "")} />;
}

function PageBreadcrumbs() {
	const { pathname } = useLocation();
	const segments = pathname.split("/").filter(Boolean);
	const { data: projects } = useQuery(
		orpc.projects.list.queryOptions({ enabled: segments[0] === "projetos" && segments.length > 1 }),
	);
	const items = segments.flatMap((segment, index) => {
		const to = `/${segments.slice(0, index + 1).join("/")}`;
		if (index === 0) {
			return [{ label: getActiveTabLabel(pathname), to }];
		}
		if (index !== segments.length - 1 && !(segments[0] === "projetos" && index === 1)) {
			return [];
		}
		return [
			{
				label:
					projects?.find((project) => project.id === segment)?.name ??
					{ novo: "Novo projeto", docs: "Documentos", history: "Histórico" }[segment] ??
					decodeURIComponent(segment),
				to,
			},
		];
	});

	return <BreadcrumbItems items={items} current={pathname.replace(/\/$/, "")} />;
}

export function WorkspaceBreadcrumbs() {
	const { pathname } = useLocation();
	const tasks = pathname === "/tarefas" || pathname.startsWith("/tarefas/");

	return (
		<nav aria-label="Breadcrumb" className="min-w-0 flex-1 text-sm">
			<ol className="flex min-w-0 items-center gap-1.5 sm:gap-2">
				<li className="hidden shrink-0 sm:block">
					<Link
						to="/"
						aria-current={pathname === "/" ? "page" : undefined}
						className="rounded-sm py-3 text-muted-foreground transition-colors hover:text-foreground sm:py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						Koworker
					</Link>
				</li>
				{pathname === "/" && <li className="font-medium sm:hidden">Koworker</li>}
				{tasks && <TaskBreadcrumbs />}
				{!tasks && pathname !== "/" && <PageBreadcrumbs />}
			</ol>
		</nav>
	);
}
