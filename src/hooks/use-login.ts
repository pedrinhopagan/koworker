import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/schemas";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/client";
import type { LoginInput } from "@/types/auth";
import { toast } from "sonner";

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
