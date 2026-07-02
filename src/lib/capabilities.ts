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
	const tauri = isTauri();

	return {
		// O terminal ainda é spawnado pelo Rust do Tauri; fora do Tauri não há como abrir. A Fatia 3
		// move o spawn para o backend e esta capacidade passa a vir de lá (emulador configurado?).
		canOpenTerminal: tauri,
		// Só o Tauri tem o diálogo nativo de pasta. No browser a escolha vira campo de texto com
		// autocomplete servido pelo backend (system.browseDirectory).
		canPickFolderNatively: tauri,
	};
}
