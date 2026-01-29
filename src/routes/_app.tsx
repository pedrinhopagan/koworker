import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { orpc } from "@/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    try {
      const user = await context.queryClient.fetchQuery(orpc.auth.me.queryOptions());
      return { user };
    } catch {
      throw redirect({ to: "/login" });
    }
  },

  component: AppLayout,
});

function AppLayout() {
  return <Outlet />;
}
