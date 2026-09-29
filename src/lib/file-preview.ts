export function isPreviewDocument(path: string) {
	return /\.(html?|pdf)$/i.test(path);
}

export function filePreviewUrl(path: string, token: string) {
	return `/api/file-preview/${token}/${path.split(/[\\/]/).map(encodeURIComponent).join("/")}`;
}

export const PREVIEW_SCROLL_MESSAGE = "kowork:preview-scroll";
export const PREVIEW_COPY_MESSAGE = "kowork:preview-copy";
export const PREVIEW_COPY_RESULT_MESSAGE = "kowork:preview-copy-result";
