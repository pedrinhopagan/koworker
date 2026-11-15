import { ArrowDown } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { LinkCwdProvider } from "@/components/link-cwd";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

export function ConversationViewport({
	identity,
	cwd,
	children,
}: {
	identity: string;
	cwd?: string;
	children: ReactNode;
}) {
	const viewport = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const following = useRef(true);
	const [showBottom, setShowBottom] = useState(false);
	useEffect(() => {
		following.current = true;
		setShowBottom(false);
		const follow = () => {
			if (following.current && viewport.current) {
				viewport.current.scrollTop = viewport.current.scrollHeight;
			}
		};
		follow();
		const observer = new ResizeObserver(follow);
		if (content.current) {
			observer.observe(content.current);
		}
		if (viewport.current) {
			observer.observe(viewport.current);
		}
		window.visualViewport?.addEventListener("resize", follow);
		return () => {
			observer.disconnect();
			window.visualViewport?.removeEventListener("resize", follow);
		};
	}, [identity]);
	return (
		<LinkCwdProvider cwd={cwd}>
			<div className="relative min-h-0 min-w-0 flex-1">
				<div
					ref={viewport}
					data-component="conversation-viewport"
					className="h-full overflow-x-hidden overflow-y-auto overscroll-contain"
					onScroll={(event) => {
						const node = event.currentTarget;
						const atEnd = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
						if (atEnd !== following.current) {
							following.current = atEnd;
							setShowBottom(!atEnd);
						}
					}}
				>
					<div
						ref={content}
						className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6"
					>
						{children}
					</div>
				</div>
				{showBottom && (
					<Tooltip label="Ir para o fim">
						<Button
							size="icon"
							variant="outline"
							aria-label="Ir para o fim"
							className="absolute right-4 bottom-4 size-11 bg-background shadow-sm"
							onClick={() => {
								following.current = true;
								setShowBottom(false);
								if (viewport.current) {
									viewport.current.scrollTop = viewport.current.scrollHeight;
								}
							}}
						>
							<ArrowDown className="size-4" />
						</Button>
					</Tooltip>
				)}
			</div>
		</LinkCwdProvider>
	);
}
