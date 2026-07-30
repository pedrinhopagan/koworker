import type { AgentStep, AgentStepPatch } from "@/lib/agent-stream";

const MAX_STEPS_PER_RUN = 400;
const RETENTION_MS = 6 * 60 * 60_000;
const SWEEP_INTERVAL_MS = 10 * 60_000;

type RunBuffer = {
	steps: AgentStep[];
	refs: Map<string, number>;
	nextSeq: number;
	touchedAt: number;
};

// O detalhe do que o agente fez é volume demais para o banco e vale só enquanto alguém acompanha:
// fica em memória por algumas horas depois do fim, tempo de sobra para abrir a notificação no
// celular. O desfecho que precisa durar já está em `execution_runs`.
const buffers = new Map<string, RunBuffer>();

const sweeper = setInterval(() => {
	const cutoff = Date.now() - RETENTION_MS;
	for (const [runId, buffer] of buffers) {
		if (buffer.touchedAt < cutoff) {
			buffers.delete(runId);
		}
	}
}, SWEEP_INTERVAL_MS);
sweeper.unref();

export function applyRunStepPatches(runId: string, patches: AgentStepPatch[]): AgentStep[] {
	if (patches.length === 0) {
		return [];
	}

	const buffer: RunBuffer = buffers.get(runId) ?? {
		steps: [],
		refs: new Map(),
		nextSeq: 1,
		touchedAt: 0,
	};
	buffers.set(runId, buffer);
	buffer.touchedAt = Date.now();

	const changed: AgentStep[] = [];

	for (const patch of patches) {
		if (patch.type === "settle") {
			const seq = buffer.refs.get(patch.ref);
			const target = buffer.steps.find((step) => step.seq === seq);
			if (!target) {
				continue;
			}
			target.status = patch.status;
			if (patch.detail) {
				target.detail = patch.detail;
			}
			changed.push({ ...target });
			continue;
		}

		const step: AgentStep = { ...patch.step, seq: buffer.nextSeq, at: Date.now() };
		buffer.nextSeq += 1;
		buffer.steps.push(step);
		if (patch.ref) {
			buffer.refs.set(patch.ref, step.seq);
		}
		changed.push(step);
	}

	if (buffer.steps.length > MAX_STEPS_PER_RUN) {
		buffer.steps.splice(0, buffer.steps.length - MAX_STEPS_PER_RUN);
	}

	return changed;
}

export function getRunSteps(runId: string): AgentStep[] {
	const buffer = buffers.get(runId);
	if (!buffer) {
		return [];
	}
	buffer.touchedAt = Date.now();

	return buffer.steps;
}

export function dropRunSteps(runIds: string[]) {
	for (const runId of runIds) {
		buffers.delete(runId);
	}
}
