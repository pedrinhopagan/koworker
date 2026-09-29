import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { orpc } from "@/client";

const searchSchema = z.object({
	path: z.string().min(1),
	line: z.coerce.number().int().positive().optional(),
});

export const Route = createFileRoute("/_app/arquivo/")({
	validateSearch: searchSchema,
	beforeLoad: async ({ search, preload }) => {
		if (preload) {
			return;
		}

		const target = await orpc.system.resolveLink.call({ target: search.path }).catch(() => null);

		if (target?.kind !== "internal" && target?.kind !== "file") {
			return;
		}

		if (target.kind === "internal" && target.fileHref) {
			throw redirect({ href: target.fileHref, replace: true });
		}

		return { routeProjectId: target.projectId ?? undefined };
	},
});
