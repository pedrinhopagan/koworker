import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

export const THEME_PALETTES = [
	{ id: "torra", label: "Torra (T3 Code)" },
	{ id: "koworker", label: "Koworker" },
	{ id: "ember", label: "Ember" },
	{ id: "gruvbox-medium", label: "Gruvbox Medium" },
	{ id: "nier-automata", label: "NieR: Automata" },
	{ id: "pedro-warm-earth", label: "Warm Earth" },
] as const;

export type ThemePalette = (typeof THEME_PALETTES)[number]["id"];

export function supportsThemeMode(palette: ThemePalette, theme: Theme) {
	return palette !== "pedro-warm-earth" || theme === "dark";
}

interface ThemeState {
	theme: Theme;
	palette: ThemePalette;
	setTheme: (theme: Theme) => void;
	setPalette: (palette: ThemePalette) => void;
	toggleTheme: () => void;
}

const DEFAULT_THEME = {
	theme: "dark",
	palette: "torra",
} satisfies Pick<ThemeState, "theme" | "palette">;

export const useThemeStore = create<ThemeState>()(
	persist(
		(set) => ({
			...DEFAULT_THEME,
			setTheme: (theme) =>
				set((state) => {
					if (!supportsThemeMode(state.palette, theme)) {
						return state;
					}

					return { theme };
				}),
			setPalette: (palette) =>
				set((state) => ({
					palette,
					theme: supportsThemeMode(palette, state.theme) ? state.theme : "dark",
				})),
			toggleTheme: () =>
				set((state) => {
					if (!supportsThemeMode(state.palette, "light")) {
						return state;
					}

					return { theme: state.theme === "dark" ? "light" : "dark" };
				}),
		}),
		{
			name: "theme-storage",
			version: 4,
			partialize: ({ theme, palette }) => ({ theme, palette }),
			migrate: () => DEFAULT_THEME,
		},
	),
);
