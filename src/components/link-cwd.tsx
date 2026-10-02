import { createContext, type ReactNode, useContext } from "react";

const LinkCwdContext = createContext<string | undefined>(undefined);

export function LinkCwdProvider({ cwd, children }: { cwd?: string; children: ReactNode }) {
	return <LinkCwdContext.Provider value={cwd}>{children}</LinkCwdContext.Provider>;
}

export function useLinkCwd() {
	return useContext(LinkCwdContext);
}
