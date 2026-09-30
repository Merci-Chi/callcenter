const q = (s, root = document) => root.querySelector(s);
const qa = (s, root = document) => [...root.querySelectorAll(s)];

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

function showToast(message) {
  let toast = q('.app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function modal(title, body, actions = [{ label: 'Done', primary: true }]) {
  q('.app-modal-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'app-modal-overlay';
  overlay.innerHTML = `
    <div class="app-modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="app-modal-head">
        <h3>${title}</h3>
        <button class="app-modal-close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="app-modal-body">${body}</div>
      <div class="app-modal-actions"></div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  q('.app-modal-close', overlay).addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const row = q('.app-modal-actions', overlay);
  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = `modal-action${action.primary ? ' primary' : ''}${action.danger ? ' danger' : ''}`;
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      if (action.onClick) action.onClick(close, overlay);
      else close();
    });
    row.appendChild(btn);
  });
  refreshIcons();
  return overlay;
}

function cycleButton(btn, values) {
  const current = btn.dataset.value || values[0];
  const next = values[(values.indexOf(current) + 1) % values.length];
  btn.dataset.value = next;
  btn.textContent = `${next}⌄`;
  showToast(`Showing ${next.toLowerCase()}`);
}

function setupCopyButtons() {
  qa('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy') || '';
      try { await navigator.clipboard.writeText(value); } catch {}
      const old = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check"></i>';
      refreshIcons();
      showToast('Copied');
      setTimeout(() => { btn.innerHTML = old; refreshIcons(); }, 1000);
    });
  });
}

function setupOutreach() {
  const leadCards = qa('.lead-card');
  if (!leadCards.length) return;
  let selected = 0;

  const selectCard = index => {
    if (!leadCards.length) return;
    selected = (index + leadCards.length) % leadCards.length;
    leadCards.forEach((card, i) => card.classList.toggle('selected-lead', i === selected));
    leadCards[selected].scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  qa('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      qa('.pill').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const label = btn.textContent.trim();
      leadCards.forEach(c => c.style.display = '');
      if (label === 'Due for Follow Up') {
        leadCards.forEach((c, i) => c.style.display = i === 0 ? '' : 'none');
      } else if (label === 'High Priority') {
        leadCards.forEach((c, i) => c.style.display = i === 1 ? '' : 'none');
      }
      showToast(label);
    });
  });

  qa('.quick-btn').forEach(btn => {
    const label = btn.textContent.trim().toLowerCase();
    if (label.includes('random')) btn.addEventListener('click', () => selectCard(Math.floor(Math.random() * leadCards.length)));
    if (label.includes('next')) btn.addEventListener('click', () => selectCard(selected + 1));
    if (label.includes('follow')) btn.addEventListener('click', () => {
      const card = leadCards[selected];
      const name = q('.lead-title strong', card)?.textContent || 'this lead';
      modal('Schedule Follow Up', `
        <p class="modal-help">Set a reminder for <strong>${name}</strong>.</p>
        <label class="modal-label">Date<input class="modal-input" id="follow-date" type="date"></label>
        <label class="modal-label">Time<input class="modal-input" id="follow-time" type="time"></label>`, [
          { label: 'Cancel' },
          { label: 'Save Follow Up', primary: true, onClick: (close, root) => {
            const d = q('#follow-date', root).value;
            const t = q('#follow-time', root).value;
            localStorage.setItem('demo-followup', JSON.stringify({ name, d, t }));
            close(); showToast('Follow up saved');
          }}
        ]);
    });
  });

  qa('[data-demo-call]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.lead-card');
      const name = q('.lead-title strong', card)?.textContent || 'lead';
      const number = q('.contact-line span', card)?.textContent?.trim() || '';
      modal('Start Call', `<p class="modal-help">Call <strong>${name}</strong><br>${number}</p><p class="modal-note">On a phone, this opens the device dialer. Your browser calling provider can be connected here later.</p>`, [
        { label: 'Cancel' },
        { label: 'Call', primary: true, onClick: close => {
          close();
          btn.innerHTML = '<i data-lucide="phone-call"></i> Calling…';
          refreshIcons();
          setTimeout(() => { btn.innerHTML = '<i data-lucide="phone"></i> Call'; refreshIcons(); }, 2000);
          const digits = number.replace(/[^0-9+]/g, '');
          if (digits) window.location.href = `tel:${digits}`;
        }}
      ]);
    });
  });

  qa('.star').forEach(star => {
    star.setAttribute('role', 'button');
    star.setAttribute('tabindex', '0');
    const toggle = () => {
      star.classList.toggle('favorite');
      showToast(star.classList.contains('favorite') ? 'Added to priority' : 'Removed from priority');
    };
    star.addEventListener('click', toggle);
    star.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggle(); });
  });
}

function setupSkills() {
  const tabs = qa('.tabs a');
  if (!tabs.length) return;
  const main = q('main.content');
  const original = main.innerHTML;
  const practice = `
    <section class="card light-card skill-placeholder">
      <div class="skill-big-icon"><i data-lucide="messages-square"></i></div>
      <h3>Practice Objections</h3>
      <p>Choose a situation and practice your response.</p>
      <button class="practice-btn" data-practice="I already have a website">I already have a website</button>
      <button class="practice-btn" data-practice="I'm not interested">I'm not interested</button>
      <button class="practice-btn" data-practice="How much does it cost?">How much does it cost?</button>
    </section>`;
  const library = `
    <section class="card light-card skill-placeholder">
      <div class="skill-big-icon"><i data-lucide="book-open"></i></div>
      <h3>Call Library</h3>
      <p>Review your saved transcripts and examples.</p>
      <button class="practice-btn" data-transcript>BrightPath Marketing · 4:32</button>
      <button class="practice-btn" data-transcript>Summit Construction · 3:18</button>
    </section>`;

  const wireDynamic = () => {
    qa('[data-practice]').forEach(btn => btn.addEventListener('click', () => {
      modal('Practice Prompt', `<p class="modal-help"><strong>Customer:</strong> “${btn.dataset.practice}”</p><textarea class="modal-textarea" placeholder="Type how you would respond..."></textarea>`, [
        { label: 'Close' }, { label: 'Save Practice', primary: true, onClick: close => { close(); showToast('Practice saved'); } }
      ]);
    }));
    qa('[data-transcript]').forEach(btn => btn.addEventListener('click', showTranscript));
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      tabs.forEach(x => x.classList.remove('active'));
      tab.classList.add('active');
      main.innerHTML = i === 0 ? original : i === 1 ? practice : library;
      refreshIcons();
      setupSkillSelectors();
      wireDynamic();
    });
  });

  function showTranscript(e) {
    e?.preventDefault?.();
    modal('Full Transcript', `<div class="full-transcript"><p><strong>You · 0:08</strong><br>Hi Sarah, this is Alex from BrightPath. Do you have a minute to chat about your website?</p><p><strong>Sarah · 0:24</strong><br>Yeah, of course. We’re actually looking at a few options right now.</p><p><strong>You · 0:37</strong><br>Great. I wanted to show you a preview and ask a couple quick questions about what you need.</p></div>`);
  }
  qa('.transcript-head a').forEach(a => a.addEventListener('click', showTranscript));

  function setupSkillSelectors() {
    qa('.mini-select').forEach(btn => btn.addEventListener('click', () => cycleButton(btn, ['Last 7 days', 'Last 30 days', 'All time'])));
  }
  setupSkillSelectors();
}

function setupEarnings() {
  if (!q('.earn-hero')) return;
  qa('.mini-select').forEach(btn => {
    btn.dataset.value = 'This Month';
    btn.addEventListener('click', () => cycleButton(btn, ['This Month', 'This Week', 'This Year']));
  });
  q('.share-btn')?.addEventListener('click', async () => {
    const text = 'Join with my referral code: SALESBOOST23';
    if (navigator.share) {
      try { await navigator.share({ title: 'Invite & Earn', text }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); } catch {}
    showToast('Invite copied');
  });
}

function setupAccount() {
  if (!q('.profile-card')) return;
  q('.profile-card').style.cursor = 'pointer';
  q('.profile-card').addEventListener('click', () => showProfile());

  qa('.setting-row').forEach(row => {
    const label = q('span', row)?.textContent?.trim();
    if (!label) return;
    if (label === 'Call Recording') {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        q('.toggle', row).classList.toggle('on');
        showToast(q('.toggle', row).classList.contains('on') ? 'Call recording on' : 'Call recording off');
      });
      return;
    }
    row.addEventListener('click', e => {
      e.preventDefault();
      if (label === 'Profile Settings') return showProfile();
      if (label === 'Log Out') return modal('Log Out', '<p class="modal-help">Are you sure you want to log out?</p>', [
        { label: 'Cancel' }, { label: 'Log Out', danger: true, onClick: close => { close(); showToast('Demo logout complete'); } }
      ]);
      if (label === 'Phone Settings') return modal('Phone Settings', '<label class="modal-label">Calling number<input class="modal-input" value="(702) 555-0100"></label><label class="modal-label">Caller ID<input class="modal-input" value="Steady Hands"></label>', [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: close => { close(); showToast('Phone settings saved'); } }]);
      if (label === 'Audio Devices') return modal('Audio Devices', '<label class="modal-label">Microphone<select class="modal-input"><option>Default microphone</option></select></label><label class="modal-label">Speaker<select class="modal-input"><option>Default speaker</option></select></label>', [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: close => { close(); showToast('Audio settings saved'); } }]);
      if (label === 'Notifications') return modal('Notifications', '<label class="modal-check"><input type="checkbox" checked> Follow-up reminders</label><label class="modal-check"><input type="checkbox" checked> Earnings updates</label><label class="modal-check"><input type="checkbox"> Team alerts</label>', [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: close => { close(); showToast('Notification settings saved'); } }]);
    });
  });

  function showProfile() {
    modal('Profile Settings', '<label class="modal-label">Name<input class="modal-input" value="Alex Harper"></label><label class="modal-label">Email<input class="modal-input" type="email" value="alex@company.com"></label>', [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: close => { close(); showToast('Profile saved'); } }]);
  }
}

function setupMore() {
  if (document.title !== 'More') return;
  qa('.setting-row').forEach(row => {
    const label = q('span', row)?.textContent?.trim();
    row.addEventListener('click', e => {
      e.preventDefault();
      const configs = {
        'Team Management': ['Team Management', '<p class="modal-help">Manage team members, roles, and access.</p><button class="practice-btn">+ Add Team Member</button>'],
        'Inactive Users': ['Inactive Users', '<p class="modal-help">No inactive users in this demo.</p>'],
        'Tags': ['Tags', '<p class="modal-help">Current tags</p><div class="modal-tags"><span>Warm</span><span>Follow Up</span><span>High Priority</span></div><button class="practice-btn">+ Add Tag</button>'],
        'Alerts': ['Alerts', '<label class="modal-check"><input type="checkbox" checked> Missed follow-ups</label><label class="modal-check"><input type="checkbox" checked> New assignments</label>'],
        'General Settings': ['General Settings', '<label class="modal-check"><input type="checkbox" checked> Haptic feedback</label><label class="modal-check"><input type="checkbox" checked> Confirm before calling</label>']
      };
      const cfg = configs[label];
      if (cfg) modal(cfg[0], cfg[1], [{ label: 'Close' }, { label: 'Save', primary: true, onClick: close => { close(); showToast('Settings saved'); } }]);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  refreshIcons();
  setupCopyButtons();
  setupOutreach();
  setupSkills();
  setupEarnings();
  setupAccount();
  setupMore();
});
