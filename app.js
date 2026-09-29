const q = (s, root=document) => root.querySelector(s);
const qa = (s, root=document) => [...root.querySelectorAll(s)];

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  qa('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy') || '';
      try { await navigator.clipboard.writeText(value); }
      catch { /* no-op in local preview */ }
      const old = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check"></i>';
      if (window.lucide) lucide.createIcons();
      setTimeout(() => { btn.innerHTML = old; if (window.lucide) lucide.createIcons(); }, 1200);
    });
  });

  qa('[data-demo-call]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.innerHTML = '<i data-lucide="phone-call"></i> Calling…';
      if (window.lucide) lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="phone"></i> Call';
        if (window.lucide) lucide.createIcons();
      }, 1600);
    });
  });
});
