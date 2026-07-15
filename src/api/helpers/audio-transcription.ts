import axios from "redaxios";
import { z } from "zod";

import { envVariables } from "../config/env";

const groqTranscriptionResponse = z.object({
	text: z.string().trim().min(1),
});

export async function transcribeAudio(file: File) {
	if (!envVariables.GROQ_API_KEY) {
		throw new Error("Configure GROQ_API_KEY no ambiente do backend para transcrever áudio");
	}

	const body = new FormData();
	body.set("file", file, file.name || "gravacao");
	body.set("model", "whisper-large-v3-turbo");
	body.set("language", "pt");
	body.set("response_format", "json");

	const { data } = await axios({
		method: "POST",
		url: "https://api.groq.com/openai/v1/audio/transcriptions",
		headers: { Authorization: `Bearer ${envVariables.GROQ_API_KEY}` },
		data: body,
	});

	return groqTranscriptionResponse.parse(data);
}
