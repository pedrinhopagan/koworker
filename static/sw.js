const CACHE_VERSION = "__KOWORK_SW_CACHE_VERSION__";
const STATIC_CACHE = "kowork-static-" + CACHE_VERSION;
const SHELL_CACHE = "kowork-shell-" + CACHE_VERSION;

const STATIC_PREFIX = "/static/";
const NETWORK_FIRST_ASSETS = new Set(["/main.js", "/index.css"]);
const NEVER_CACHE_PREFIXES = ["/rpc", "/ws"];

self.addEventListener("install", function onInstall() {
	self.skipWaiting();
});

self.addEventListener("activate", function onActivate(event) {
	event.waitUntil(
		caches
			.keys()
			.then(function pruneOldCaches(cacheNames) {
				return Promise.all(
					cacheNames
						.filter(function isStale(name) {
							return (
								(name.startsWith("kowork-static-") || name.startsWith("kowork-shell-")) &&
								name !== STATIC_CACHE &&
								name !== SHELL_CACHE
							);
						})
						.map(function deleteCache(name) {
							return caches.delete(name);
						}),
				);
			})
			.then(function claimClients() {
				return self.clients.claim();
			}),
	);
});

self.addEventListener("fetch", function onFetch(event) {
	const request = event.request;

	if (request.method !== "GET") {
		return;
	}

	const url = new URL(request.url);

	if (url.origin !== self.location.origin) {
		return;
	}

	if (
		NEVER_CACHE_PREFIXES.some(function matches(prefix) {
			return url.pathname.startsWith(prefix);
		})
	) {
		return;
	}

	if (NETWORK_FIRST_ASSETS.has(url.pathname)) {
		event.respondWith(networkFirst(request));
		return;
	}

	if (url.pathname.startsWith(STATIC_PREFIX)) {
		event.respondWith(cacheFirst(request, STATIC_CACHE));
		return;
	}

	if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
		event.respondWith(navigationNetworkFirst(request));
	}
});

function networkFirst(request) {
	return fetch(request)
		.then(function useNetwork(response) {
			if (response.ok) {
				return response;
			}
			return caches.match(request).then(function fallback(cached) {
				return cached || response;
			});
		})
		.catch(function useCache() {
			return caches.match(request).then(function fallback(cached) {
				if (cached) {
					return cached;
				}
				throw new Error("Network error and no cache for " + request.url);
			});
		});
}

function cacheFirst(request, cacheName) {
	return caches.open(cacheName).then(function readCache(cache) {
		return cache.match(request).then(function useCached(cached) {
			if (cached) {
				return cached;
			}

			return fetch(request).then(function storeAndReturn(response) {
				if (response.ok) {
					cache.put(request, response.clone());
				}
				return response;
			});
		});
	});
}

function navigationNetworkFirst(request) {
	return fetch(request)
		.then(function useNetwork(response) {
			if (response.ok) {
				return caches.open(SHELL_CACHE).then(function storeShell(cache) {
					cache.put("/index.html", response.clone());
					return response;
				});
			}
			return fallbackToShell(request);
		})
		.catch(function useShell() {
			return fallbackToShell(request);
		});
}

function fallbackToShell(request) {
	return caches.match("/index.html").then(function useIndex(cached) {
		if (cached) {
			return cached;
		}
		return caches.match(request);
	});
}
