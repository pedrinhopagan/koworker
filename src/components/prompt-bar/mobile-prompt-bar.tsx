import { useRouterState } from "@tanstack/react-router";
import { MessageSquarePlus, X } from "lucide-react";
import { useEffect } from "react";

import { PromptComposer } from "@/components/prompt-bar/prompt-composer";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePromptBarStore } from "@/stores/prompt-bar";

export function MobilePromptBar() {
	const expanded = usePromptBarStore((s) => s.expanded);
	const setExpanded = usePromptBarStore((s) => s.setExpanded);
	const hasText = usePromptBarStore((s) => s.text.trim().length > 0);
	const collapsedText = usePromptBarStore((s) => (s.expanded ? null : s.text.trim()));
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	useEffect(() => {
		setExpanded(false);
	}, [pathname, setExpanded]);

	return (
		<>
			<button
				type="button"
				onClick={() => setExpanded(true)}
				className="flex min-h-12 min-w-0 flex-1 items-center gap-3 border border-border/80 bg-card px-3 text-left text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<MessageSquarePlus className="size-4 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1">
					<Text as="span" className="block font-bold">
						Prompt
					</Text>
					<Text as="span" className="block truncate text-[11px] text-muted-foreground">
						{collapsedText || "Escreva uma instrução"}
					</Text>
				</span>
				{hasText && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
			</button>

			<Sheet
				open={expanded}
				onOpenChange={(next) => {
					if (!next) setExpanded(false);
				}}
			>
				<SheetContent
					side="bottom"
					showClose={false}
					className="h-[92dvh] max-h-[92dvh] pb-[env(safe-area-inset-bottom)]"
				>
					<div className="flex shrink-0 justify-center pt-2 pb-1">
						<div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
					</div>

					<SheetHeader className="flex-row items-center justify-between gap-3 border-b border-border px-4 pb-2">
						<SheetTitle asChild>
							<Title as="h2" size="sm">
								Prompt
							</Title>
						</SheetTitle>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setExpanded(false)}
							aria-label="Fechar prompt"
							className="size-12 shrink-0"
						>
							<X className="size-5" />
						</Button>
					</SheetHeader>

					<div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
						<PromptComposer />
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}
