import {
	type EventDbCreateInput,
	EventDbCreateSchema,
	type EventDbUpdateInput,
	EventDbUpdateSchema,
} from "../schemas/events";
import { djs } from "../helpers/dayjs";
import { db, type events } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbEvents = {
	getById: (id: string) =>
		db.selectFrom("events").selectAll().where("id", "=", id).executeTakeFirst(),

	// Overlap half-open [start, end) contra bounds datetime COMPLETOS. A equivalência
	// lexicográfica↔cronológica só vale se ambos os lados forem 'YYYY-MM-DDTHH:mm' de largura
	// fixa — comparar contra date-only ('YYYY-MM-DD') vazaria um all-day do último dia como
	// chip-fantasma no dia seguinte ('...T00:00' > '...' é true). Por isso o +'T00:00' e o
	// rangeEnd = (último dia visível + 1 dia), exclusivo.
	listByRange: (input: { startDate: string; endDate: string }) => {
		const rangeStart = `${input.startDate}T00:00`;
		const rangeEndExclusive = `${djs(input.endDate).add(1, "day").format("YYYY-MM-DD")}T00:00`;

		return (
			db
				.selectFrom("events")
				.leftJoin("tasks", "tasks.id", "events.task_id")
				.select([
					"events.id",
					"events.title",
					"events.start_at",
					"events.end_at",
					"events.all_day",
					"events.task_id",
					"events.color",
					"events.icon",
					"events.notes",
					"events.created_at",
					"events.updated_at",
					"tasks.title as task_title",
					"tasks.project_id as task_project_id",
					"tasks.category_id as task_category_id",
					"tasks.folder_path as task_folder_path",
					"tasks.done as task_done",
				])
				.where("events.start_at", "<", rangeEndExclusive)
				.where("events.end_at", ">", rangeStart)
				// Eventos de task soft-deletada não aparecem: o leftJoin traz a task e filtramos
				// deleted_at na leitura (defesa em profundidade, além da limpeza no softDelete).
				.where((eb) => eb("events.task_id", "is", null).or("tasks.deleted_at", "is", null))
				.orderBy("events.start_at", "asc")
				.execute()
		);
	},

	create: (input: EventDbCreateInput) => {
		const parsed = EventDbCreateSchema.parse(input);
		// created_at sempre em epoch-ms aqui — nunca o default "now" do arktype (que grava segundos).
		return db
			.insertInto("events")
			.values({ ...parsed, created_at: Date.now() } as events)
			.onConflict((oc) => oc.column("id").doNothing())
			.executeTakeFirst();
	},

	update: (input: { id: string } & EventDbUpdateInput) => {
		const { id, ...values } = input;
		const parsedValues = EventDbUpdateSchema.parse(values);
		const cleanValues = cleanUpdate(parsedValues);

		return db
			.updateTable("events")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},

	// Hard delete: soft delete é convenção restrita a projects/tasks. Event é descartável.
	remove: (id: string) => db.deleteFrom("events").where("id", "=", id).executeTakeFirst(),
};
