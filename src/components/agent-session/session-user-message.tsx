import { Text } from "@/components/typography";

export function SessionUserMessage({ text }: { text: string }) {
	return (
		<div className="flex justify-end">
			<div className="min-w-0 max-w-[92%] rounded-xl rounded-br-sm bg-primary/10 px-3.5 py-2.5 sm:max-w-[80%]">
				<Text className="min-w-0 whitespace-pre-wrap break-words text-[15px] leading-6">
					{text}
				</Text>
			</div>
		</div>
	);
}
