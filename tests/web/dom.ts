export function get(component: string, filters?: Record<string, string>) {
	const selector = buildSelector(component, filters);
	const elements = document.querySelectorAll(selector);

	if (elements.length === 0) {
		throw new Error(`get: nenhum elemento encontrado para ${selector}`);
	}

	if (elements.length > 1) {
		throw new Error(`get: encontrados ${elements.length} elementos para ${selector}, esperado 1`);
	}

	return elements[0] as HTMLElement;
}

export function query(component: string, filters?: Record<string, string>) {
	const selector = buildSelector(component, filters);
	const elements = document.querySelectorAll(selector);

	if (elements.length > 1) {
		throw new Error(
			`query: encontrados ${elements.length} elementos para ${selector}, esperado 0 ou 1`,
		);
	}

	if (elements.length === 0) {
		return null;
	}

	return elements[0] as HTMLElement;
}

export function slot(parent: HTMLElement, name: string) {
	const element = parent.querySelector(`[data-slot="${name}"]`);

	if (!element) {
		const component = parent.dataset.component ?? "desconhecido";

		throw new Error(`slot: nenhum slot "${name}" encontrado no componente "${component}"`);
	}

	return element as HTMLElement;
}

function buildSelector(component: string, filters?: Record<string, string>) {
	let selector = `[data-component="${component}"]`;

	if (filters) {
		for (const [key, value] of Object.entries(filters)) {
			selector += `[data-${key}="${value}"]`;
		}
	}

	return selector;
}
