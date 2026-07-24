import "../../../../../tests/web/setup-dom";

import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, userEvent, waitFor } from "../../../../../tests/web/testing-library";
import { SkillCopyMenu } from "../-components/skill-copy-menu";
import { SkillStandardizeDialog } from "../-components/skill-standardize-dialog";
import { getSkillConflictNature } from "../-utils/skill-page-actions";

afterEach(cleanup);

function button(label: string) {
	const found = [...document.querySelectorAll("button")].find((item) =>
		item.textContent?.includes(label),
	);
	if (!(found instanceof HTMLButtonElement)) {
		throw new Error(`Botão ${label} não encontrado`);
	}
	return found;
}

function action(label: string) {
	const found = [...document.querySelectorAll('button, [role="menuitem"]')].find((item) =>
		item.textContent?.includes(label),
	);
	if (!(found instanceof HTMLElement)) {
		throw new Error(`Ação ${label} não encontrada`);
	}
	return found;
}

describe.serial("fluxo da rota de skill", () => {
	test("menu de cópia espera o flush antes de ler a variante", async () => {
		let releaseFlush = () => {};
		const events: string[] = [];
		const flush = () =>
			new Promise<void>((resolve) => {
				releaseFlush = () => {
					events.push("flush");
					resolve();
				};
			});
		render(
			<div data-theme-root>
				<SkillCopyMenu
					flush={flush}
					onCopySkill={() => {
						events.push("read:SKILL.md");
						return Promise.resolve();
					}}
					onCopyText={() => Promise.resolve()}
					onCopyZip={() => Promise.resolve()}
				/>
			</div>,
		);
		const user = userEvent.setup();

		await user.click(button("Copiar"));
		await waitFor(() => expect(action("Copiar SKILL.md")).toBeInstanceOf(HTMLElement));
		await user.click(action("Copiar SKILL.md"));
		expect(events).toEqual([]);
		releaseFlush();
		await waitFor(() => expect(events).toEqual(["flush", "read:SKILL.md"]));
	});

	test("menu de cópia bloqueia a leitura quando o flush falha", async () => {
		let read = false;
		render(
			<div data-theme-root>
				<SkillCopyMenu
					flush={async () => {
						await Promise.resolve();
						throw new Error("save falhou");
					}}
					onCopySkill={() => {
						read = true;
						return Promise.resolve();
					}}
					onCopyText={() => Promise.resolve()}
					onCopyZip={() => Promise.resolve()}
				/>
			</div>,
		);

		const user = userEvent.setup();
		await user.click(button("Copiar"));
		await waitFor(() => expect(action("Copiar SKILL.md")).toBeInstanceOf(HTMLElement));
		await user.click(action("Copiar SKILL.md"));
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
		expect(read).toBe(false);
	});

	test("conflito detecta assets diferentes mesmo com SKILL.md igual", () => {
		expect(
			getSkillConflictNature(
				[
					{
						path: "/one/SKILL.md",
						skillHash: "same",
						files: [
							{ path: "SKILL.md", hash: "same" },
							{ path: "asset.txt", hash: "one" },
						],
					},
					{
						path: "/two/SKILL.md",
						skillHash: "same",
						files: [
							{ path: "SKILL.md", hash: "same" },
							{ path: "asset.txt", hash: "two" },
						],
					},
				],
				"/one/SKILL.md",
			),
		).toBe("Arquivos auxiliares divergem");
	});

	test("prévia mostra remoções e confirmação usa o planHash", async () => {
		const plans: string[] = [];
		render(
			<SkillStandardizeDialog
				open
				label="Codex"
				flush={() => Promise.resolve()}
				loadPreview={() =>
					Promise.resolve({ planHash: "plan-123", updated: 2, created: 1, removedFiles: 3 })
				}
				apply={(planHash) => {
					plans.push(planHash);
					return Promise.resolve();
				}}
				onClose={() => {}}
			/>,
		);
		await waitFor(() =>
			expect(document.body.textContent).toContain("3 arquivo(s) extra(s) removido(s)"),
		);

		await userEvent.setup().click(button("Confirmar"));
		expect(plans).toEqual(["plan-123"]);
	});

	test("falha no apply permanece visível e não apresenta sucesso", async () => {
		render(
			<SkillStandardizeDialog
				open
				label="Codex"
				flush={() => Promise.resolve()}
				loadPreview={() =>
					Promise.resolve({ planHash: "plan", updated: 1, created: 0, removedFiles: 0 })
				}
				apply={async () => {
					await Promise.resolve();
					throw new Error("Falha transacional");
				}}
				onClose={() => {
					throw new Error("Não deveria fechar");
				}}
			/>,
		);
		await waitFor(() => expect(button("Confirmar").disabled).toBe(false));
		await userEvent.setup().click(button("Confirmar"));
		await waitFor(() =>
			expect(document.querySelector('[data-slot="standardize-error"]')?.textContent).toBe(
				"Falha transacional",
			),
		);
	});

	test("CONFLICT refaz a prévia sem fechar com sucesso", async () => {
		let previews = 0;
		render(
			<SkillStandardizeDialog
				open
				label="Codex"
				flush={() => Promise.resolve()}
				loadPreview={async () => {
					await Promise.resolve();
					previews += 1;
					return {
						planHash: `plan-${previews}`,
						updated: 1,
						created: 0,
						removedFiles: previews,
					};
				}}
				apply={async () => {
					await Promise.resolve();
					throw Object.assign(new Error("Plano mudou"), { code: "CONFLICT" });
				}}
				onClose={() => {
					throw new Error("Não deveria fechar");
				}}
			/>,
		);
		await waitFor(() => expect(button("Confirmar").disabled).toBe(false));
		await userEvent.setup().click(button("Confirmar"));
		await waitFor(() => expect(previews).toBe(2));
		expect(document.body.textContent).toContain("2 arquivo(s) extra(s) removido(s)");
	});

	test("rerender não inicia uma segunda prévia concorrente", async () => {
		let calls = 0;
		const loadPreview = () => {
			calls += 1;
			return Promise.resolve({ planHash: "plan", updated: 1, created: 0, removedFiles: 0 });
		};
		const { rerender } = render(
			<SkillStandardizeDialog
				open
				label="Codex"
				flush={() => Promise.resolve()}
				loadPreview={loadPreview}
				apply={() => Promise.resolve()}
				onClose={() => {}}
			/>,
		);
		rerender(
			<SkillStandardizeDialog
				open
				label="Codex atualizado"
				flush={() => Promise.resolve()}
				loadPreview={loadPreview}
				apply={() => Promise.resolve()}
				onClose={() => {}}
			/>,
		);
		await waitFor(() => expect(button("Confirmar").disabled).toBe(false));
		expect(calls).toBe(1);
	});
});
