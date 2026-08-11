import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { Type } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { MarkdownEditor } from "@/components/markdown-doc";
import { Text, Title } from "@/components/typography";
import { CustomSelect } from "@/components/ui/custom-select";
import { type FontId, FONTS } from "@/lib/constants/fonts";
import { useFontStore } from "@/stores/fonts";

export const Route = createLazyFileRoute("/_app/fontes")({
	component: FontesPage,
});

const fontOptions = Object.entries(FONTS).map(([id, font]) => ({
	id: id as FontId,
	label: font.label,
}));

const sampleMarkdown = `# Refatorar o fluxo de criação de tarefa

O objetivo é tornar a criação de tarefa **idempotente** e validar a entrada
no _boundary_ antes de tocar o banco.

## Contexto
- O front envia apenas \`projectId\` e o título.
- O back resolve a ordem e os defaults a partir do projeto.

> Não devolva dados copiados do servidor; o front manda intenção, não estado.

\`\`\`ts
const task = await DbTasks.create({ projectId, title });
\`\`\`

1. Validar o payload com o schema do endpoint.
2. Inserir e ler de volta o que importa.
3. Publicar o evento de realtime.
`;

function FontPicker({
	title,
	description,
	value,
	onChange,
}: {
	title: string;
	description: string;
	value: FontId;
	onChange: (font: FontId) => void;
}) {
	return (
		<section className="space-y-2">
			<div className="space-y-1">
				<Title as="h2" size="sm">
					{title}
				</Title>
				<Text size="xs" tone="muted">
					{description}
				</Text>
			</div>
			<CustomSelect
				items={fontOptions}
				value={value}
				onValueChange={(font) => onChange(font as FontId)}
				renderItem={(font) => font.label}
				triggerClassName="h-9 w-full"
			/>
		</section>
	);
}

function FontesPage() {
	const { uiFont, readingFont, setUiFont, setReadingFont } = useFontStore();
	const navigate = useNavigate();

	return (
		<PageShell
			title="Tipografia"
			description="Escolha as fontes usadas na interface e na leitura"
			icon={Type}
			onBack={() => navigate({ to: "/configuracoes" })}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-8"
		>
			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div className="space-y-8">
					<FontPicker
						title="Fonte da interface"
						description="Usada em menus, listas, botões e títulos."
						value={uiFont}
						onChange={setUiFont}
					/>
					<FontPicker
						title="Fonte de leitura"
						description="Usada na leitura e escrita de documentos Markdown."
						value={readingFont}
						onChange={setReadingFont}
					/>
				</div>

				<div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
					<section className="space-y-3 border border-border bg-card p-4">
						<Title as="h2" size="sm" className="uppercase tracking-[0.12em]">
							Interface
						</Title>
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<span className="border border-primary bg-primary/10 px-2 py-1 text-primary">
								K-142
							</span>
							<span className="border border-border px-2 py-1">Em progresso</span>
							<span className="text-muted-foreground">Alt+1 · Alt+2 · Alt+3</span>
						</div>
						<div className="space-y-1">
							<Text size="sm">Implementar boundary de validação no endpoint de tarefas</Text>
							<Text size="xs" tone="muted">
								projeto · koworker — atualizado há 2 min
							</Text>
						</div>
						<code className="block border border-border bg-muted/40 p-2 text-xs">
							const task = await DbTasks.create(input)
						</code>
					</section>

					<section className="space-y-3 border border-border bg-card p-4">
						<Title as="h2" size="sm" className="uppercase tracking-[0.12em]">
							Leitura de .md
						</Title>
						<div className="border border-border bg-background p-3">
							<MarkdownEditor initialContent={sampleMarkdown} onChange={() => {}} />
						</div>
					</section>
				</div>
			</div>
		</PageShell>
	);
}
