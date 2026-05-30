import { describe, expect, it } from "bun:test";

import { bucketEventsByDay, eventTouchesDay } from "./event-day";

describe("eventTouchesDay", () => {
	it("all-day 29/06 toca o próprio dia, não o dia seguinte (end exclusivo)", () => {
		const ev = { startAt: "2025-06-29T00:00", endAt: "2025-06-30T00:00" };
		expect(eventTouchesDay(ev, "2025-06-29")).toBe(true);
		expect(eventTouchesDay(ev, "2025-06-30")).toBe(false);
		expect(eventTouchesDay(ev, "2025-06-28")).toBe(false);
	});

	it("multi-dia 29/06–30/06 (end exclusivo 01/07) toca 29 e 30, não 01/07", () => {
		const ev = { startAt: "2025-06-29T00:00", endAt: "2025-07-01T00:00" };
		expect(eventTouchesDay(ev, "2025-06-29")).toBe(true);
		expect(eventTouchesDay(ev, "2025-06-30")).toBe(true);
		expect(eventTouchesDay(ev, "2025-07-01")).toBe(false);
	});

	it("timed que cruza meia-noite toca os dois dias", () => {
		const ev = { startAt: "2025-06-29T23:00", endAt: "2025-06-30T01:00" };
		expect(eventTouchesDay(ev, "2025-06-29")).toBe(true);
		expect(eventTouchesDay(ev, "2025-06-30")).toBe(true);
	});

	it("BORDA: all-day do último dia não vaza para o dia seguinte", () => {
		const ev = { startAt: "2026-05-31T00:00", endAt: "2026-06-01T00:00" };
		expect(eventTouchesDay(ev, "2026-05-31")).toBe(true);
		expect(eventTouchesDay(ev, "2026-06-01")).toBe(false);
	});
});

describe("bucketEventsByDay", () => {
	it("coloca um chip por célula coberta", () => {
		const events = [
			{ id: "a", startAt: "2025-06-29T00:00", endAt: "2025-07-01T00:00" },
			{ id: "b", startAt: "2025-06-30T10:00", endAt: "2025-06-30T11:00" },
		];
		const byDay = bucketEventsByDay(events, ["2025-06-29", "2025-06-30", "2025-07-01"]);

		expect(byDay.get("2025-06-29")?.map((e) => e.id)).toEqual(["a"]);
		expect(byDay.get("2025-06-30")?.map((e) => e.id)).toEqual(["a", "b"]);
		expect(byDay.get("2025-07-01")?.map((e) => e.id)).toEqual([]);
	});
});
