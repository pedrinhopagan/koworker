import { toast } from "sonner";

import { isTauri } from "@/lib/tauri";

const SKILLS_BASE_PATH = "~/.config/opencode/skills";

export async function openSkillFolder(skillSlug: string): Promise<void> {
	const path = `${SKILLS_BASE_PATH}/${skillSlug}`;

	if (!isTauri()) {
		toast.info(`Pasta da skill: ${path}`);
		return;
	}

	try {
		const { invoke } = await import("@tauri-apps/api/core");
		await invoke("open_folder", { path });
	} catch (error) {
		console.error("[Skills] Erro ao abrir pasta:", error);
		toast.error("Erro ao abrir pasta da skill");
	}
}
