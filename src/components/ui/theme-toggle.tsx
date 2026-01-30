import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/stores/theme";

import { cn } from "@/lib/utils";

type ThemeToggleProps = {
	className?: string;
	iconClassName?: string;
};

export function ThemeToggle({ className, iconClassName }: ThemeToggleProps) {
	const { theme, toggleTheme } = useThemeStore();

	return (
		<button
			type="button"
			onClick={toggleTheme}
			aria-label="Trocar tema"
			className={cn("inline-flex items-center justify-center", className)}
		>
			{theme === "dark" && <Sun className={cn("h-4 w-4 text-foreground", iconClassName)} />}
			{theme === "light" && <Moon className={cn("h-4 w-4 text-foreground", iconClassName)} />}
		</button>
	);
}
