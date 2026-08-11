import { MarkdownView } from "@/components/markdown-view";

// A fala de quem digita passa pelo mesmo motor de markdown da resposta do agent: quem cola um
// trecho com crases, uma lista ou um link vê o mesmo resultado que veria no leitor de `.md`.
export function SessionUserMessage({ text }: { text: string }) {
	return (
		<div className="flex justify-end">
			<div className="min-w-0 max-w-[92%] rounded-xl rounded-br-sm bg-primary/10 px-3.5 py-2.5 sm:max-w-[80%]">
				<MarkdownView text={text} className="text-[15px]" />
			</div>
		</div>
	);
}
