type VariantManifest = {
	path: string;
	skillHash: string;
	files: { path: string; hash: string }[];
};

export function getSkillConflictNature(variants: VariantManifest[], activePath: string) {
	const active = variants.find((variant) => variant.path === activePath);
	if (!active) {
		return null;
	}
	const activeAssets = JSON.stringify(active.files.filter((file) => file.path !== "SKILL.md"));
	const documentConflict = variants.some((variant) => variant.skillHash !== active.skillHash);
	const assetConflict = variants.some(
		(variant) =>
			JSON.stringify(variant.files.filter((file) => file.path !== "SKILL.md")) !== activeAssets,
	);

	if (documentConflict && assetConflict) {
		return "SKILL.md e arquivos auxiliares divergem";
	}
	if (assetConflict) {
		return "Arquivos auxiliares divergem";
	}
	if (documentConflict) {
		return "SKILL.md diverge";
	}

	return null;
}
