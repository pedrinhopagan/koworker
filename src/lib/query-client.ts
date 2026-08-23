import { QueryClient } from "@tanstack/react-query";

// staleTime alto porque o app é um toggle quake-style: cada exibição da janela dispara um "window
// focus" e, com staleTime 0, TODAS as queries montadas refazem fetch de uma vez — a rajada que
// travava a abertura. A atualização em tempo real não depende disso: o canal WS de tasks/vault
// invalida na hora, e as mutations invalidam o que tocam.
export const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 60_000 } },
});
