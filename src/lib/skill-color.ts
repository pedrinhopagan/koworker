function hexToRgb(hex: string): [number, number, number] | null {
	const value = hex.trim().replace(/^#/, "");
	if (value.length !== 6) return null;
	const parsed = Number.parseInt(value, 16);
	if (Number.isNaN(parsed)) return null;
	return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const delta = max - min;
	const l = (max + min) / 2;

	if (delta === 0) {
		return [0, 0, l * 100];
	}

	const s = delta / (1 - Math.abs(2 * l - 1));
	let h = 0;
	if (max === rn) {
		h = ((gn - bn) / delta) % 6;
	} else if (max === gn) {
		h = (bn - rn) / delta + 2;
	} else {
		h = (rn - gn) / delta + 4;
	}
	h = Math.round(h * 60);
	if (h < 0) h += 360;

	return [h, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
	const sn = s / 100;
	const ln = l / 100;
	const c = (1 - Math.abs(2 * ln - 1)) * sn;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = ln - c / 2;

	let rp = 0;
	let gp = 0;
	let bp = 0;
	if (h < 60) {
		[rp, gp, bp] = [c, x, 0];
	} else if (h < 120) {
		[rp, gp, bp] = [x, c, 0];
	} else if (h < 180) {
		[rp, gp, bp] = [0, c, x];
	} else if (h < 240) {
		[rp, gp, bp] = [0, x, c];
	} else if (h < 300) {
		[rp, gp, bp] = [x, 0, c];
	} else {
		[rp, gp, bp] = [c, 0, x];
	}

	const toHex = (channel: number) =>
		Math.round((channel + m) * 255)
			.toString(16)
			.padStart(2, "0");

	return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
}

function hashString(value: string): number {
	let hash = 0;
	for (let index = 0; index < value.length; index++) {
		hash = Math.imul(hash, 31) + (value.codePointAt(index) ?? 0);
	}
	return Math.abs(hash);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

// Deriva um tom da cor da categoria para a skill: mantém a matiz (mesma família visível) e desloca
// lightness/saturation de forma determinística pelo slug, para que skills irmãs se distingam sem
// gravar cor nenhuma. Os clamps seguram a legibilidade em tema claro e escuro.
export function deriveSkillColor(categoryColor: string, slug: string): string {
	const rgb = hexToRgb(categoryColor);
	if (!rgb) return categoryColor;

	const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
	const seed = hashString(slug);
	const lightShift = (seed % 17) - 8;
	const satShift = ((seed >> 5) % 21) - 10;

	return hslToHex(h, clamp(s + satShift, 32, 92), clamp(l + lightShift, 42, 72));
}
