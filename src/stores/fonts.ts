import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_READING_FONT, DEFAULT_UI_FONT, type FontId } from "@/lib/constants/fonts";

interface FontState {
	uiFont: FontId;
	readingFont: FontId;
	setUiFont: (font: FontId) => void;
	setReadingFont: (font: FontId) => void;
}

export const useFontStore = create<FontState>()(
	persist(
		(set) => ({
			uiFont: DEFAULT_UI_FONT,
			readingFont: DEFAULT_READING_FONT,
			setUiFont: (uiFont) => set({ uiFont }),
			setReadingFont: (readingFont) => set({ readingFont }),
		}),
		{ name: "font-storage" },
	),
);
