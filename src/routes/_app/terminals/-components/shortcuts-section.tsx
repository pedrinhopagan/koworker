import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import { KW_TERMINAL_PREFIX, KW_TERMINAL_SHORTCUTS } from "@/constants/terminal";

export function ShortcutsSection() {
	const [open, setOpen] = useState(false);

	return (
		<section className="space-y-2 border-t border-border pt-4">
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				className="flex w-full cursor-pointer items-center gap-1 text-xs text-muted-foreground uppercase tracking-wide transition-colors hover:text-foreground"
			>
				{open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
				Atalhos do kw-terminal
			</button>

			{open && (
				<>
					<Text size="xs" tone="muted">
						prefix = <span className="font-mono">{KW_TERMINAL_PREFIX}</span> (modo prefixo estilo
						tmux)
					</Text>

					<ul className="flex flex-col divide-y divide-border border border-border">
						{KW_TERMINAL_SHORTCUTS.map((shortcut) => (
							<li key={shortcut.keys} className="flex items-center gap-4 px-3 py-2">
								<span className="shrink-0 font-mono text-xs text-primary">{shortcut.keys}</span>
								<span className="min-w-0 flex-1 text-right text-sm text-foreground">
									{shortcut.label}
								</span>
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
}
