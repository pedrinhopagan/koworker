import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { LogOut, Bell, Send } from "lucide-react";

import { orpc, orpcWs } from "@/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogout } from "@/hooks/use-logout";

export const Route = createFileRoute("/_app/")({
	component: HomePage,
});

function HomePage() {
	const { data: user } = useSuspenseQuery(orpc.auth.me.queryOptions());
	const { logout } = useLogout();

	const [enabled, setEnabled] = useState(false);

	const { data: events, isFetching } = useQuery(
		orpcWs.notifications.experimental_streamedOptions({
			enabled,
			retry: false,
		}),
	);

	const isListening = isFetching && enabled;

	async function sendTestNotification() {
		await orpc.testNotification.call({});
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-2xl font-bold">Hello, {user?.name}</CardTitle>
				</CardHeader>

				<CardContent className="space-y-4">
					<p className="text-muted-foreground">You are logged in.</p>

					<div className="rounded-lg border p-4">
						<div className="mb-3 flex items-center justify-between">
							<span className="text-sm font-medium">Notifications (WebSocket)</span>
							{isListening && (
								<span className="text-xs text-green-500 animate-pulse">Connected...</span>
							)}
						</div>

						<div className="flex gap-2 mb-3">
							<Button
								variant="secondary"
								onClick={() => setEnabled(true)}
								disabled={isListening}
								className="flex-1"
							>
								<Bell className="mr-2 size-4" />
								{isListening ? "Listening..." : "Connect"}
							</Button>

							<Button variant="outline" onClick={sendTestNotification} disabled={!isListening}>
								<Send className="size-4" />
							</Button>
						</div>

						{events && events.length > 0 && (
							<div className="space-y-2 text-sm">
								{events.map((e, i) => (
									<div key={i} className="rounded bg-muted p-2">
										<div className="font-medium">{e.title}</div>
										<div className="text-muted-foreground">{e.message}</div>
									</div>
								))}
							</div>
						)}
					</div>

					<Button variant="outline" onClick={logout} className="w-full">
						<LogOut className="mr-2 size-4" />
						Sign out
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
