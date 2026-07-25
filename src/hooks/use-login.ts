import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import { orpc, reconnectRealtime } from "@/client";
import { loginSchema } from "@/lib/schemas";
import type { LoginInput } from "@/types/auth";

export function useLogin() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { mutateAsync } = useMutation(orpc.auth.login.mutationOptions());

	const methods = useForm({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			name: "",
			password: "",
		},
	});

	const onSubmit: SubmitHandler<LoginInput> = async (data) => {
		try {
			await mutateAsync(data);
		} catch {
			toast.error("Não foi possível entrar", {
				description: "Nome ou senha inválidos",
				position: "bottom-left",
			});

			return;
		}

		queryClient.clear();
		reconnectRealtime();

		await navigate({ to: "/" });
	};

	return {
		methods,
		onSubmit,
		FormProvider,
	};
}
