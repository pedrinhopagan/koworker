import { createFileRoute } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
			<Title size="md">Koworker</Title>
			<Text size="sm" tone="muted">
				Entre com suas credenciais para acessar
			</Text>
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
			<Label htmlFor="name">Nome</Label>

			<Input
				id="name"
				type="text"
				placeholder="Seu nome"
				className="bg-background border border-border"
				aria-invalid={!!nameError}
				{...register("name")}
				required
			/>

			{nameError && (
				<Text size="sm" tone="destructive">
					{nameError}
				</Text>
			)}
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
			<Label htmlFor="password">Senha</Label>

			<Input
				id="password"
				type="password"
				placeholder="Sua senha"
				className="bg-background border border-border"
				aria-invalid={!!passwordError}
				{...register("password")}
				required
			/>

			{passwordError && (
				<Text size="sm" tone="destructive">
					{passwordError}
				</Text>
			)}
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
			{isSubmitting ? "Entrando..." : "Entrar"}
		</Button>
	);
}
