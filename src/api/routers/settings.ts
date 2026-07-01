import { protectedProcedure } from "../auth/context";
import { getSystemSettings, setSystemSettings } from "../helpers/system-settings";
import { SettingsUpdateSchema } from "../schemas/settings";

export const settingsRouter = {
	get: protectedProcedure.handler(() => getSystemSettings()),

	set: protectedProcedure.input(SettingsUpdateSchema).handler(async ({ input }) => {
		await setSystemSettings(input);
		return { success: true };
	}),
};
