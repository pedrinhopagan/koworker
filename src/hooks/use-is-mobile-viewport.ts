import { useEffect, useState } from "react";

const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";

export function useIsMobileViewport(mediaQuery = MOBILE_VIEWPORT_QUERY) {
	const [isMobile, setIsMobile] = useState(
		() => typeof window !== "undefined" && window.matchMedia(mediaQuery).matches,
	);

	useEffect(() => {
		const query = window.matchMedia(mediaQuery);

		function handleChange() {
			setIsMobile(query.matches);
		}

		handleChange();
		query.addEventListener("change", handleChange);

		return () => query.removeEventListener("change", handleChange);
	}, [mediaQuery]);

	return isMobile;
}
