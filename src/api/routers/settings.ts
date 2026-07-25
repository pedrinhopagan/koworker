import { protectedProcedure } from "../auth/context";
import { assertAdminUser } from "../helpers/redeploy";
import { getSystemSettings, setSystemSettings } from "../helpers/system-settings";
import { SettingsUpdateSchema } from "../schemas/settings";

export const settingsRouter = {
	get: protectedProcedure.handler(() => getSystemSettings()),

	set: protectedProcedure.input(SettingsUpdateSchema).handler(async ({ context, input }) => {
		assertAdminUser(context.user.user_type);
		await setSystemSettings(input);
		return { success: true };
	}),
};
