import { createFileRoute } from "@tanstack/react-router";
import { Check, Palette, Settings } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import { primaryColorPresets, usePrimaryColorStore } from "@/stores/primary-color";
import { PageShell } from "../../components/layout/page-shell";

export const Route = createFileRoute("/_app/configuracoes")({
	component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
	const { presetName, setPresetName } = usePrimaryColorStore();

	return (
		<PageShell
			title="Configurações"
			description="Personalize o aplicativo de acordo com suas preferências"
			icon={Settings}
		>
			<div className="space-y-8 max-w-2xl">
				<section className="space-y-4">
					<div className="flex items-center gap-2">
						<Palette className="h-5 w-5 text-primary" />
						<Title as="h2" size="sm">
							Cor do Tema
						</Title>
					</div>

					<Text size="sm" tone="muted">
						Escolha a cor principal do aplicativo. Esta cor será usada em botões, links e outros
						elementos de destaque.
					</Text>

					<div className="grid grid-cols-4 gap-3">
						{primaryColorPresets.map((preset) => (
							<button
								key={preset.name}
								type="button"
								onClick={() => setPresetName(preset.name)}
								className={cn(
									"flex flex-col items-center gap-2 p-3 border transition-all",
									presetName === preset.name
										? "border-primary bg-primary/10"
										: "border-border hover:border-primary/50 hover:bg-muted/50",
								)}
							>
								<div
									className="w-8 h-8 rounded-full relative"
									style={{ backgroundColor: preset.dark }}
								>
									{presetName === preset.name && (
										<Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
									)}
								</div>
								<Text size="xs" tone={presetName === preset.name ? "default" : "muted"}>
									{preset.name}
								</Text>
							</button>
						))}
					</div>
				</section>
			</div>
		</PageShell>
	);
}
