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



  const originalOrder = [...leadCards];

  const leadContainer = leadCards[0].parentElement;

  let activeFilter = 'All Leads';

  // Selection is stored as the actual lead card, never as a position.
  let selectedCard = null;



  const companyName = card => q('.lead-title h2', card)?.textContent?.trim() || 'Business';

  const STAR_KEY = 'outreach-starred-companies';



  // Star state is separate from High Priority. Restore the user's star choices.

  const initialStarred = originalOrder

    .filter(card => q('.star-button', card)?.classList.contains('favorite'))

    .map(companyName);

  let starredNames;

  try {

    const saved = JSON.parse(localStorage.getItem(STAR_KEY));

    starredNames = Array.isArray(saved) ? new Set(saved) : new Set(initialStarred);

  } catch {

    starredNames = new Set(initialStarred);

  }



  const syncStars = () => {

    originalOrder.forEach(card => {

      const star = q('.star-button', card);

      if (!star) return;

      const on = starredNames.has(companyName(card));

      star.classList.toggle('favorite', on);

      star.setAttribute('aria-label', on ? 'Unstar company' : 'Star company');

      star.setAttribute('aria-pressed', String(on));

    });

    localStorage.setItem(STAR_KEY, JSON.stringify([...starredNames]));

  };

  syncStars();



  const matchesFilter = card => {

    if (activeFilter === 'Due for Follow Up') return card.dataset.followup === 'true';

    if (activeFilter === 'High Priority') return card.dataset.priority === 'true';

    return true;

  };



  // ONE authoritative display order:
  // selected company -> all starred companies -> all unstarred companies.
  // Original CRM order is preserved inside the starred and unstarred groups.
  const getFilteredQueue = () => originalOrder.filter(matchesFilter);

  const getOrderedCards = () => {
    const filtered = getFilteredQueue();
    if (!filtered.length) return [];

    if (!selectedCard || !filtered.includes(selectedCard)) {
      selectedCard =
        filtered.find(card => starredNames.has(companyName(card))) ||
        filtered[0];
    }

    const remaining = filtered.filter(card => card !== selectedCard);
    const starred = remaining.filter(card => starredNames.has(companyName(card)));
    const unstarred = remaining.filter(card => !starredNames.has(companyName(card)));

    return [selectedCard, ...starred, ...unstarred];
  };

  const renderQueue = (shouldScroll = false) => {
    const orderedCards = getOrderedCards();
    const orderedSet = new Set(orderedCards);

    // Fully reset every card before rebuilding the visible order.
    originalOrder.forEach(card => {
      card.classList.remove('selected-lead');
      card.style.display = 'none';
      card.style.order = '';
    });

    // Physically rebuild the DOM in the ONLY allowed visible order:
    // selected -> starred -> unstarred.
    // Setting CSS order too prevents any flex/grid rule from overriding it.
    orderedCards.forEach((card, index) => {
      card.style.display = '';
      card.style.order = String(index);
      card.classList.toggle('selected-lead', index === 0);
      leadContainer.appendChild(card);
    });

    // Keep filtered-out cards after every visible card so they can never
    // interfere with the visible starred ordering when another lead is selected.
    originalOrder
      .filter(card => !orderedSet.has(card))
      .forEach(card => leadContainer.appendChild(card));

    refreshIcons();

    if (shouldScroll && orderedCards[0]) {
      orderedCards[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const selectCard = (card, shouldScroll = true) => {
    if (!card || !matchesFilter(card)) return;

    selectedCard = card;

    // Every selection rebuilds from original CRM order + saved star state.
    // No current DOM position is ever reused.
    renderQueue(shouldScroll);
  };

  const applyFilter = label => {
    activeFilter = label;
    selectedCard = null;
    renderQueue(false);
  };

  qa('.pill').forEach(btn => {

    btn.addEventListener('click', () => {

      qa('.pill').forEach(x => x.classList.remove('active'));

      btn.classList.add('active');

      applyFilter(btn.textContent.trim());

      showToast(btn.textContent.trim());

    });

  });



  originalOrder.forEach(card => {

    card.addEventListener('click', e => {

      if (e.target.closest('button, a, .notes')) return;

      if (!card.classList.contains('selected-lead')) selectCard(card);

    });

  });



  // Notes open in an editable popup on Outreach.

  originalOrder.forEach(card => {

    const notes = q('.notes', card);

    if (!notes) return;

    notes.setAttribute('role', 'button');

    notes.setAttribute('tabindex', '0');

    const openNotes = e => {

      e?.stopPropagation?.();

      const p = q('p', notes);

      const current = (p?.innerText || '').trim();

      const overlay = modal(`Notes — ${companyName(card)}`, `

        <p class="modal-help">Add or update notes for this business.</p>

        <textarea class="modal-textarea" id="lead-note-edit" placeholder="Add a note..."></textarea>`, [

        { label: 'Cancel' },

        { label: 'Save Note', primary: true, onClick: (close, root) => {

          const value = q('#lead-note-edit', root).value.trim();

          if (p) {

            p.textContent = value || 'No notes added yet.';

            p.style.whiteSpace = 'pre-line';

          }

          close();

          showToast('Note saved');

        }}

      ]);

      const textarea = q('#lead-note-edit', overlay);

      textarea.value = current === 'No notes added yet.' ? '' : current;

      setTimeout(() => textarea.focus(), 80);

    };

    notes.addEventListener('click', openNotes);

    notes.addEventListener('keydown', e => {

      if (e.key === 'Enter' || e.key === ' ') openNotes(e);

    });

  });



  function openCalendarSheet(card) {

    q('.calendar-sheet-overlay')?.remove();

    const now = new Date();

    const state = {

      month: now.getMonth(),

      day: now.getDate(),

      year: now.getFullYear(),

      hour: ((now.getHours() + 11) % 12) + 1,

      minute: [0,15,30,45].reduce((a,b) => Math.abs(b-now.getMinutes()) < Math.abs(a-now.getMinutes()) ? b : a, 0),

      ampm: now.getHours() >= 12 ? 'PM' : 'AM'

    };

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const years = Array.from({length: 6}, (_,i) => now.getFullYear() + i);

    const hours = Array.from({length:12},(_,i)=>i+1);

    const minutes = [0,15,30,45];



    const overlay = document.createElement('div');

    overlay.className = 'calendar-sheet-overlay';

    overlay.innerHTML = `

      <section class="calendar-sheet" role="dialog" aria-modal="true" aria-label="Add to Calendar">

        <div class="calendar-grabber"></div>

        <div class="calendar-sheet-head">

          <h2>Add to Calendar</h2>

          <button class="calendar-close" aria-label="Close"><i data-lucide="x"></i></button>

        </div>

        <div class="calendar-progress"><span></span></div>

        <p class="calendar-lead">Choose when to follow up with <strong>${companyName(card)}</strong>.</p>



        <label class="calendar-label">Date</label>

        <div class="picker-row date-picker-row">

          <div class="picker-field month" data-picker="month"><button class="picker-button" type="button"><span></span><i data-lucide="chevron-down"></i></button><div class="picker-menu"></div></div>

          <div class="picker-field day" data-picker="day"><button class="picker-button" type="button"><span></span><i data-lucide="chevron-down"></i></button><div class="picker-menu"></div></div>

          <div class="picker-field year" data-picker="year"><button class="picker-button" type="button"><span></span><i data-lucide="chevron-down"></i></button><div class="picker-menu"></div></div>

        </div>

        <div class="calendar-date-preview"></div>



        <label class="calendar-label">Time</label>

        <div class="picker-row time-picker-row">

          <div class="picker-field hour" data-picker="hour"><button class="picker-button" type="button"><span></span><i data-lucide="chevron-down"></i></button><div class="picker-menu"></div></div>

          <span class="picker-separator">:</span>

          <div class="picker-field minute" data-picker="minute"><button class="picker-button" type="button"><span></span><i data-lucide="chevron-down"></i></button><div class="picker-menu"></div></div>

          <div class="picker-field ampm" data-picker="ampm"><button class="picker-button" type="button"><span></span><i data-lucide="chevron-down"></i></button><div class="picker-menu"></div></div>

        </div>



        <label class="calendar-label">Note <span style="font-weight:700;color:#91a0af">(optional)</span></label>

        <textarea class="calendar-note" placeholder="Add a note for this follow-up..."></textarea>



        <div class="calendar-actions">

          <button class="calendar-action calendar-cancel" type="button">Cancel</button>

          <button class="calendar-action primary calendar-save" type="button"><i data-lucide="calendar-plus"></i> Add to Calendar</button>

        </div>

      </section>`;

    document.body.appendChild(overlay);



    const sheet = q('.calendar-sheet', overlay);

    const pickerFields = qa('.picker-field', sheet);

    const closeMenus = except => pickerFields.forEach(f => { if (f !== except) f.classList.remove('open'); });

    const daysInMonth = () => new Date(state.year, state.month + 1, 0).getDate();

    const clampDay = () => { state.day = Math.min(state.day, daysInMonth()); };

    const pad = n => String(n).padStart(2,'0');



    const valuesFor = type => {

      if (type === 'month') return months.map((label, value) => ({label, value}));

      if (type === 'day') return Array.from({length:daysInMonth()},(_,i)=>({label:String(i+1),value:i+1}));

      if (type === 'year') return years.map(v=>({label:String(v),value:v}));

      if (type === 'hour') return hours.map(v=>({label:pad(v),value:v}));

      if (type === 'minute') return minutes.map(v=>({label:pad(v),value:v}));

      return [{label:'AM',value:'AM'},{label:'PM',value:'PM'}];

    };



    const getStateValue = type => type === 'month' ? state.month : state[type];

    const setStateValue = (type, value) => {

      if (type === 'month') state.month = Number(value);

      else if (type === 'ampm') state.ampm = value;

      else state[type] = Number(value);

      if (type === 'month' || type === 'year') clampDay();

    };



    const renderPickers = () => {

      pickerFields.forEach(field => {

        const type = field.dataset.picker;

        const buttonText = q('.picker-button span', field);

        const menu = q('.picker-menu', field);

        const vals = valuesFor(type);

        const current = getStateValue(type);

        const chosen = vals.find(x => String(x.value) === String(current)) || vals[0];

        buttonText.textContent = chosen.label;

        menu.innerHTML = '';

        vals.forEach(item => {

          const b = document.createElement('button');

          b.type = 'button';

          b.className = `picker-option${String(item.value) === String(current) ? ' selected' : ''}`;

          b.textContent = item.label;

          b.addEventListener('click', e => {

            e.stopPropagation();

            setStateValue(type, item.value);

            field.classList.remove('open');

            renderPickers();

          });

          menu.appendChild(b);

        });

      });

      q('.calendar-date-preview', sheet).textContent = `${months[state.month]} ${state.day}, ${state.year}`;

      refreshIcons();

    };



    pickerFields.forEach(field => {

      q('.picker-button', field).addEventListener('click', e => {

        e.stopPropagation();

        const open = field.classList.contains('open');

        closeMenus(field);

        field.classList.toggle('open', !open);

      });

    });

    sheet.addEventListener('click', () => closeMenus());



    const close = () => overlay.remove();

    q('.calendar-close', sheet).addEventListener('click', close);

    q('.calendar-cancel', sheet).addEventListener('click', close);

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });



    q('.calendar-save', sheet).addEventListener('click', () => {

      let hour24 = state.hour % 12;

      if (state.ampm === 'PM') hour24 += 12;

      const start = new Date(state.year, state.month, state.day, hour24, state.minute, 0);

      const end = new Date(start.getTime() + 30 * 60000);

      const note = q('.calendar-note', sheet).value.trim();

      const name = companyName(card);

      const contact = q('.lead-title .name', card)?.textContent?.trim() || '';

      const number = q('.contact-line span', card)?.textContent?.trim() || '';

      const fmt = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

      const esc = v => String(v).replace(/**\\\**/g,'\\\\\\\\').replace(/\n/g,'\\\n').replace(/,/g,'\\\\,').replace(/;/g,'\\\\;');

      const description = [contact, number, note].filter(Boolean).join('\n');

      const ics = [

        'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sales Call Pro//Outreach//EN','CALSCALE:GREGORIAN',

        'BEGIN:VEVENT',`DTSTART:${fmt(start)}`,`DTEND:${fmt(end)}`,

        `SUMMARY:${esc(`Follow up with ${name}`)}`,

        `DESCRIPTION:${esc(description)}`,

        `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@salescallpro.local`,

        'END:VEVENT','END:VCALENDAR'

      ].join('\r\n');

      const blob = new Blob([ics], {type:'text/calendar;charset=utf-8'});

      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');

      a.href = url;

      a.download = `follow-up-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'lead'}.ics`;

      document.body.appendChild(a);

      a.click();

      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1500);



      card.dataset.followup = 'true';

      localStorage.setItem(`followup:${name}`, JSON.stringify({

        date: `${months[state.month]} ${state.day}, ${state.year}`,

        time: `${pad(state.hour)}:${pad(state.minute)} ${state.ampm}`,

        note

      }));

      close();

      showToast('Calendar event ready');

      if (activeFilter === 'Due for Follow Up') { selectedCard = card; renderQueue(false); }

    });



    renderPickers();

  }



  qa('.quick-btn').forEach(btn => {

    const label = btn.textContent.trim().toLowerCase();



    if (label.includes('random')) btn.addEventListener('click', e => {
    e.stopPropagation();

    const queue = getFilteredQueue();
    if (!queue.length) return;

    let nextCard = queue[0];

    if (queue.length > 1) {
      do {
        nextCard = queue[Math.floor(Math.random() * queue.length)];
      } while (nextCard === selectedCard);
    }

    selectedCard = nextCard;
    renderQueue(true);
  });

  if (label.includes('next')) btn.addEventListener('click', e => {
    e.stopPropagation();

    const queue = getFilteredQueue();
    if (!queue.length) return;

    const currentPos = selectedCard ? queue.indexOf(selectedCard) : -1;
    selectedCard = queue[(currentPos + 1 + queue.length) % queue.length];

    renderQueue(true);
  });

  if (label.includes('calendar')) btn.addEventListener('click', e => {

      e.stopPropagation();

      const card = btn.closest('.lead-card') || selectedCard || getOrderedCards()[0];

      if (card) openCalendarSheet(card);

    });

  });



  qa('[data-demo-call]').forEach(btn => {

    btn.addEventListener('click', e => {

      e.stopPropagation();

      const card = btn.closest('.lead-card');

      const company = companyName(card);

      const contact = q('.lead-title .name', card)?.textContent?.trim() || '';

      const number = q('.contact-line span', card)?.textContent?.trim() || '';

      const role = q('.lead-title .role', card)?.textContent?.trim() || '';

      const params = new URLSearchParams({ company, contact, number, role });

      window.location.href = `call.html?${params.toString()}`;

    });

  });



  qa('.star-button').forEach(star => {

    const toggle = e => {

      e?.stopPropagation?.();

      const card = star.closest('.lead-card');

      const name = companyName(card);

      const currentCard = q('.lead-card.selected-lead');

      if (starredNames.has(name)) starredNames.delete(name);

      else starredNames.add(name);

      syncStars();

      showToast(starredNames.has(name) ? 'Company starred' : 'Company unstarred');



      // Keep the selected lead fixed. Re-render using the only allowed order:
    // selected -> starred -> unstarred.
    if (currentCard) selectedCard = currentCard;
    renderQueue(false);

  };

    star.addEventListener('click', toggle);

  });



  renderQueue(false);

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


