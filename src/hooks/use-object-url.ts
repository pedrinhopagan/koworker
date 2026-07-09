import { useEffect, useState } from "react";

// Object URL de um Blob, revogado no unmount/troca — o padrão de render de imagem vinda do oRPC
// (asset viewer, thumbs da /media, chips do prompt bar).
export function useObjectUrl(blob: Blob | undefined): string | null {
	const [url, setUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!blob) {
			setUrl(null);
			return;
		}

		const objectUrl = URL.createObjectURL(blob);
		setUrl(objectUrl);
		return () => URL.revokeObjectURL(objectUrl);
	}, [blob]);

	return url;
}
