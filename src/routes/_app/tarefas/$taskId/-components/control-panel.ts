type ShouldDisableControlPanelCopyParams = {
	userInput: string;
	disabled?: boolean;
};

export function buildControlPanelClipboardText(userInput: string): string {
	return userInput;
}

export function shouldDisableControlPanelCopy(
	params: ShouldDisableControlPanelCopyParams,
): boolean {
	return Boolean(params.disabled) || params.userInput.trim().length === 0;
}
