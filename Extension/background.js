// Background (service worker) de "Ekuatia Login".
//
// Atiende el pedido de la app web ("Control Clientes") vía mensajería externa
// (chrome.runtime.onMessageExternal). La app manda SOLO { user, pass } por un
// canal en memoria; acá se abre el login de Marangatu y se inyecta una sola
// vez. Las credenciales nunca tocan la URL, el historial ni el portapapeles,
// y sólo los orígenes declarados en "externally_connectable" pueden hablar
// con esta extensión.
const LOGIN_URL = 'https://marangatu.set.gov.py/eset/login';

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== 'APP_AUTO_LOGIN') return false;

  const user = String(msg.user || '').trim();
  const pass = String(msg.pass || '');
  if (!user) {
    sendResponse({ ok: false, error: 'sin usuario' });
    return true;
  }

  chrome.tabs.create({ url: LOGIN_URL }, (tab) => {
    const tabId = tab.id;

    const inject = (attempts) => {
      chrome.scripting.executeScript(
        { target: { tabId }, func: inyectarLogin, args: [user, pass] },
        () => {
          // Si la página todavía no está lista, reintenta unas veces.
          if (chrome.runtime.lastError && attempts > 0) {
            setTimeout(() => inject(attempts - 1), 400);
          }
        }
      );
    };

    const onUpdated = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        setTimeout(() => inject(3), 300);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  });

  sendResponse({ ok: true });
  return true;
});

// Se inyecta en la página de login (función serializada por executeScript).
function inyectarLogin(user, pass) {
  const u = document.querySelector(
    "input[type='text'], input[type='email'], input[name*='user'], input[id*='user']"
  );
  const p = document.querySelector(
    "input[type='password'], input[name*='pass'], input[id*='pass']"
  );
  if (!u || !p) return;

  u.value = user;
  u.dispatchEvent(new Event('input', { bubbles: true }));
  p.value = pass;
  p.dispatchEvent(new Event('input', { bubbles: true }));

  setTimeout(() => {
    const btn = document.querySelector("button[type='submit'], input[type='submit']");
    if (btn) btn.click();
  }, 800);
}
