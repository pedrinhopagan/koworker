import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import { orpc } from "@/client";
import { loginSchema } from "@/lib/schemas";
import type { LoginInput } from "@/types/auth";

export function useLogin() {
	const { mutateAsync } = useMutation(orpc.auth.login.mutationOptions());

	const methods = useForm({
		resolver: zodResolver(loginSchema),
	});

	const onSubmit: SubmitHandler<LoginInput> = async (data) => {
		try {
			await mutateAsync(data);

			window.location.href = "/";
		} catch {
			toast.error("Login failed", {
				description: "Invalid name or password",
				position: "bottom-left",
			});
		}
	};

	return {
		methods,
		onSubmit,
		FormProvider,
	};
}
