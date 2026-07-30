import { expect, test } from "bun:test";

import { matchProjectByCwd } from "./state";

const projects = [
	{ id: "app", name: "App", main_route: "/proj/app" },
	{ id: "pacote", name: "Pacote", main_route: "/proj/app/pacote" },
];

test("agent aberto na raiz do projeto casa com ele", () => {
	expect(matchProjectByCwd(projects, "/proj/app")?.id).toBe("app");
});

test("raiz aninhada vence: o agent está no pacote, não no app", () => {
	expect(matchProjectByCwd(projects, "/proj/app/pacote/src")?.id).toBe("pacote");
});

test("pasta fora de todo projeto não inventa vínculo", () => {
	expect(matchProjectByCwd(projects, "/proj/appx")).toBeNull();
	expect(matchProjectByCwd(projects, "/outro")).toBeNull();
});
