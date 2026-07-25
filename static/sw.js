const CACHE_VERSION = "__KOWORK_SW_CACHE_VERSION__";
const STATIC_CACHE = "kowork-static-" + CACHE_VERSION;
const SHELL_CACHE = "kowork-shell-" + CACHE_VERSION;

const STATIC_PREFIX = "/static/";
const PRECACHE_ASSETS = ["/index.html", "/main.js", "/index.css"];
const APP_ASSETS = new Set(["/main.js", "/index.css"]);
const NEVER_CACHE_PREFIXES = ["/rpc", "/ws"];

self.addEventListener("install", function onInstall(event) {
	event.waitUntil(
		caches
			.open(STATIC_CACHE)
			.then(function precache(cache) {
				return Promise.all(
					PRECACHE_ASSETS.map(function precacheOne(asset) {
						return fetch(asset, { cache: "reload" })
							.then(function storeAsset(response) {
								if (!response.ok) {
									return;
								}
								if (asset === "/index.html") {
									return caches.open(SHELL_CACHE).then(function storeShell(shell) {
										return shell.put("/index.html", response);
									});
								}
								return cache.put(asset, response);
							})
							.catch(function ignorePrecacheFailure() {});
					}),
				);
			})
			.then(function activateNow() {
				return self.skipWaiting();
			}),
	);
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

	if (APP_ASSETS.has(url.pathname) || isBuildChunk(url.pathname)) {
		event.respondWith(staleWhileRevalidate(request, event));
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

self.addEventListener("push", function onPush(event) {
	let payload = {};
	try {
		payload = event.data ? event.data.json() : {};
	} catch {
		payload = { body: event.data?.text() || "Uma execução do Kowork foi atualizada." };
	}

	const title = typeof payload.title === "string" ? payload.title : "Kowork";
	const body =
		typeof payload.body === "string" ? payload.body : "Uma execução do Kowork foi atualizada.";
	const url = typeof payload.url === "string" ? payload.url : "/";
	const tag = typeof payload.tag === "string" ? payload.tag : "kowork-execution";

	event.waitUntil(
		self.registration.showNotification(title, {
			body,
			tag,
			icon: "/static/icons/pwa-192.png",
			badge: "/static/icons/pwa-192.png",
			data: { url },
		}),
	);
});

self.addEventListener("notificationclick", function onNotificationClick(event) {
	event.notification.close();
	const target = new URL(event.notification.data?.url || "/", self.location.origin);
	if (target.origin !== self.location.origin) {
		target.pathname = "/";
		target.search = "";
		target.hash = "";
	}

	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then(function openClient(items) {
				const existing = items.find(function sameOrigin(client) {
					return new URL(client.url).origin === self.location.origin;
				});
				if (existing) {
					return existing.navigate(target.href).then(function focusClient() {
						return existing.focus();
					});
				}
				return self.clients.openWindow(target.href);
			}),
	);
});

function isBuildChunk(pathname) {
	return pathname.endsWith(".js") && !pathname.includes("/", 1);
}

function staleWhileRevalidate(request, event) {
	return caches.open(STATIC_CACHE).then(function readCache(cache) {
		return cache.match(request).then(function decide(cached) {
			const network = fetch(request)
				.then(function storeAndReturn(response) {
					if (response.ok) {
						return cache.put(request, response.clone()).then(function done() {
							return response;
						});
					}
					return response;
				})
				.catch(function useCacheOnly(error) {
					if (cached) {
						return cached;
					}
					throw error;
				});

			if (cached) {
				event.waitUntil(network);
				return cached;
			}

			return network;
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
