import { z } from "zod";
import { idsProvedor } from "@/desktop/providers/types";
import { idsPresetTerminal } from "@/desktop/terminal/types";

export const configDesktopSchema = z.object({
	provedorId: z.enum(idsProvedor),
	terminal: z.object({
		presetId: z.enum(idsPresetTerminal),
		comandoPersonalizado: z
			.object({
				bin: z.string().min(1),
				args: z.array(z.string()),
			})
			.optional(),
		tmux: z.object({
			sessao: z.string().min(1),
			autoCriar: z.boolean(),
		}),
	}),
});

export type ConfigDesktop = z.infer<typeof configDesktopSchema>;

export function criarConfigDesktopPadrao(): ConfigDesktop {
	return {
		provedorId: "mock",
		terminal: {
			presetId: "auto",
			tmux: {
				sessao: "kowork",
				autoCriar: true,
			},
		},
	};
}
