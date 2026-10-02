import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyTerminalRedirect } from "../-utils/legacy-terminal-redirect";

export const Route = createFileRoute("/_app/terminals/$paneId/")({
	beforeLoad: ({ params }) => {
		throw redirect(legacyTerminalRedirect(params.paneId));
	},
});
