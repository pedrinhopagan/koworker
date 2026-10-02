export function assertSingleTenantRuntime(userIds: number[]) {
	if (new Set(userIds).size > 1) {
		throw new Error(
			"O runtime de terminais exige uma única conta. Remova usuários adicionais antes de iniciar o Kowork.",
		);
	}
}
