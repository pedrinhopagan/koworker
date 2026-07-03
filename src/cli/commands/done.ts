import { setTaskDone } from "./task";

export async function runDone(args: string[]): Promise<void> {
	await setTaskDone(args[0], true);
}
