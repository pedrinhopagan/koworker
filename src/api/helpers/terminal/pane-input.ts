// O `pane.send_input` do kw-terminal digita texto e só texto: todo byte de controle é descartado no
// caminho, então backspace, enter, seta e ctrl+c não chegavam ao agent — era por isso que não dava
// nem para apagar o que estava escrito no input. Teclas viajam por um vocabulário nomeado
// (`backspace`, `enter`, `up`, `ctrl+c`, `alt+b`, `shift+tab`), e texto e tecla no mesmo pacote
// saem fora de ordem no daemon. Traduzimos o fluxo cru do xterm numa fila de operações na ordem
// exata em que o usuário digitou.

export type PaneInputOp = { text: string } | { keys: string[] };

const CONTROL_KEYS: Record<string, string> = {
	"\r": "enter",
	"\n": "enter",
	"\t": "tab",
	"\u007F": "backspace",
	"\b": "backspace",
};

// CSI/SS3 que o daemon conhece. Delete, Home, End e PageUp não existem no vocabulário dele e são
// descartados — mandar como texto imprimiria lixo no input do agent.
// ponytail: mapa curto; crescer quando o kw-terminal aceitar mais teclas nomeadas.
const SEQUENCE_KEYS: Record<string, string> = {
	"[A": "up",
	"[B": "down",
	"[C": "right",
	"[D": "left",
	OA: "up",
	OB: "down",
	OC: "right",
	OD: "left",
	"[Z": "shift+tab",
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

function controlKey(char: string): string | null {
	const known = CONTROL_KEYS[char];
	if (known) {
		return known;
	}

	const code = char.codePointAt(0) ?? 0;

	return code >= 1 && code <= 26 ? `ctrl+${ALPHABET[code - 1]}` : null;
}

// Uma sequência de escape termina no primeiro byte final (letra ou `~`); o miolo é parâmetro.
function readSequence(data: string, start: number): { body: string; next: number } | null {
	const intro = data[start];
	if (intro !== "[" && intro !== "O") {
		return null;
	}

	for (let index = start + 1; index < data.length; index++) {
		if (/[A-Za-z~]/.test(data[index])) {
			return { body: data.slice(start, index + 1), next: index + 1 };
		}
	}

	return null;
}

export function translatePaneInput(data: string): PaneInputOp[] {
	const ops: PaneInputOp[] = [];
	let text = "";

	function flushText() {
		if (text) {
			ops.push({ text });
			text = "";
		}
	}

	function pushKey(key: string) {
		flushText();
		const last = ops.at(-1);
		if (last && "keys" in last) {
			last.keys.push(key);

			return;
		}
		ops.push({ keys: [key] });
	}

	let index = 0;
	while (index < data.length) {
		const char = data[index];

		if (char === "\u001B") {
			const sequence = readSequence(data, index + 1);
			if (sequence) {
				const key = SEQUENCE_KEYS[sequence.body];
				if (key) {
					pushKey(key);
				}
				index = sequence.next;
				continue;
			}

			// `ESC` seguido de caractere imprimível é a codificação de alt+tecla; sozinho é o próprio esc.
			const next = data[index + 1];
			if (next && next >= " " && next !== "\u007F") {
				pushKey(`alt+${next}`);
				index += 2;
				continue;
			}

			pushKey("esc");
			index += 1;
			continue;
		}

		if (char < " " || char === "\u007F") {
			const key = controlKey(char);
			if (key) {
				pushKey(key);
			}
			index += 1;
			continue;
		}

		text += char;
		index += 1;
	}

	flushText();

	return ops;
}
