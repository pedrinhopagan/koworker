import { PubSub } from "@/api/pubsub";

let revision = 0;

export function getTerminalWorkspaceRevision() {
	return revision;
}

export function publishTerminalWorkspaceChange(source: "shell" | "agent") {
	revision += 1;

	return PubSub.publish("terminalWorkspace", "global", { revision, source });
}
