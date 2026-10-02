import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme";

type ThemeToggleProps = {
	className?: string;
	iconClassName?: string;
};

export function ThemeToggle({ className, iconClassName }: ThemeToggleProps) {
	const theme = useThemeStore((state) => state.theme);
	const toggleTheme = useThemeStore((state) => state.toggleTheme);

	return (
		<Tooltip label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}>
			<Button
				variant="ghost-muted"
				size="icon-sm"
				type="button"
				onClick={toggleTheme}
				aria-label="Trocar tema"
				className={className}
			>
				{theme === "dark" && <Sun className={cn("h-4 w-4 text-foreground", iconClassName)} />}
				{theme === "light" && <Moon className={cn("h-4 w-4 text-foreground", iconClassName)} />}
			</Button>
		</Tooltip>
	);
}
