(() => {
  const UPDATE_PARAM = 'app_update';

  async function registerFreshWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const registration = await navigator.serviceWorker.register('sw.js', {
        scope: './',
        updateViaCache: 'none'
      });
      // Check quietly whenever the app opens.
      registration.update().catch(() => {});
      return registration;
    } catch (error) {
      console.warn('App update service unavailable:', error);
      return null;
    }
  }

  async function forceAppUpdate(button, status) {
    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = 'Updating…';
    }
    if (status) status.textContent = 'Getting the newest version…';

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(async registration => {
          try {
            await registration.update();
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
          } catch {}
        }));
      }

      try {
        await fetch('app.js?fresh=' + Date.now(), { cache: 'no-store' });
        await fetch('styles.css?fresh=' + Date.now(), { cache: 'no-store' });
      } catch {}

      if (status) status.textContent = 'Updated. Reloading…';

      const url = new URL(window.location.href);
      url.searchParams.set(UPDATE_PARAM, Date.now().toString());
      window.location.replace(url.toString());
    } catch (error) {
      console.error('Unable to update app:', error);
      if (status) status.textContent = 'Could not update. Check your connection and try again.';
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Update App';
      }
    }
  }

  function addAccountUpdateCard() {
    if (!/\/account\.html$/i.test(location.pathname) && !location.pathname.endsWith('/account')) return;

    const mount = document.querySelector('#accountContent');
    if (!mount || document.querySelector('#appUpdateCard')) return;

    const card = document.createElement('section');
    card.id = 'appUpdateCard';
    card.className = 'card light-card app-update-card';
    card.innerHTML = `
      <div class="app-update-icon" aria-hidden="true">↻</div>
      <div class="app-update-copy">
        <strong>App Updates</strong>
        <span id="appUpdateStatus">Your saved phone app can update without being reinstalled.</span>
      </div>
      <button type="button" id="appUpdateButton">Update App</button>
    `;

    mount.appendChild(card);

    card.querySelector('#appUpdateButton')?.addEventListener('click', () => {
      forceAppUpdate(
        card.querySelector('#appUpdateButton'),
        card.querySelector('#appUpdateStatus')
      );
    });
  }

  function injectStyles() {
    if (document.querySelector('#appUpdateStyles')) return;
    const style = document.createElement('style');
    style.id = 'appUpdateStyles';
    style.textContent = `
      .app-update-card{
        display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px 12px;
        align-items:center;margin-top:14px;margin-bottom:92px
      }
      .app-update-icon{
        width:42px;height:42px;border-radius:13px;display:grid;place-items:center;
        background:#eaf3ff;color:#176fce;font-size:25px;font-weight:900
      }
      .app-update-copy{min-width:0}
      .app-update-copy strong{display:block;color:#17314e;font-size:14px;margin-bottom:3px}
      .app-update-copy span{display:block;color:#6b7c8f;font-size:11px;line-height:1.4}
      #appUpdateButton{
        grid-column:1/-1;width:100%;min-height:44px;border:0;border-radius:12px;
        background:#1677e8;color:white;font:inherit;font-size:13px;font-weight:900;
        cursor:pointer
      }
      #appUpdateButton:disabled{opacity:.65;cursor:default}
    `;
    document.head.appendChild(style);
  }

  let reloadingForWorker = false;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForWorker) return;
      reloadingForWorker = true;
      window.location.reload();
    });
  }

  registerFreshWorker();

  const init = () => {
    injectStyles();
    addAccountUpdateCard();

    // account content is populated asynchronously, so retry briefly.
    if (!document.querySelector('#appUpdateCard') && document.querySelector('#accountContent')) {
      const observer = new MutationObserver(() => addAccountUpdateCard());
      observer.observe(document.querySelector('#accountContent'), { childList: true, subtree: false });
      window.setTimeout(() => observer.disconnect(), 12000);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
