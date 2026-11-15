import { ARTIFACT_MIME_BY_EXT } from "@/constants/koworker";

export function isPreviewFile(path: string) {
	const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
	return !!ARTIFACT_MIME_BY_EXT[extension];
}

export function filePreviewUrl(path: string, token: string) {
	return `/api/file-preview/${token}/${path.split(/[\\/]/).map(encodeURIComponent).join("/")}`;
}

export const PREVIEW_SCROLL_MESSAGE = "kowork:preview-scroll";
export const PREVIEW_COPY_MESSAGE = "kowork:preview-copy";
export const PREVIEW_COPY_RESULT_MESSAGE = "kowork:preview-copy-result";
