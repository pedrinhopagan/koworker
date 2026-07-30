import {
	type KeyboardEvent,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

type RovingListboxOptions = {
	count: number;
	onSelect: (index: number) => void;
};

type RovingListbox = {
	activeIndex: number;
	focusedIndex: number | null;
	setActiveIndex: (index: number) => void;
	onKeyDown: (event: KeyboardEvent) => void;
};

function isEditable(target: EventTarget | null): boolean {
	return target instanceof HTMLElement && (target.tagName === "INPUT" || target.isContentEditable);
}

export function useRovingListbox({ count, onSelect }: RovingListboxOptions): RovingListbox {
	const [state, setState] = useState({ index: 0, keyboard: false });

	const activeIndex = count === 0 ? -1 : Math.min(state.index, count - 1);

	const setActiveIndex = useCallback((index: number) => {
		setState((prev) => (prev.index === index ? prev : { index, keyboard: prev.keyboard }));
	}, []);

	function move(delta: number) {
		setState({ index: (activeIndex + delta + count) % count, keyboard: true });
	}

	function onKeyDown(event: KeyboardEvent) {
		if (count === 0) {
			return;
		}

		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			move(event.key === "ArrowDown" ? 1 : -1);
			return;
		}

		if (event.key === "Home" || event.key === "End") {
			event.preventDefault();
			setState({ index: event.key === "Home" ? 0 : count - 1, keyboard: true });
			return;
		}

		if (event.key === "Enter" || (event.key === " " && !isEditable(event.target))) {
			event.preventDefault();
			onSelect(activeIndex);
		}
	}

	return {
		activeIndex,
		focusedIndex: state.keyboard ? activeIndex : null,
		setActiveIndex,
		onKeyDown,
	};
}

export function useRovingOption<T extends HTMLElement>(focused: boolean): RefObject<T | null> {
	const ref = useRef<T>(null);

	useEffect(() => {
		if (!focused) {
			return;
		}
		ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
		ref.current?.focus({ preventScroll: true });
	}, [focused]);

	return ref;
}
