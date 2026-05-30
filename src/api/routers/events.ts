import { protectedProcedure } from "../auth/context";
import { dbCategories } from "../db/categories";
import { dbEvents } from "../db/events";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { normalizeEndAt } from "../helpers/event-time";
import { readFirstMarkdownContent, resolveDisplayTitle } from "../helpers/task-folder";
import { PubSub } from "../pubsub";
import {
	EventCreateSchema,
	EventIdSchema,
	EventListByRangeSchema,
	EventUpdateSchema,
} from "../schemas";

type EventRow = Awaited<ReturnType<typeof dbEvents.listByRange>>[number];

function shapeEvent(
	row: EventRow,
	resolved: { displayTitle: string; displayColor?: string; projectId?: string; done?: boolean },
) {
	return {
		id: row.id,
		title: row.title ?? undefined,
		displayTitle: resolved.displayTitle,
		startAt: row.start_at,
		endAt: row.end_at,
		allDay: Boolean(row.all_day),
		taskId: row.task_id ?? undefined,
		projectId: resolved.projectId,
		// color = cor explícita do evento (raw, p/ edição); displayColor = resolvida (herda a
		// categoria da task linkada como fallback, p/ render do chip).
		color: row.color ?? undefined,
		displayColor: resolved.displayColor,
		icon: row.icon ?? undefined,
		notes: row.notes ?? undefined,
		done: resolved.done,
		createdAt: row.created_at,
		updatedAt: row.updated_at ?? undefined,
	};
}

// Resolve displayTitle e displayColor de UMA row. Title explícito vence; senão, evento ligado a
// task herda o displayTitle da task (lendo o 1º .md quando a task não tem título) e a cor da
// categoria como fallback. Mesmo padrão do mapTaskWithDisplay, sem cópia stale-on-rename.
async function resolveEvent(row: EventRow) {
	const rawTitle = row.title?.trim();
	let displayTitle = rawTitle;

	if (!displayTitle && row.task_id) {
		const taskTitle = row.task_title?.trim();
		if (taskTitle) {
			displayTitle = taskTitle;
		} else {
			const project = row.task_project_id ? await dbProjects.getById(row.task_project_id) : null;
			const firstContent =
				project && row.task_folder_path
					? await readFirstMarkdownContent({
							projectRoute: project.main_route,
							folderPath: row.task_folder_path,
						})
					: undefined;
			displayTitle = resolveDisplayTitle({ firstContent });
		}
	}

	let displayColor = row.color ?? undefined;
	if (!displayColor && row.task_category_id) {
		const category = await dbCategories.getById(row.task_category_id);
		displayColor = category?.color ?? undefined;
	}

	return shapeEvent(row, {
		displayTitle: displayTitle ?? "Evento",
		displayColor,
		projectId: row.task_project_id ?? undefined,
		done: row.task_id ? Boolean(row.task_done) : undefined,
	});
}

// Eventos numa janela visível são poucos; resolver concorrentemente (Promise.all) basta — sem o
// batching pesado de mapTasks, que existe para listas de centenas de tarefas.
function mapEvents(rows: EventRow[]) {
	return Promise.all(rows.map(resolveEvent));
}

// Carrega um event já com as colunas da task linkada (o getById não junta), para reaproveitar
// resolveEvent no retorno das mutations.
async function getMappedEvent(id: string) {
	const ev = await dbEvents.getById(id);
	if (!ev) return null;

	let taskCols = {
		task_title: null as string | null,
		task_project_id: null as string | null,
		task_category_id: null as string | null,
		task_folder_path: null as string | null,
		task_done: null as number | null,
	};

	if (ev.task_id) {
		const task = await dbTasks.getById(ev.task_id);
		if (task) {
			taskCols = {
				task_title: task.title ?? null,
				task_project_id: task.project_id,
				task_category_id: task.category_id,
				task_folder_path: task.folder_path,
				task_done: task.done,
			};
		}
	}

	return resolveEvent({ ...ev, ...taskCols });
}

async function publishEventEvent(
	eventId: string,
	projectId: string | null,
	action: "created" | "updated" | "deleted",
) {
	if (projectId) {
		await PubSub.publish("events", projectId, { eventId, projectId, action, source: "api" });
	}
	await PubSub.publish("events", "global", {
		eventId,
		projectId: projectId ?? undefined,
		action,
		source: "api",
	});
}

export const eventsRouter = {
	listByRange: protectedProcedure.input(EventListByRangeSchema).handler(async ({ input }) => {
		const rows = await dbEvents.listByRange({ startDate: input.startDate, endDate: input.endDate });
		return mapEvents(rows);
	}),

	create: protectedProcedure.input(EventCreateSchema).handler(async ({ input }) => {
		const id = crypto.randomUUID();
		const endAt = normalizeEndAt({
			startAt: input.startAt,
			endAt: input.endAt ?? null,
			allDay: input.allDay,
		});

		await dbEvents.create({
			id,
			title: input.title ?? null,
			start_at: input.startAt,
			end_at: endAt,
			all_day: input.allDay ? 1 : 0,
			task_id: input.taskId ?? null,
			color: input.color ?? null,
			icon: input.icon ?? null,
			notes: input.notes ?? null,
		});

		const mapped = await getMappedEvent(id);
		await publishEventEvent(id, mapped?.projectId ?? null, "created");
		return mapped;
	}),

	update: protectedProcedure.input(EventUpdateSchema).handler(async ({ input }) => {
		const existing = await dbEvents.getById(input.id);
		if (!existing) throw new Error("Evento não encontrado");

		const timingTouched =
			input.startAt !== undefined || input.endAt !== undefined || input.allDay !== undefined;

		let startCol: string | undefined;
		let endCol: string | undefined;
		let allDayCol: number | undefined;

		if (timingTouched) {
			const allDay = input.allDay ?? Boolean(existing.all_day);
			let startAt = input.startAt ?? existing.start_at;
			// all-day obriga horas zeradas: snap mesmo num toggle parcial (sem novo start).
			if (allDay) startAt = `${startAt.slice(0, 10)}T00:00`;
			startCol = startAt;
			allDayCol = allDay ? 1 : 0;
			endCol = normalizeEndAt({ startAt, endAt: input.endAt ?? null, allDay });
		}

		await dbEvents.update({
			id: input.id,
			title: input.title === undefined ? undefined : input.title,
			start_at: startCol,
			end_at: endCol,
			all_day: allDayCol,
			task_id: input.taskId,
			color: input.color,
			icon: input.icon,
			notes: input.notes,
		});

		const mapped = await getMappedEvent(input.id);
		await publishEventEvent(input.id, mapped?.projectId ?? null, "updated");
		return mapped;
	}),

	remove: protectedProcedure.input(EventIdSchema).handler(async ({ input }) => {
		// Captura o projectId (via task linkada) antes de deletar, para publicar no canal certo.
		const mapped = await getMappedEvent(input.id);
		await dbEvents.remove(input.id);
		await publishEventEvent(input.id, mapped?.projectId ?? null, "deleted");
		return { id: input.id };
	}),
};
