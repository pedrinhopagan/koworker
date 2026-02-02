import { z } from "zod";
import { idsProvedor } from "@/desktop/providers/types";

export const configDesktopSchema = z.object({
	provedorId: z.enum(idsProvedor),
});

export type ConfigDesktop = z.infer<typeof configDesktopSchema>;

export function criarConfigDesktopPadrao(): ConfigDesktop {
	return {
		provedorId: "mock",
	};
}
