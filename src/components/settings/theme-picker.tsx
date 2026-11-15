import { Moon, Palette, Sun } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { supportsThemeMode, THEME_PALETTES, useThemeStore } from "@/stores/theme";

const MODES = [
	{ id: "light", label: "claro", icon: Sun },
	{ id: "dark", label: "escuro", icon: Moon },
] as const;

const SWATCH_STYLE = {
	background:
		"radial-gradient(circle at 32% 28%, var(--card) 0%, var(--background) 38%, color-mix(in oklab, var(--primary) 55%, var(--chrome)) 100%)",
};

export function ThemePicker() {
	const theme = useThemeStore((state) => state.theme);
	const palette = useThemeStore((state) => state.palette);
	const setTheme = useThemeStore((state) => state.setTheme);
	const setPalette = useThemeStore((state) => state.setPalette);

	return (
		<div className="flex flex-col gap-4 border border-border bg-card p-4 shadow-xs sm:p-5">
			<div className="flex min-w-0 items-start gap-3">
				<Icon icon={Palette} size="sm" className="mt-0.5 shrink-0" />
				<div className="min-w-0 space-y-1">
					<Title as="h3" size="sm" className="text-sm font-semibold">
						Tema
					</Title>
					<Text size="sm" tone="muted">
						Escolha a paleta e a aparência clara ou escura.
					</Text>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-3">
				{THEME_PALETTES.map((option) => {
					const activePalette = option.id === palette;

					return (
						<div
							key={option.id}
							className={cn(
								"flex flex-col gap-3 border p-3",
								activePalette ? "border-primary/60 bg-primary/5" : "border-border",
							)}
						>
							<div className="flex items-center justify-center gap-3 py-1">
								{MODES.map((mode) => {
									if (!supportsThemeMode(option.id, mode.id)) {
										return null;
									}

									const selected = activePalette && mode.id === theme;
									const ModeIcon = mode.icon;

									return (
										<button
											key={mode.id}
											type="button"
											onClick={() => {
												setPalette(option.id);
												setTheme(mode.id);
											}}
											aria-label={`${option.label} ${mode.label}`}
											aria-pressed={selected}
											className={cn(
												"relative size-12 cursor-pointer p-0.5 ring-offset-2 ring-offset-card transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
												selected && "ring-2 ring-primary",
											)}
										>
											<span
												className={cn(option.id, mode.id, "block size-full border border-border")}
												style={SWATCH_STYLE}
											/>
											{selected && (
												<span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center border border-border bg-card text-foreground">
													<ModeIcon className="size-3" />
												</span>
											)}
										</button>
									);
								})}
							</div>
							<Text as="span" size="sm" className="font-medium">
								{option.label}
							</Text>
						</div>
					);
				})}
			</div>
		</div>
	);
}
