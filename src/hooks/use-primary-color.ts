import { useEffect } from "react";
import { primaryColorPresets, usePrimaryColorStore } from "@/stores/primary-color";
import { useThemeStore } from "@/stores/theme";

export function usePrimaryColor() {
	const presetName = usePrimaryColorStore((s) => s.presetName);
	const theme = useThemeStore((s) => s.theme);

	useEffect(() => {
		const colors = primaryColorPresets.find((p) => p.name === presetName);
		if (!colors) return;

		const color = theme === "dark" ? colors.dark : colors.light;
		document.documentElement.style.setProperty("--primary", color);
		document.documentElement.style.setProperty("--ring", color);
		document.documentElement.style.setProperty("--success", color);
	}, [theme, presetName]);
}
