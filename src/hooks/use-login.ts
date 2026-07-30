import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import { orpc, reconnectRealtime } from "@/client";
import { errorMessage } from "@/lib/orpc-errors";
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
			const session = await mutateAsync(data);

			if (session.device.status !== "approved") {
				queryClient.clear();
				await navigate({ to: "/dispositivo" });

				return;
			}
		} catch (error) {
			toast.error("Não foi possível entrar", {
				description: errorMessage(error, "Nome ou senha inválidos"),
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
