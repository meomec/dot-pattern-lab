const PRECACHE_CACHE_NAME = "eames-precache";
const RUNTIME_CACHE_NAME = "eames-runtime";
const APP_SHELL_URL = "./eames.html";
const OFFLINE_FALLBACK_URL = "./offline.html";
const PRECACHE_URLS = [
  "./",
  "./eames.html",
  "./offline.html",
  "./eames.css",
  "./eames.js",
  "./favicon/site.webmanifest",
  "./favicon/docks_design_favicon_16.png",
  "./favicon/docks_design_favicon_32.png",
  "./favicon/docks_design_favicon_180.png",
  "./favicon/docks_design_favicon_192.png",
  "./favicon/docks_design_favicon_512.png",
  "./svg/eames_00.svg",
  "./svg/eames_01.svg",
  "./svg/eames_02.svg",
  "./svg/eames_03.svg",
  "./svg/eames_04.svg",
  "./svg/eames_05.svg",
  "./svg/eames_06.svg",
  "./mp3/Isan_Trois_Gymnopedies_No1_Lent_et_Douloureux_128k.mp3",
];
const PRECACHE_KEYS = new Set(
  PRECACHE_URLS.map((url) => new URL(url, self.location.href).toString()),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== PRECACHE_CACHE_NAME &&
                cacheName !== RUNTIME_CACHE_NAME,
            )
            .map((cacheName) => caches.delete(cacheName)),
        );
      })
      .then(() => prunePrecacheEntries())
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (request.headers.has("range")) {
    event.respondWith(handleRangeRequest(request));
    return;
  }

  event.respondWith(handleAssetRequest(request));
});

async function handleRangeRequest(request) {
  const cachedResponse = await caches.match(request.url);

  if (!cachedResponse) {
    try {
      return await fetch(request);
    } catch {
      return Response.error();
    }
  }

  const rangeHeader = request.headers.get("range");
  const buffer = await cachedResponse.arrayBuffer();
  const total = buffer.byteLength;

  const [, startStr, endStr] = /bytes=(\d*)-(\d*)/.exec(rangeHeader) || [];
  const start = startStr ? parseInt(startStr, 10) : 0;
  const end = endStr ? parseInt(endStr, 10) : total - 1;
  const slice = buffer.slice(start, end + 1);

  return new Response(slice, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": cachedResponse.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Length": String(slice.byteLength),
      "Accept-Ranges": "bytes",
    },
  });
}

async function handleNavigationRequest(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      runtimeCache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return (
      (await runtimeCache.match(request)) ||
      (await caches.match(OFFLINE_FALLBACK_URL)) ||
      (await caches.match(APP_SHELL_URL)) ||
      Response.error()
    );
  }
}

async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const runtimeCache = await caches.open(RUNTIME_CACHE_NAME);
  const networkResponse = await fetch(request);

  if (networkResponse && networkResponse.ok) {
    runtimeCache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

async function prunePrecacheEntries() {
  const cache = await caches.open(PRECACHE_CACHE_NAME);
  const requests = await cache.keys();

  await Promise.all(
    requests
      .filter((request) => !PRECACHE_KEYS.has(request.url))
      .map((request) => cache.delete(request)),
  );
}
