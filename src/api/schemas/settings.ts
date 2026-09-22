import { z } from "zod";

export const SettingsUpdateSchema = z.object({
	projectsBasePath: z.string().min(1).optional(),
	// Vazio limpa o endereço; qualquer outro valor precisa ser uma URL absoluta, porque é ela que vira
	// o link do QR aberto no celular.
	mobileBaseUrl: z
		.string()
		.trim()
		.refine((value) => value === "" || URL.canParse(value), { message: "URL inválida" })
		.optional(),
});
