import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	cleanup as testingLibraryCleanup,
	fireEvent,
	render,
	renderHook,
	waitFor,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";

export { act, fireEvent, render, renderHook, waitFor };

export function renderWithQuery(ui: ReactNode) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

	return render(createElement(QueryClientProvider, { client }, ui));
}
export { default as userEvent, type UserEvent } from "@testing-library/user-event";

export async function cleanup() {
	await act(() => {
		testingLibraryCleanup();
	});
}
