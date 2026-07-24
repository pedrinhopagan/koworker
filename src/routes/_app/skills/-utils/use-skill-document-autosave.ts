import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type SkillDocumentSnapshot = {
	variantPath: string;
	description: string;
	metadata: Record<string, unknown>;
	content: string;
};

export type SkillDocumentSaveStatus = "idle" | "saving" | "saved" | "error";

type SaveResult = {
	skillHash: string;
};

type SkillDocumentAutosaveOptions = {
	initialDocument: SkillDocumentSnapshot;
	initialSkillHash: string;
	save: (document: SkillDocumentSnapshot & { expectedSkillHash: string }) => Promise<SaveResult>;
	debounceMs?: number;
};

export function useSkillDocumentAutosave({
	initialDocument,
	initialSkillHash,
	save,
	debounceMs = 500,
}: SkillDocumentAutosaveOptions) {
	const [document, setDocument] = useState(initialDocument);
	const [status, setStatus] = useState<SkillDocumentSaveStatus>("idle");
	const [pending, setPending] = useState(false);
	const documentRef = useRef(initialDocument);
	const skillHashRef = useRef(initialSkillHash);
	const pendingRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inFlightRef = useRef<Promise<void> | null>(null);
	const saveRef = useRef(save);
	const generationRef = useRef(0);

	useEffect(() => {
		saveRef.current = save;
	}, [save]);

	useEffect(() => {
		if (documentRef.current.variantPath === initialDocument.variantPath) {
			return;
		}
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		generationRef.current += 1;
		documentRef.current = initialDocument;
		skillHashRef.current = initialSkillHash;
		pendingRef.current = false;
		setPending(false);
		setDocument(initialDocument);
		setStatus("idle");
	}, [initialDocument, initialSkillHash]);

	const drain = useCallback(async () => {
		if (inFlightRef.current) {
			await inFlightRef.current;
			if (!pendingRef.current) {
				return;
			}
		}

		const operation = (async () => {
			const generation = generationRef.current;
			while (pendingRef.current) {
				pendingRef.current = false;
				setStatus("saving");

				try {
					const result = await saveRef.current({
						...documentRef.current,
						expectedSkillHash: skillHashRef.current,
					});
					if (generation !== generationRef.current) {
						return;
					}
					skillHashRef.current = result.skillHash;
				} catch (error) {
					if (generation !== generationRef.current) {
						return;
					}
					pendingRef.current = true;
					setPending(true);
					setStatus("error");
					throw error;
				}
			}

			if (generation === generationRef.current) {
				setPending(false);
				setStatus("saved");
			}
		})();

		inFlightRef.current = operation;

		try {
			await operation;
		} finally {
			if (inFlightRef.current === operation) {
				inFlightRef.current = null;
			}
		}
	}, []);

	useEffect(
		() => () => {
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			void drain().catch((error) => {
				toast.error(error instanceof Error ? error.message : "Não foi possível salvar a skill");
			});
		},
		[drain],
	);

	const schedule = useCallback(
		(patch: Partial<Omit<SkillDocumentSnapshot, "variantPath">>, immediate = false) => {
			documentRef.current = { ...documentRef.current, ...patch };
			setDocument(documentRef.current);
			pendingRef.current = true;
			setPending(true);
			setStatus("saving");

			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
			}

			if (immediate) {
				void drain().catch(() => {});
				return;
			}

			const timer = setTimeout(() => {
				if (timerRef.current !== timer) {
					return;
				}
				timerRef.current = null;
				void drain().catch(() => {});
			}, debounceMs);
			timerRef.current = timer;
		},
		[debounceMs, drain],
	);

	const flush = useCallback(async () => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}

		await drain();
	}, [drain]);

	return { document, status, pending, schedule, flush };
}
