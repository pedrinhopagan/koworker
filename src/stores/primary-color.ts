import { create } from "zustand";
import { persist } from "zustand/middleware";

type PrimaryColorPreset = {
	name: string;
	light: string;
	dark: string;
};

export const primaryColorPresets: PrimaryColorPreset[] = [
	{ name: "Olive", light: "oklch(0.56 0.049 132)", dark: "oklch(0.67 0.081 119)" },
	{ name: "Emerald", light: "oklch(0.59 0.15 163)", dark: "oklch(0.70 0.15 163)" },
	{ name: "Sky", light: "oklch(0.55 0.15 230)", dark: "oklch(0.68 0.15 230)" },
	{ name: "Violet", light: "oklch(0.55 0.15 280)", dark: "oklch(0.68 0.15 280)" },
	{ name: "Rose", light: "oklch(0.55 0.15 10)", dark: "oklch(0.68 0.15 10)" },
	{ name: "Orange", light: "oklch(0.60 0.15 50)", dark: "oklch(0.72 0.15 50)" },
	{ name: "Amber", light: "oklch(0.60 0.12 80)", dark: "oklch(0.72 0.12 80)" },
	{ name: "Teal", light: "oklch(0.55 0.12 185)", dark: "oklch(0.68 0.12 185)" },
];

interface PrimaryColorState {
	presetName: string;
	setPresetName: (name: string) => void;
	getColors: () => PrimaryColorPreset | undefined;
}

export const usePrimaryColorStore = create<PrimaryColorState>()(
	persist(
		(set, get) => ({
			presetName: "Olive",
			setPresetName: (name) => set({ presetName: name }),
			getColors: () => primaryColorPresets.find((p) => p.name === get().presetName),
		}),
		{ name: "primary-color-storage" }
	)
);
