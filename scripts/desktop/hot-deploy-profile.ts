export function resolveHotDeployProfile(remoteRedeploy: string | undefined) {
	const isRemoteRedeploy = remoteRedeploy === "1";

	return {
		buildGui: !isRemoteRedeploy,
		requireSystemd: isRemoteRedeploy,
	};
}
