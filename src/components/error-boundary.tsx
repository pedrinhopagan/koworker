import { Component, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	handleRetry = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<Card className="border-destructive/50 bg-destructive/5">
					<CardContent className="p-6 sm:p-8">
						<div className="flex flex-col items-center text-center gap-4">
							<div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
								<AlertCircle className="size-6 text-destructive" />
							</div>
							<div className="space-y-2">
								<h3 className="font-semibold text-lg">Something went wrong</h3>
								<p className="text-sm text-muted-foreground max-w-md">
									An error occurred while loading this content. Please try again.
								</p>
							</div>
							<Button variant="outline" onClick={this.handleRetry} className="gap-2">
								<RefreshCw className="size-4" />
								Try again
							</Button>
						</div>
					</CardContent>
				</Card>
			);
		}

		return this.props.children;
	}
}
