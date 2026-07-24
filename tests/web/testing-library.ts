import {
	act,
	cleanup as testingLibraryCleanup,
	fireEvent,
	render,
	renderHook,
	waitFor,
} from "@testing-library/react";

export { act, fireEvent, render, renderHook, waitFor };
export { default as userEvent, type UserEvent } from "@testing-library/user-event";

export async function cleanup() {
	await act(() => {
		testingLibraryCleanup();
	});
}
