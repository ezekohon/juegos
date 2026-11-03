const panel = document.querySelector('#install-panel');
const button = document.querySelector('#install-app');
const help = document.querySelector('#install-help');
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
let installPrompt;
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) panel.hidden = false;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  if (!standalone) panel.hidden = false;
});
button.addEventListener('click', async () => {
  if (!installPrompt) { help.hidden = !help.hidden; return; }
  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  panel.hidden = true;
});
window.addEventListener('appinstalled', () => { panel.hidden = true; installPrompt = null; });
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => console.warn('No se pudo registrar la app', error));
  });
}
