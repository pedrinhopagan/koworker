import { homedir } from "node:os";
import { sep } from "node:path";

const HOME = homedir();

// Troca o home do usuário por `~` para exibição. O home só é conhecido no backend, então ele devolve
// o caminho já pronto e o frontend deixa de adivinhar com regex de `/home/<user>`.
export function toDisplayPath(absPath: string): string {
	if (absPath === HOME) {
		return "~";
	}
	if (absPath.startsWith(HOME + sep)) {
		return `~${absPath.slice(HOME.length)}`;
	}
	return absPath;
}
