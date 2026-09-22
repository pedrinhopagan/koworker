export function isPreviewDocument(path: string) {
	return /\.(html?|pdf)$/i.test(path);
}

export function filePreviewUrl(path: string, token: string) {
	return `/api/file-preview/${token}/${path.split(/[\\/]/).map(encodeURIComponent).join("/")}`;
}
