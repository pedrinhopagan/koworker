import { sep } from "node:path";

export function isPathInside(root: string, target: string) {
	if (!root || !target) {
		return false;
	}

	const base = root.endsWith(sep) ? root.slice(0, -sep.length) : root;

	return target === root || target === base || target.startsWith(`${base}${sep}`);
}
