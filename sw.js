const TARGET = "https://mon-panier-pwa.pages.dev/";



self.addEventListener("install", () => self.skipWaiting());



self.addEventListener("activate", event => {
  
  event.waitUntil(self.clients.claim());
  
});



self.addEventListener("fetch", event => {
  
  if (event.request.mode === "navigate") {
    
    event.respondWith(Response.redirect(TARGET, 302));
    
  }
  
});







