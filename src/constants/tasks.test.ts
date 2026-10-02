import { describe, expect, test } from "bun:test";

import { pickTaskGroupColor, TASK_GROUP_COLORS } from "./tasks";

describe("pickTaskGroupColor", () => {
	test("escolhe cores distintas antes de repetir", () => {
		expect(pickTaskGroupColor([])).toBe(TASK_GROUP_COLORS[0]);
		expect(pickTaskGroupColor([TASK_GROUP_COLORS[0]])).toBe(TASK_GROUP_COLORS[1]);
	});

	test("equilibra a paleta quando todas as cores já foram usadas", () => {
		expect(pickTaskGroupColor([...TASK_GROUP_COLORS, TASK_GROUP_COLORS[0]])).toBe(
			TASK_GROUP_COLORS[1],
		);
	});

	test("ignora cores externas à paleta", () => {
		expect(pickTaskGroupColor(["#000000", "#ffffff"])).toBe(TASK_GROUP_COLORS[0]);
	});
});
