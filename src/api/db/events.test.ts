import { beforeAll, describe, expect, it } from "bun:test";

import { dbEvents } from "@/api/db/events";
import { normalizeEndAt } from "@/api/helpers/event-time";
import { db } from "./connection";

// Insere um event pessoal (task_id null) com start/end exatos — sem passar pela normalização do
// router, para controlar os limites e provar a query de overlap.
async function seedEvent(input: { id: string; startAt: string; endAt: string; allDay?: boolean }) {
	await dbEvents.create({
		id: input.id,
		start_at: input.startAt,
		end_at: input.endAt,
		all_day: input.allDay ? 1 : 0,
		task_id: null,
	});
}

async function rangeIds(startDate: string, endDate: string) {
	const rows = await dbEvents.listByRange({ startDate, endDate });
	return rows.map((r) => r.id);
}

describe("normalizeEndAt", () => {
	it("timed sem fim → +30min", () => {
		expect(normalizeEndAt({ startAt: "2025-06-29T14:00", endAt: null, allDay: false })).toBe(
			"2025-06-29T14:30",
		);
	});

	it("timed atravessa meia-noite", () => {
		expect(normalizeEndAt({ startAt: "2025-06-29T23:50", endAt: null, allDay: false })).toBe(
			"2025-06-30T00:20",
		);
	});

	it("timed com fim explícito é preservado", () => {
		expect(
			normalizeEndAt({ startAt: "2025-06-29T09:00", endAt: "2025-06-29T10:00", allDay: false }),
		).toBe("2025-06-29T10:00");
	});

	it("timed com fim == início → bump de 30min (nunca duração zero)", () => {
		expect(
			normalizeEndAt({ startAt: "2025-06-29T09:00", endAt: "2025-06-29T09:00", allDay: false }),
		).toBe("2025-06-29T09:30");
	});

	it("all-day single → dia seguinte exclusivo", () => {
		expect(normalizeEndAt({ startAt: "2025-06-29T00:00", endAt: null, allDay: true })).toBe(
			"2025-06-30T00:00",
		);
	});

	it("all-day multi-dia → último dia coberto + 1 (exclusivo)", () => {
		expect(
			normalizeEndAt({ startAt: "2025-06-29T00:00", endAt: "2025-06-30T00:00", allDay: true }),
		).toBe("2025-07-01T00:00");
	});
});

describe("dbEvents.listByRange", () => {
	beforeAll(async () => {
		await db.deleteFrom("events").execute();

		// All-day 29/06 (end exclusivo no dia seguinte).
		await seedEvent({
			id: "all-day",
			startAt: "2025-06-29T00:00",
			endAt: "2025-06-30T00:00",
			allDay: true,
		});
		// Multi-dia all-day 29/06–30/06 (end exclusivo 01/07).
		await seedEvent({
			id: "multi-day",
			startAt: "2025-06-29T00:00",
			endAt: "2025-07-01T00:00",
			allDay: true,
		});
		// Timed cruzando meia-noite: 29/06 23:00 → 30/06 01:00.
		await seedEvent({
			id: "cross-midnight",
			startAt: "2025-06-29T23:00",
			endAt: "2025-06-30T01:00",
		});
		// Borda lexicográfica: all-day no ÚLTIMO dia visível (31/05/2026), end '2026-06-01T00:00'.
		await seedEvent({
			id: "lex-edge",
			startAt: "2026-05-31T00:00",
			endAt: "2026-06-01T00:00",
			allDay: true,
		});
	});

	it("all-day aparece no próprio dia, não no dia seguinte (end exclusivo)", async () => {
		expect(await rangeIds("2025-06-29", "2025-06-29")).toContain("all-day");
		expect(await rangeIds("2025-06-30", "2025-06-30")).not.toContain("all-day");
	});

	it("multi-dia aparece em todos os dias cobertos, não no dia exclusivo", async () => {
		expect(await rangeIds("2025-06-29", "2025-06-29")).toContain("multi-day");
		expect(await rangeIds("2025-06-30", "2025-06-30")).toContain("multi-day");
		expect(await rangeIds("2025-07-01", "2025-07-01")).not.toContain("multi-day");
	});

	it("timed que cruza meia-noite aparece nos dois dias", async () => {
		expect(await rangeIds("2025-06-29", "2025-06-29")).toContain("cross-midnight");
		expect(await rangeIds("2025-06-30", "2025-06-30")).toContain("cross-midnight");
	});

	it("BORDA LEXICOGRÁFICA: all-day do último dia NÃO vaza para o dia seguinte", async () => {
		// Está no dia 31/05...
		expect(await rangeIds("2026-05-25", "2026-05-31")).toContain("lex-edge");
		// ...e NÃO é chip-fantasma na semana seguinte (bounds datetime completos, não date-only).
		expect(await rangeIds("2026-06-01", "2026-06-07")).not.toContain("lex-edge");
	});
});
