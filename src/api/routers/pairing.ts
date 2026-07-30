import { ORPCError } from "@orpc/server";
import QRCode from "qrcode";

import { localProcedure, publicProcedure } from "../auth/context";
import { registerPairedDevice } from "../auth/device";
import { issueSessionCookie } from "../auth/session";
import { DbUsers } from "../db/users";
import { consumePairingToken, createPairingToken } from "../helpers/pairing";
import { getSystemSettings } from "../helpers/system-settings";
import { PairingConsumeSchema } from "../schemas/pairing";

export const pairingRouter = {
	// Só de dentro da máquina: quem desenha o QR é o computador que já é dono da conta, e o token que
	// ele devolve vale por uma sessão inteira no celular.
	start: localProcedure.handler(async ({ context }) => {
		const { mobileBaseUrl } = await getSystemSettings();

		if (!mobileBaseUrl) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Configure o endereço do celular em Sistema antes de parear.",
			});
		}

		const { token, expiresAt } = createPairingToken(context.user.id);
		const url = new URL(`/parear/${token}`, mobileBaseUrl).href;

		return { url, expiresAt, qrSvg: await QRCode.toString(url, { type: "svg", margin: 1 }) };
	}),

	// Pública porque roda no celular antes de existir sessão: o token do QR é a credencial, e ele
	// morre no primeiro uso.
	consume: publicProcedure.input(PairingConsumeSchema).handler(async ({ input, context }) => {
		const userId = consumePairingToken(input.token);

		if (!userId) {
			throw new ORPCError("UNAUTHORIZED", { message: "Código expirado ou já usado." });
		}

		const user = await DbUsers.getById(userId);

		if (!user) {
			throw new ORPCError("UNAUTHORIZED", { message: "Usuário do código não existe mais." });
		}

		const device = await registerPairedDevice({
			userId: user.id,
			reqHeaders: context.reqHeaders,
			resHeaders: context.resHeaders,
			remoteAddress: context.remoteAddress,
		});

		await issueSessionCookie({
			userId: user.id,
			sessionEpoch: user.session_epoch ?? 0,
			deviceId: device.id,
			resHeaders: context.resHeaders,
			reqHeaders: context.reqHeaders,
		});

		return { name: user.name, device: { id: device.id, name: device.name } };
	}),
};
