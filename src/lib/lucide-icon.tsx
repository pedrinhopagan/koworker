import { FolderOpen, type LucideIcon as LucideIconComponent } from "lucide-react";
import { useSyncExternalStore } from "react";

type IconesLucide = Record<string, LucideIconComponent>;

let icones: IconesLucide | undefined;
let carregamento: Promise<IconesLucide> | undefined;
const ouvintes = new Set<() => void>();

function carregarIcones() {
	if (!carregamento) {
		carregamento = import("lucide-react").then((modulo) => {
			icones = modulo.icons as IconesLucide;

			for (const ouvinte of ouvintes) {
				ouvinte();
			}

			return icones;
		});
	}

	return carregamento;
}

function inscrever(ouvinte: () => void) {
	ouvintes.add(ouvinte);
	void carregarIcones();

	return () => {
		ouvintes.delete(ouvinte);
	};
}

export function useIconesLucide() {
	return useSyncExternalStore(
		inscrever,
		() => icones,
		() => icones,
	);
}

type LucideIconProps = {
	name?: string;
	className?: string;
	style?: React.CSSProperties;
};

export function LucideIcon({ name, className, ...props }: LucideIconProps) {
	const disponiveis = useIconesLucide();
	const ResolvedIcon = (name && disponiveis?.[name]) || FolderOpen;

	return <ResolvedIcon className={className} {...props} />;
}
