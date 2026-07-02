import { isTauri } from "@/lib/tauri";

// Capacidades do CLIENTE — o que ESTE runtime (browser ou webview Tauri) consegue fazer sozinho, sem
// perguntar ao backend. Facts do HOST (ex.: se a máquina abre terminal) vêm do backend via
// `system.capabilities` (useCapabilities), porque só ele conhece a plataforma onde roda.
export type Capabilities = {
	canPickFolderNatively: boolean;
};

export function getCapabilities(): Capabilities {
	return {
		// Só o Tauri tem o diálogo nativo de pasta. No browser a escolha vira campo de texto com
		// autocomplete servido pelo backend (system.browseDirectory).
		canPickFolderNatively: isTauri(),
	};
}
