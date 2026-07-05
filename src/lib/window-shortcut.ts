import { getAppEnv } from "@/lib/env";

export function getWindowToggleShortcutTooltip(): string {
	if (getAppEnv() === "production") {
		return "Alt+K para mostrar";
	}
	return "Alt+L ou Alt+O para mostrar";
}
