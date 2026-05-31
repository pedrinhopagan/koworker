import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function slugify(value: string): string {
	return value
		.normalize("NFD")
		.replaceAll(/[̀-ͯ]/g, "")
		.toLowerCase()
		.trim()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "");
}

// Corpo inicial gravado no SKILL.md: já no formato esperado, pronto pra editar no detalhe da skill.
function starterContent(title: string): string {
	return `# ${title}

Descreva quando esta skill deve ser usada e o que ela faz.

## Instruções

1. ...
`;
}

export function SkillCreateTile() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");

	const createMutation = useMutation({
		...orpc.skills.create.mutationOptions(),
		onSuccess: (record) => {
			queryClient.invalidateQueries({ queryKey: orpc.skills.list.key() });
			setOpen(false);
			setTitle("");
			if (record) {
				navigate({ to: "/skills/$slug", params: { slug: record.slug } });
			}
		},
		onError: (error: Error) => toast.error(`Erro ao criar skill: ${error.message}`),
	});

	const slug = slugify(title);
	const canCreate = slug.length > 0 && !createMutation.isPending;

	const submit = () => {
		if (!canCreate) return;
		createMutation.mutate({
			slug,
			description: title.trim(),
			content: starterContent(title.trim()),
			metadata: { title: title.trim() },
		});
	};

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="group flex min-w-0 flex-col items-center justify-center gap-2 border border-dashed border-border bg-card/40 p-4 text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-secondary/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<div className="flex h-10 w-10 items-center justify-center border border-dashed border-current">
					<Plus className="size-5" />
				</div>
				<div className="font-display text-sm font-semibold">Nova skill</div>
				<div className="text-xs">Criar a partir de um título</div>
			</button>

			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				title="Nova skill"
				description="Informe um título. O arquivo será criado pronto para editar."
				className="max-w-sm"
				footer={
					<>
						<Button variant="outline" onClick={() => setOpen(false)}>
							Cancelar
						</Button>
						<Button onClick={submit} disabled={!canCreate}>
							{createMutation.isPending ? "Criando..." : "Criar skill"}
						</Button>
					</>
				}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="skill-title">Título</Label>
					<Input
						id="skill-title"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								submit();
							}
						}}
						placeholder="Ex: Revisar pull request"
					/>
					{slug && (
						<span className="font-mono text-[11px] text-muted-foreground">slug: {slug}</span>
					)}
				</div>
			</Dialog>
		</>
	);
}
