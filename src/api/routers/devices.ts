import { ORPCError } from "@orpc/server";

import type { Device } from "../auth/context";
import { localProcedure, protectedProcedure } from "../auth/context";
import { closeWsSessionsForDevice } from "../auth/ws-sessions";
import { DbDevices } from "../db/devices";
import { DeviceIdSchema, DeviceRenameSchema } from "../schemas/devices";

function toOutput(device: Device, currentDeviceId: string) {
	return {
		id: device.id,
		name: device.name,
		status: device.status,
		userAgent: device.user_agent ?? null,
		lastIp: device.last_ip ?? null,
		createdAt: device.created_at,
		lastSeenAt: device.last_seen_at,
		current: device.id === currentDeviceId,
	};
}

async function requireDevice(deviceId: string, userId: number) {
	const device = await DbDevices.getById(deviceId);

	if (!device || device.user_id !== userId) {
		throw new ORPCError("NOT_FOUND", { message: "Dispositivo não encontrado" });
	}

	return device;
}

export const devicesRouter = {
	list: protectedProcedure.handler(async ({ context }) => {
		const devices = await DbDevices.listByUser(context.user.id);

		return devices.map((device) => toOutput(device, context.device.id));
	}),

	approve: localProcedure.input(DeviceIdSchema).handler(async ({ input, context }) => {
		const device = await requireDevice(input.deviceId, context.user.id);
		await DbDevices.setStatus(device.id, "approved");

		return { approved: true };
	}),

	block: localProcedure.input(DeviceIdSchema).handler(async ({ input, context }) => {
		const device = await requireDevice(input.deviceId, context.user.id);
		await DbDevices.setStatus(device.id, "blocked");
		closeWsSessionsForDevice(device.id);

		return { blocked: true };
	}),

	// Revogar apaga a linha: o cookie do aparelho deixa de apontar pra algo, a sessão morre no ato e
	// um novo acesso volta pra fila de pendentes.
	revoke: localProcedure.input(DeviceIdSchema).handler(async ({ input, context }) => {
		const device = await requireDevice(input.deviceId, context.user.id);
		await DbDevices.remove(device.id);
		closeWsSessionsForDevice(device.id);

		return { revoked: true };
	}),

	rename: localProcedure.input(DeviceRenameSchema).handler(async ({ input, context }) => {
		const device = await requireDevice(input.deviceId, context.user.id);
		await DbDevices.rename(device.id, input.name);

		return { renamed: true };
	}),
};
