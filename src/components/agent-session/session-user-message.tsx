import { User } from "lucide-react";

import { Text } from "@/components/typography";

export function SessionUserMessage({ text }: { text: string }) {
	return (
		<div className="flex justify-end">
			<div className="flex min-w-0 max-w-[92%] items-start gap-2 border border-border bg-muted/40 px-3 py-2 sm:max-w-[80%]">
				<User className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
				<Text className="min-w-0 whitespace-pre-wrap break-words text-[15px] leading-6">
					{text}
				</Text>
			</div>
		</div>
	);
}
