type Cached<T> = { value: T; expiresAt: number; path: string };

export type FolderCache<T> = {
	get(key: string, load: () => Promise<T>): Promise<T>;
	getResolved(key: string, load: () => Promise<{ value: T; path: string | null }>): Promise<T>;
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
			store.set(key, { value, expiresAt: Date.now() + ttlMs, path: key });
			return value;
		},
		async getResolved(key, load) {
			const hit = store.get(key);
			if (hit && hit.expiresAt > Date.now()) return hit.value;

			const loaded = await load();
			if (loaded.path !== null) {
				store.set(key, { value: loaded.value, expiresAt: Date.now() + ttlMs, path: loaded.path });
			}
			return loaded.value;
		},
		deletePrefix(prefix) {
			for (const [key, entry] of store) {
				if (entry.path === prefix || entry.path.startsWith(prefix)) store.delete(key);
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
