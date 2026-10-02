const XML_CHARACTERS = /[&<>"']/g;
const XML_REPLACEMENTS: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&apos;",
};

const ACCENT_COLORS = ["#909D63", "#71829D", "#A06F5C", "#9B875A", "#718E84"];

function escapeXml(value: string) {
	return value.replaceAll(XML_CHARACTERS, (character) => XML_REPLACEMENTS[character] ?? character);
}

function hashName(name: string) {
	let hash = 0;
	for (const character of name) {
		hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 360;
	}
	return hash;
}

function initialsFromName(name: string) {
	const parts = name.split(/[-_\s—]+/).filter(Boolean);
	const initials = parts
		.slice(0, 2)
		.map((part) => part.at(0)?.toUpperCase())
		.join("");

	return escapeXml(initials || "•");
}

export function createGeneratedProjectLogo(name: string) {
	const hash = hashName(name);
	const accent = ACCENT_COLORS[hash % ACCENT_COLORS.length];
	const initials = initialsFromName(name);

	return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
	<rect x="32" y="32" width="448" height="448" fill="#1D1D1B"/>
	<path d="M72 176V72h104M336 440h104V336" fill="none" stroke="${accent}" stroke-width="16"/>
	<path d="M72 208v232h232M208 72h232v232" fill="none" stroke="#444440" stroke-width="4"/>
	<text x="256" y="303" text-anchor="middle" fill="#E7E5E4" font-family="Inter,DejaVu Sans,sans-serif" font-size="148" font-weight="700" letter-spacing="-6">${initials}</text>
</svg>`;
}
