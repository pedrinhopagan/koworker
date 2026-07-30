import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Sem uma origem real o documento nasce em `about:blank`, e qualquer módulo que monte uma URL a
// partir de `window.location.origin` (o cliente ORPC, por exemplo) quebra ao ser importado.
GlobalRegistrator.register({ url: "http://localhost:2841/" });
