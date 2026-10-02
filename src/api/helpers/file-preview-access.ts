import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

import { SECRET } from "../auth/session";

const previewClaims = z.object({
	directory: z.string().min(1),
	viewer: z.number().int(),
	device: z.string().min(1),
	epoch: z.number().int(),
});

export async function createFilePreviewToken(input: z.infer<typeof previewClaims>) {
	return await new SignJWT(input)
		.setProtectedHeader({ alg: "HS256" })
		.setAudience("kowork-file-preview")
		.setExpirationTime("1h")
		.sign(SECRET);
}

export async function verifyFilePreviewToken(token: string) {
	try {
		const { payload } = await jwtVerify(token, SECRET, {
			audience: "kowork-file-preview",
			algorithms: ["HS256"],
		});
		return previewClaims.parse(payload);
	} catch {
		return null;
	}
}
