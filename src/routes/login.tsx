import { createFileRoute } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogin } from "@/hooks/use-login";
import type { LoginInput } from "@/types/auth";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<Card className="w-full max-w-sm">
				<LoginCardHeader />

				<LoginCardContent>
					<LoginCardName />
					<LoginCardPassword />
					<LoginCardFooter />
				</LoginCardContent>
			</Card>
		</div>
	);
}

function LoginCardHeader() {
	return (
		<CardHeader>
			<CardTitle className="text-2xl font-bold">Koworker</CardTitle>
			<CardDescription>Enter your credentials to access</CardDescription>
		</CardHeader>
	);
}

function LoginCardContent({ children }: { children: React.ReactNode }) {
	const { methods, onSubmit, FormProvider } = useLogin();

	return (
		<CardContent>
			<FormProvider {...methods}>
				<form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
					{children}
				</form>
			</FormProvider>
		</CardContent>
	);
}

function LoginCardName() {
	const {
		register,
		formState: { errors },
	} = useFormContext<LoginInput>();

	const nameError = errors.name?.message;

	return (
		<div className="space-y-2">
			<Label htmlFor="name">Name</Label>

			<Input
				id="name"
				type="text"
				placeholder="Your name"
				className="bg-background border border-border"
				aria-invalid={!!nameError}
				{...register("name")}
				required
			/>

			{nameError && <p className="text-sm text-red-500">{nameError}</p>}
		</div>
	);
}

function LoginCardPassword() {
	const {
		register,
		formState: { errors },
	} = useFormContext<LoginInput>();
	const passwordError = errors.password?.message;

	return (
		<div className="space-y-2">
			<Label htmlFor="password">Password</Label>

			<Input
				id="password"
				type="password"
				placeholder="Your password"
				className="bg-background border border-border"
				aria-invalid={!!passwordError}
				{...register("password")}
				required
			/>

			{passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
		</div>
	);
}

function LoginCardFooter() {
	const {
		formState: { isSubmitting },
	} = useFormContext<LoginInput>();

	return (
		<Button type="submit" className="w-full" disabled={isSubmitting}>
			<LogIn className="mr-2 size-4" />
			{isSubmitting ? "Signing in..." : "Sign in"}
		</Button>
	);
}
