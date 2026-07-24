import { describe, expect, test } from "bun:test";

import {
	canonicalTaskRoute,
	NO_FEATURE_ROUTE_ID,
	taskMatchesFeature,
} from "./task-route-resolution";

describe("task-route-resolution", () => {
	test("gera segmento canônico para feature e sem feature", () => {
		expect(canonicalTaskRoute({ id: "task-1", groupId: "feature-1" })).toEqual({
			featureId: "feature-1",
			taskId: "task-1",
		});
		expect(canonicalTaskRoute({ id: "task-2" })).toEqual({
			featureId: NO_FEATURE_ROUTE_ID,
			taskId: "task-2",
		});
	});

	test("valida feature e projeto como autoridade", () => {
		const task = { projectId: "project-1", groupId: "feature-1" };
		expect(taskMatchesFeature(task, { featureId: "feature-1", projectId: "project-1" })).toBeTrue();
		expect(
			taskMatchesFeature(task, { featureId: "feature-2", projectId: "project-1" }),
		).toBeFalse();
		expect(
			taskMatchesFeature(task, { featureId: "feature-1", projectId: "project-2" }),
		).toBeFalse();
	});
});
