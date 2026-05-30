import { ChevronLeft, ChevronRight } from "lucide-react";

import { Title } from "@/components/typography";
import { Button } from "@/components/ui/button";

type AgendaNavProps = {
	label: string;
	onPrev: () => void;
	onNext: () => void;
	onToday: () => void;
};

export function AgendaNav({ label, onPrev, onNext, onToday }: AgendaNavProps) {
	return (
		<div className="mb-2 flex items-center gap-2">
			<Title as="span" size="sm" className="min-w-0 flex-1 truncate capitalize">
				{label}
			</Title>
			<Button variant="ghost" size="sm" onClick={onToday}>
				Hoje
			</Button>
			<Button variant="ghost" size="icon" onClick={onPrev} aria-label="Período anterior">
				<ChevronLeft className="size-4" />
			</Button>
			<Button variant="ghost" size="icon" onClick={onNext} aria-label="Próximo período">
				<ChevronRight className="size-4" />
			</Button>
		</div>
	);
}
