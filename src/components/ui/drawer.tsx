import { X } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet";

type DrawerProps = {
	open: boolean;
	onClose: () => void;
	title: string;
	description?: string;
	children: React.ReactNode;
	side?: "left" | "right" | "bottom";
	widthClassName?: string;
};

export function Drawer({
	open,
	onClose,
	title,
	description,
	children,
	side = "right",
	widthClassName,
}: DrawerProps) {
	const isBottom = side === "bottom";
	const isLeft = side === "left";
	const resolvedWidthClassName =
		widthClassName ??
		(isBottom ? undefined : isLeft ? "w-[85vw] max-w-[320px]" : "w-full max-w-[420px]");

	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<SheetContent
				side={side}
				showClose={false}
				className={cn(!isBottom && resolvedWidthClassName)}
			>
				{isBottom && (
					<div className="flex shrink-0 justify-center pt-2 pb-1">
						<div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
					</div>
				)}

				<SheetHeader className="flex-row items-start justify-between gap-4 border-b border-border px-5 py-4">
					<div className="min-w-0">
						<SheetTitle asChild>
							<Title as="h2" size="sm">
								{title}
							</Title>
						</SheetTitle>
						{description && (
							<SheetDescription asChild>
								<Text size="xs" tone="muted" className="mt-0.5 truncate">
									{description}
								</Text>
							</SheetDescription>
						)}
					</div>
					<Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
						<X className="size-4" />
					</Button>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto p-5">{children}</div>
			</SheetContent>
		</Sheet>
	);
}
