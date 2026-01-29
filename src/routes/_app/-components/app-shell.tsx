import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { tv } from "tailwind-variants";

import { Text, Title } from "@/components/typography";

const navItem = tv({
	base: "rounded-md px-3 py-2 text-sm font-medium transition",
	variants: {
		active: {
			true: "bg-primary text-primary-foreground",
			false: "text-muted-foreground hover:text-foreground hover:bg-muted",
		},
	},
});

const appLinks: Array<{ to: "/" | "/projetos" | "/tarefas" | "/agenda"; label: string }> = [
	{ to: "/", label: "Home" },
	{ to: "/projetos", label: "Projetos" },
	{ to: "/tarefas", label: "Tarefas" },
	{ to: "/agenda", label: "Agenda" },
];

type AppShellProps = {
	children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
	const navigate = useNavigate();

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (!event.altKey || event.key.toLowerCase() !== "o") {
				return;
			}

			event.preventDefault();
			navigate({ to: "/projetos" });
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [navigate]);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b border-border">
				<div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
					<div className="flex items-center gap-6">
						<div className="flex items-center gap-3">
							<div className="size-8 rounded-md bg-primary/15" />
							<div>
								<Title size="sm" as="div">
									Kowork
								</Title>
								<Text size="sm" tone="muted">
									Espaço
								</Text>
							</div>
						</div>

						<nav className="flex items-center gap-2">
							{appLinks.map((item) => (
								<Link
									key={item.to}
									to={item.to}
									activeProps={{ className: navItem({ active: true }) }}
									inactiveProps={{ className: navItem({ active: false }) }}
								>
									{item.label}
								</Link>
							))}
						</nav>
					</div>

					<div className="flex items-center gap-2">
						<Text as="span" size="xs" tone="muted" className="rounded-md bg-muted px-2 py-1">
							DEV
						</Text>
					</div>
				</div>
			</header>

			<main>{children}</main>
		</div>
	);
}
