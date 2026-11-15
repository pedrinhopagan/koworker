import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConversationRequest } from "@/lib/conversation";
import { cn } from "@/lib/utils";

const decisionLabels = {
	accept: "Permitir",
	acceptForSession: "Permitir nesta sessão",
	decline: "Recusar",
	cancel: "Cancelar execução",
};

export function ConversationRequestCard({
	conversationId,
	request,
}: {
	conversationId: string;
	request: ConversationRequest;
}) {
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const queryClient = useQueryClient();
	const {
		mutate: respond,
		isPending,
		error,
	} = useMutation(
		orpc.conversations.respond.mutationOptions({
			onSuccess: () => {
				void queryClient.invalidateQueries(
					orpc.conversations.get.queryOptions({ input: { id: conversationId } }),
				);
			},
		}),
	);
	const permissions = request.method === "item/permissions/requestApproval";
	const decisions = permissions ? (["accept", "decline"] as const) : (request.decisions ?? []);

	return (
		<section className="border border-border bg-card p-4 sm:p-5" aria-label="Pedido do Codex">
			<Title as="h2" size="sm" className="flex items-center gap-2">
				<ShieldCheck className="size-4" />
				{request.questions && "O Codex precisa da sua resposta"}
				{!request.questions && "O Codex precisa da sua permissão"}
			</Title>
			{request.reason && (
				<Text size="sm" tone="muted" className="mt-2">
					{request.reason}
				</Text>
			)}
			{request.command && (
				<pre className="mt-3 max-h-48 overflow-auto bg-muted p-3 text-xs whitespace-pre-wrap break-all">
					{request.command}
				</pre>
			)}
			{request.details && (
				<pre className="mt-3 max-h-48 overflow-auto bg-muted p-3 text-xs whitespace-pre-wrap break-all">
					{request.details}
				</pre>
			)}
			{request.questions?.map((question) => (
				<fieldset key={question.id} disabled={isPending} className="mt-4 min-w-0">
					<legend className="text-sm font-medium">{question.question}</legend>
					<div className="mt-2 grid gap-2">
						{question.options?.map((option) => (
							<button
								key={option.label}
								type="button"
								onClick={() =>
									setAnswers((current) => ({ ...current, [question.id]: option.label }))
								}
								aria-pressed={answers[question.id] === option.label}
								className={cn(
									"min-h-11 border border-border px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
									answers[question.id] === option.label && "border-primary bg-primary/10",
								)}
							>
								<Text size="sm">{option.label}</Text>
								<Text size="xs" tone="muted">
									{option.description}
								</Text>
							</button>
						))}
					</div>
					<label
						htmlFor={`answer-${request.id}-${question.id}`}
						className="mt-3 mb-1 block text-xs text-muted-foreground"
					>
						Sua resposta
					</label>
					<Input
						id={`answer-${request.id}-${question.id}`}
						type={question.isSecret ? "password" : "text"}
						value={answers[question.id] ?? ""}
						onChange={(event) =>
							setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
						}
						className="h-11"
					/>
				</fieldset>
			))}
			<div className="mt-4 flex flex-wrap gap-2">
				{request.questions && (
					<Button
						className="h-11"
						disabled={
							isPending || request.questions.some((question) => !answers[question.id]?.trim())
						}
						onClick={() =>
							respond({
								id: conversationId,
								runtimeId: request.runtimeId,
								requestId: request.id,
								answers: Object.fromEntries(
									Object.entries(answers).map(([id, answer]) => [id, [answer.trim()]]),
								),
							})
						}
					>
						{isPending && <Loader2 className="size-4 animate-spin" />}Enviar respostas
					</Button>
				)}
				{!request.questions &&
					decisions.map((decision) => (
						<Button
							key={decision}
							variant={decision === "accept" ? "default" : "outline"}
							className="h-11"
							disabled={isPending}
							onClick={() =>
								respond({
									id: conversationId,
									runtimeId: request.runtimeId,
									requestId: request.id,
									decision,
								})
							}
						>
							{decisionLabels[decision]}
						</Button>
					))}
			</div>
			{error && (
				<Text size="sm" tone="destructive" role="alert" className="mt-2">
					{error.message}
				</Text>
			)}
		</section>
	);
}
