import { ClipboardCopy, FileArchive, Files } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SkillCopyMenu({
	onCopySkill,
	onCopyText,
	onCopyZip,
	flush,
}: {
	onCopySkill: () => Promise<void>;
	onCopyText: () => Promise<void>;
	onCopyZip: () => Promise<void>;
	flush: () => Promise<void>;
}) {
	async function run(action: () => Promise<void>) {
		try {
			await flush();
			await action();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Não foi possível copiar a skill");
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="outline" size="sm">
					<ClipboardCopy className="size-3.5" />
					Copiar
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuItem onSelect={() => void run(onCopySkill)}>
					<ClipboardCopy />
					Copiar SKILL.md
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => void run(onCopyText)}>
					<Files />
					Copiar skill como texto
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => void run(onCopyZip)}>
					<FileArchive />
					Copiar pasta como ZIP
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
