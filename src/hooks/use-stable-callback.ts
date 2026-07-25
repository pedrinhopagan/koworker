import { useCallback, useRef } from "react";

export function useStableCallback<Args extends unknown[], Result>(
	callback: (...args: Args) => Result,
) {
	const ref = useRef(callback);
	ref.current = callback;

	return useCallback((...args: Args) => ref.current(...args), []);
}
