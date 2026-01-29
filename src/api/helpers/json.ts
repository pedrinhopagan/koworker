export const jsonStringify = (value: unknown) =>
	value === undefined ? undefined : JSON.stringify(value);

export const jsonParse = <T>(value: string | null | undefined) => {
	if (!value) return null;

	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
};
