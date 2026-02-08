export const SLOT_STEP_MINUTES = 30;

type TaskTimeLike = {
	id: string;
	scheduledTime?: string | null;
};

function minutesToTimeLabel(totalMinutes: number) {
	const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
	const minutes = String(totalMinutes % 60).padStart(2, "0");
	return `${hours}:${minutes}`;
}

export function buildTimeSlots(stepMinutes = SLOT_STEP_MINUTES) {
	const slots: string[] = [];

	for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
		slots.push(minutesToTimeLabel(minutes));
	}

	return slots;
}

export function getNextAvailableSlot(tasks: TaskTimeLike[], excludeTaskId?: string) {
	const slots = buildTimeSlots();
	const used = new Set(
		tasks.filter((task) => task.id !== excludeTaskId).map((task) => task.scheduledTime ?? "00:00"),
	);

	for (const slot of slots) {
		if (!used.has(slot)) {
			return slot;
		}
	}

	return slots.at(-1) ?? "23:30";
}
