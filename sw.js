'use strict';

const CACHE = 'coordextract-v1';
const SHARE_CACHE = 'shared-files-v1';

// Install & activate
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Intercept share target POST
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/Claude/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (file) {
      const buf = await file.arrayBuffer();
      const cache = await caches.open(SHARE_CACHE);
      await cache.put('/Claude/__shared__', new Response(buf, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Filename': encodeURIComponent(file.name || 'arquivo')
        }
      }));
      // Notify open windows
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) c.postMessage({ type: 'SHARED_FILE' });
    }
  } catch (err) {
    console.error('share-target error', err);
  }
  return Response.redirect('/Claude/?from-share=1', 303);
}

// Message: client asking for the stored file
self.addEventListener('message', async event => {
  if (event.data === 'GET_SHARED_FILE') {
    const cache = await caches.open(SHARE_CACHE);
    const resp  = await cache.match('/Claude/__shared__');
    if (!resp) { event.source.postMessage({ type: 'NO_FILE' }); return; }
    const buf      = await resp.arrayBuffer();
    const mime     = resp.headers.get('Content-Type');
    const filename = decodeURIComponent(resp.headers.get('X-Filename') || 'arquivo');
    await cache.delete('/Claude/__shared__');
    event.source.postMessage({ type: 'FILE_DATA', buf, mime, filename }, [buf]);
  }
});
