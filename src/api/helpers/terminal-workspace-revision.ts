export function shouldEmitTerminalWorkspaceSnapshot(deliveredRevision: number, revision: number) {
	return revision > deliveredRevision;
}
