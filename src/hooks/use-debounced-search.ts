import { useEffect, useRef, useState } from "react";

import { useStableCallback } from "./use-stable-callback";

export function useDebouncedSearch(value: string, commit: (next: string) => void, delayMs = 300) {
	const [draft, setDraft] = useState(value);
	const committed = useRef(value);
	const commitStable = useStableCallback(commit);

	if (value !== committed.current) {
		committed.current = value;

		if (value !== draft) {
			setDraft(value);
		}
	}

	useEffect(() => {
		if (draft === committed.current) {
			return;
		}

		const timer = setTimeout(() => {
			committed.current = draft;
			commitStable(draft);
		}, delayMs);

		return () => clearTimeout(timer);
	}, [draft, delayMs, commitStable]);

	return [draft, setDraft] as const;
}
