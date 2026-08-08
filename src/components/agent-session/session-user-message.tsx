import { User } from "lucide-react";

import { Text } from "@/components/typography";

export function SessionUserMessage({ text }: { text: string }) {
	return (
		<div className="flex justify-end">
			<div className="min-w-0 max-w-[92%] rounded-xl rounded-br-sm bg-primary/10 px-3.5 py-2.5 sm:max-w-[80%]">
				<header className="mb-1 flex items-center justify-end gap-1.5">
					<User className="size-3 shrink-0 text-muted-foreground" />
					<Text as="span" className="text-[11px] font-bold uppercase tracking-[0.12em]">
						Você
					</Text>
				</header>
				<Text className="min-w-0 whitespace-pre-wrap break-words text-[15px] leading-6">
					{text}
				</Text>
			</div>
		</div>
	);
}
