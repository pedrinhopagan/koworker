import { isTauri } from "@/lib/tauri";

// Capacidades de SO expostas à UI, no lugar do gate binário isTauri(). Cada campo nomeia uma
// intenção — o que ESTE cliente consegue fazer — em vez de "estou no Tauri?". Abrir pasta e
// compartilhar zip não entram aqui: o backend (local) executa os dois em qualquer cliente, então
// as ações valem sempre e não precisam de gate.
export type Capabilities = {
	canOpenTerminal: boolean;
	canPickFolderNatively: boolean;
};

export function getCapabilities(): Capabilities {
	return {
		// O terminal é um serviço do backend (spawn via Bun.spawn na máquina local), com template de
		// emulador sempre configurado por plataforma. Qualquer cliente — browser ou desktop — fala com o
		// mesmo backend local, então a capacidade vale sempre.
		canOpenTerminal: true,
		// Só o Tauri tem o diálogo nativo de pasta. No browser a escolha vira campo de texto com
		// autocomplete servido pelo backend (system.browseDirectory).
		canPickFolderNatively: isTauri(),
	};
}
