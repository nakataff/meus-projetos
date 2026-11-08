/* O service worker só recebe e abre alertas. As páginas continuam usando o cache HTTP. */
const root = new URL(self.registration.scope);
function destination(link) {
 const url = new URL(String(link || 'jogos/'), root);
 return url.origin === root.origin && url.pathname.startsWith(root.pathname) ? url.href : root.href;
}
self.addEventListener('push', event => {
 event.waitUntil((async () => {
  const alert = event.data?.json();
  if (!alert?.id || typeof alert.title !== 'string') return;
  await self.registration.showNotification(alert.title, {
   body:alert.body, tag:'dlq-'+alert.id, data:{link:destination(alert.link)},
   icon:new URL('assets/dlq.webp',root).href
  });
  const clients = await self.clients.matchAll({type:'window'});
  for (const client of clients) client.postMessage({type:'quadra-alert',alert});
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=destination(event.notification.data?.link);
  const clients=await self.clients.matchAll({type:'window'});
  const existing=clients.find(client=>client.url===url);
  return existing ? existing.focus() : self.clients.openWindow(url);
 })());
});
