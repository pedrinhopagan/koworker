import { isDesktop } from "@/lib/desktop";

// Capacidades do CLIENTE — o que este runtime (browser ou shell desktop) consegue fazer sozinho, sem
// perguntar ao backend. Facts do HOST (ex.: se a máquina abre terminal) vêm do backend via
// `system.capabilities` (useCapabilities), porque só ele conhece a plataforma onde roda.
export type Capabilities = {
	canPickFolderNatively: boolean;
};

export function getCapabilities(): Capabilities {
	return {
		// Só o shell desktop tem o diálogo nativo de pasta. No browser a escolha vira campo de texto com
		// autocomplete servido pelo backend (system.browseDirectory).
		canPickFolderNatively: isDesktop(),
	};
}
