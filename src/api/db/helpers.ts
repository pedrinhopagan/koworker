export const cleanUpdate = <T extends Record<string, unknown>>(values: T) =>
	Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>;
