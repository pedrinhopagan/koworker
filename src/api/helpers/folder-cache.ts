type Cached<T> = { value: T; expiresAt: number };

export type FolderCache<T> = {
	get(key: string, load: () => Promise<T>): Promise<T>;
	deletePrefix(prefix: string): void;
};

const registry: FolderCache<unknown>[] = [];

export function createFolderCache<T>(ttlMs: number): FolderCache<T> {
	const store = new Map<string, Cached<T>>();

	const cache: FolderCache<T> = {
		async get(key, load) {
			const hit = store.get(key);
			if (hit && hit.expiresAt > Date.now()) return hit.value;

			const value = await load();
			store.set(key, { value, expiresAt: Date.now() + ttlMs });
			return value;
		},
		deletePrefix(prefix) {
			for (const key of store.keys()) {
				if (key === prefix || key.startsWith(prefix)) store.delete(key);
			}
		},
	};

	registry.push(cache as FolderCache<unknown>);
	return cache;
}

export function invalidateFolderPrefix(prefix: string): void {
	for (const cache of registry) {
		cache.deletePrefix(prefix);
	}
}
