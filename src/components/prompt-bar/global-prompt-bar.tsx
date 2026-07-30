import { ChevronUp, MessageSquarePlus } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { PromptComposer } from "@/components/prompt-bar/prompt-composer";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";
import { useReadingModeStore } from "@/stores/reading-mode";

export function GlobalPromptBar() {
	const hasText = usePromptBarStore((s) => s.text.trim().length > 0);
	const collapsedText = usePromptBarStore((s) => (s.expanded ? null : s.text.trim()));
	const expanded = usePromptBarStore((s) => s.expanded);
	const setExpanded = usePromptBarStore((s) => s.setExpanded);
	const toggleExpanded = usePromptBarStore((s) => s.toggleExpanded);

	const reading = useReadingModeStore((s) => s.reading);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const lastPathname = useRef(pathname);

	const rootRef = useRef<HTMLDivElement>(null);

	// O footer se mede e publica --prompt-bar-h no :root: na leitura ele é fixo e o conteúdo precisa
	// desse respiro inferior pra não ficar escondido atrás do drawer. ResizeObserver acompanha o
	// textarea crescendo. Só observa em modo leitura (único consumidor da variável): fora dele, cada
	// frame da animação de abrir/fechar escreveria no :root e forçaria recálculo de estilo da página
	// inteira — era isso que deixava o abrir/fechar do prompt lento nas rotas pesadas.
	useEffect(() => {
		if (!reading) return;
		const node = rootRef.current;
		if (!node) return;
		const observer = new ResizeObserver(([entry]) => {
			document.documentElement.style.setProperty("--prompt-bar-h", `${entry.contentRect.height}px`);
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			document.documentElement.style.removeProperty("--prompt-bar-h");
		};
	}, [reading]);

	// `overflow-hidden` faz a animação de grid-rows clipar a altura; mas o menu de skill abre pra
	// cima e seria cortado. Então só liberamos `overflow-visible` quando a animação de abrir termina.
	const [revealed, setRevealed] = useState(expanded);

	useEffect(() => {
		if (!expanded) setRevealed(false);
	}, [expanded]);

	// Trocar de rota recolhe o prompt; o ref pula o mount pra preservar o `expanded` persistido no reload.
	useEffect(() => {
		if (lastPathname.current !== pathname) {
			lastPathname.current = pathname;
			setExpanded(false);
		}
	}, [pathname, setExpanded]);

	return (
		<div
			ref={rootRef}
			className={cn(
				"border-t border-border bg-chrome",
				// Na leitura a rota vira um overlay `fixed inset-0 z-50`; o footer precisa sair do fluxo
				// e encostar no fim da janela (sobre o lugar da StatusBar), com z acima do overlay.
				reading && "fixed inset-x-0 bottom-0 z-[60] pb-[env(safe-area-inset-bottom)]",
			)}
		>
			<div
				className={cn(
					"relative transition-opacity",
					// Na leitura o footer fica sutil sobre o overlay, igual às tabs do topo.
					reading && "opacity-40 hover:opacity-100 focus-within:opacity-100",
				)}
			>
				{/* Header sempre presente: o chevron fica fixo à direita e só rotaciona ao abrir/fechar. */}
				<button
					type="button"
					onClick={toggleExpanded}
					className={cn(
						"flex h-9 w-full cursor-pointer items-center gap-2 px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
						expanded && "bg-muted/40 text-foreground",
					)}
				>
					<MessageSquarePlus className="h-4 w-4 shrink-0" />
					<span className="shrink-0">Prompt</span>
					<span className="min-w-0 flex-1">
						{!expanded &&
							(hasText ? (
								<span className="flex min-w-0 items-center gap-2">
									<span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
									<span className="min-w-0 flex-1 truncate text-muted-foreground/80">
										{collapsedText}
									</span>
								</span>
							) : (
								<span className="block truncate text-muted-foreground/50">
									Escreva uma instrução para o agente
								</span>
							))}
					</span>
					<ChevronUp
						className={cn(
							"h-4 w-4 shrink-0 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
							expanded && "rotate-180",
						)}
					/>
				</button>

				<div
					className={cn(
						"grid transition-[grid-template-rows,visibility] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
						expanded ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
					)}
					onTransitionEnd={(event) => {
						if (event.propertyName === "grid-template-rows" && expanded) setRevealed(true);
					}}
				>
					<div
						className={cn(
							"flex min-h-0 flex-col justify-end",
							revealed ? "overflow-visible" : "overflow-hidden",
						)}
					>
						<div className={cn(!reading && "border-t border-border bg-chrome pt-3")}>
							<div className="mx-auto w-full max-w-3xl px-4 pb-3 xl:max-w-4xl">
								<PromptComposer />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
