import { File, FileCode2, FileImage, FileText, Film, Music2 } from "lucide-react";

export function filePresentation(mime: string) {
	if (mime.startsWith("video/")) {
		return { icon: Film, label: "Vídeo" };
	}
	if (mime.startsWith("audio/")) {
		return { icon: Music2, label: "Áudio" };
	}
	if (mime.startsWith("image/")) {
		return { icon: FileImage, label: "Imagem" };
	}
	if (mime === "application/pdf") {
		return { icon: FileText, label: "Documento PDF" };
	}
	if (mime === "text/html") {
		return { icon: FileCode2, label: "Apresentação HTML" };
	}

	return { icon: File, label: "Arquivo" };
}
