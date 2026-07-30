import { useEffect, useState } from "react";

const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";

export function useIsMobileViewport() {
	const [isMobile, setIsMobile] = useState(
		() => typeof window !== "undefined" && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches,
	);

	useEffect(() => {
		const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);

		function handleChange() {
			setIsMobile(query.matches);
		}

		handleChange();
		query.addEventListener("change", handleChange);

		return () => query.removeEventListener("change", handleChange);
	}, []);

	return isMobile;
}
