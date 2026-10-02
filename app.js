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
  const selectedLeadTop = q('#selectedLeadTop');

  let activeFilter = 'All Previews';

  let selectedCard = originalOrder.find(card => card.dataset.crmId === window.steadyHandsForcedCRMId) || null;
  window.steadyHandsForcedCRMId = null;

  let leadSort = 'hours';

  let navigationQueue = [];

  let queueTransition = false;

  let queuePending = null;

  const SKELETON_DELAY = 220;

  const compactSkeleton = height => `

    <div class="skeleton-lead skeleton-compact" style="height:${height}px" aria-hidden="true">

      <div class="sk-row">

        <div class="sk-shape sk-icon"></div>

        <div class="sk-grow">

          <div class="sk-shape sk-title"></div>

          <div class="sk-shape sk-subtitle"></div>

        </div>

        <div class="sk-shape sk-star"></div>

      </div>

      <div class="sk-shape sk-phone"></div>

    </div>`;

  const expandedSkeleton = height => `

    <div class="skeleton-lead skeleton-expanded" style="height:${height}px" aria-hidden="true">

      <div class="sk-row">

        <div class="sk-shape sk-icon"></div>

        <div class="sk-grow">

          <div class="sk-shape sk-title"></div>

          <div class="sk-shape sk-subtitle"></div>

        </div>

        <div class="sk-shape sk-star"></div>

      </div>

      <div class="sk-shape sk-phone"></div>

      <div class="sk-chips"><span class="sk-shape"></span><span class="sk-shape"></span><span class="sk-shape"></span></div>

      <div class="sk-shape sk-line"></div>

      <div class="sk-shape sk-line short"></div>

      <div class="sk-shape sk-preview"></div>

      <div class="sk-shape sk-note"></div>

      <div class="sk-shape sk-call"></div>

      <div class="sk-chips sk-bottom"><span class="sk-shape"></span><span class="sk-shape"></span><span class="sk-shape"></span></div>

    </div>`;

  function skeletonMarkup() {

    return [...leadContainer.children]

      .filter(el => {

        if (el.classList.contains('lead-skeleton-overlay')) return false;

        const style = getComputedStyle(el);

        return style.display !== 'none' && style.visibility !== 'hidden';

      })

      .map(el => {

        const height = Math.max(1, Math.ceil(el.getBoundingClientRect().height));

        if (el.classList.contains('lead-sort-control')) {

          return `<div class="skeleton-sort" style="height:${height}px" aria-hidden="true"><span class="sk-shape"></span><span class="sk-shape"></span></div>`;

        }

        if (el.classList.contains('lead-card')) {

          return el.classList.contains('selected-lead')

            ? expandedSkeleton(height)

            : compactSkeleton(height);

        }

        return '';

      })

      .join('');

  }

  function changeLeads(update) {

    if (queueTransition) { queuePending = update; return; }

    queueTransition = true;

    const previousHeight = Math.ceil(leadContainer.getBoundingClientRect().height);

    const markup = skeletonMarkup();

    leadContainer.style.minHeight = `${previousHeight}px`;

    leadContainer.classList.add('leads-switching');

    leadContainer.setAttribute('aria-busy','true');

    const overlay = document.createElement('div');

    overlay.className = 'lead-skeleton-overlay';

    overlay.innerHTML = markup;

    leadContainer.appendChild(overlay);

    refreshIcons();

    window.setTimeout(() => {

      try { update(); } catch(error) { console.error('Unable to change leads:', error); }

      overlay.remove();

      leadContainer.classList.remove('leads-switching');

      leadContainer.removeAttribute('aria-busy');

      leadContainer.style.minHeight = '';

      queueTransition = false;

      if (queuePending) {

        const next = queuePending;

        queuePending = null;

        changeLeads(next);

      }

    }, SKELETON_DELAY);

  }

  const MAX_FOLLOWING = 10;

  const orderToggle = document.createElement('div');

  orderToggle.className = 'lead-sort-control';

  orderToggle.setAttribute('role', 'group');

  orderToggle.setAttribute('aria-label', 'Sort companies');

  orderToggle.innerHTML = `

    <span class="lead-sort-caption"><i data-lucide="list-filter"></i> Sort next leads</span>

    <div class="lead-sort-options">

      <button type="button" class="lead-sort-option active" data-sort="hours" aria-pressed="true">Best Hours to Call</button>

      <button type="button" class="lead-sort-option" data-sort="website" aria-pressed="false">Website Opportunity</button>

    </div>`;

  const companyName = card => q('.lead-title h2', card)?.textContent?.trim() || 'Business';

  const starKey = card => card?.dataset.crmId || companyName(card);

  const STAR_KEY = 'steadyhands-outreach-starred-preview-ids';

  const initialStarred = originalOrder

    .filter(card => q('.star-button', card)?.classList.contains('favorite'))

    .map(starKey);

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

      const on = starredNames.has(starKey(card));

      star.classList.toggle('favorite', on);

      star.setAttribute('aria-label', on ? 'Unstar company' : 'Star company');

      star.setAttribute('aria-pressed', String(on));

    });

    localStorage.setItem(STAR_KEY, JSON.stringify([...starredNames]));

  };

  syncStars();

  const matchesFilter = card => {

    const query = (q('#crmSearch')?.value || '').trim().toLowerCase();

    if (query && !card.textContent.toLowerCase().includes(query)) return false;

    if (activeFilter === 'Call Backs') return card.dataset.followup === 'true';

    if (activeFilter === 'Not Interested') return card.dataset.notInterested === 'true';

    if (activeFilter === 'High Priority') return starredNames.has(starKey(card));

    return true;

  };

  const getFilteredQueue = () => originalOrder.filter(matchesFilter);

  const getTimeZone = card => {

    const text = card.dataset.timezone || q('.time-row', card)?.textContent || '';

    const phone = q('.contact-line span', card)?.textContent || '';

    if (/\b(EST|EDT)\b/i.test(text)) return 'America/New_York';

    if (/\b(CST|CDT)\b/i.test(text)) return 'America/Chicago';

    if (/\b(MST|MDT)\b/i.test(text)) return 'America/Denver';

    if (/\b(PST|PDT)\b/i.test(text)) return 'America/Los_Angeles';

    if (/(?:702|725|415|206|503|619|916)/.test(phone)) return 'America/Los_Angeles';

    if (/(?:480|520|602|623|928)/.test(phone)) return 'America/Phoenix';

    if (/(?:212|305|404|617|718|813|917)/.test(phone)) return 'America/New_York';

    if (/(?:214|312|469|713|832)/.test(phone)) return 'America/Chicago';

    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';

  };

  const localHour = card => {

    try {

      const parts = new Intl.DateTimeFormat('en-US', {

        timeZone: getTimeZone(card), hour: 'numeric', hourCycle: 'h23'

      }).formatToParts(new Date());

      return Number(parts.find(p => p.type === 'hour')?.value ?? 12);

    } catch { return 12; }

  };

  const hourScore = card => {

    const hour = localHour(card);

    const preferred = 10;

    if (hour >= 9 && hour < 17) return 100 - Math.abs(hour - preferred);

    if (hour < 9) return 50 - (9 - hour);

    return 50 - (hour - 17);

  };

  const websiteScore = card => {

    const notes = q('.notes p', card)?.textContent || '';

    const tags = q('.tag-row', card)?.textContent || '';

    const details = `${notes} ${tags}`.toLowerCase();

    let score = 0;

    if (/no website|without a website|doesn't have a website|does not have a website/.test(details)) score += 4;

    if (/outdated|old website|old site|broken site/.test(details)) score += 3;

    if (/website preview|preview concept|send preview|asked to see a website|wants online booking/.test(details)) score += 2;

    if (/interested|asked about pricing|high priority/.test(details)) score += 1;

    return score;

  };

  const rankedPool = () => {

    const pool = getFilteredQueue();

    const sourceIndex = new Map(originalOrder.map((card, i) => [card, i]));

    const rank = card => leadSort === 'website' ? websiteScore(card) : hourScore(card);

    return [...pool].sort((a, b) => {

      const starDiff = Number(starredNames.has(starKey(b))) - Number(starredNames.has(starKey(a)));

      if (starDiff) return starDiff;

      return rank(b) - rank(a) || sourceIndex.get(a) - sourceIndex.get(b);

    });

  };

  const getOrderedCards = () => {

    const pool = rankedPool();

    if (!pool.length) { selectedCard = null; return []; }

    if (!selectedCard || !pool.includes(selectedCard)) selectedCard = pool[0];

    const remaining = pool.filter(card => card !== selectedCard);

    return [selectedCard, ...remaining];

  };

  const updateSortButtons = () => {

    qa('.lead-sort-option', orderToggle).forEach(btn => {

      const active = btn.dataset.sort === leadSort;

      btn.classList.toggle('active', active);

      btn.setAttribute('aria-pressed', String(active));

    });

  };

  qa('.lead-sort-option', orderToggle).forEach(btn => btn.addEventListener('click', () => {

    leadSort = btn.dataset.sort;

    updateSortButtons();

    changeLeads(() => renderQueue(false));

  }));

  const renderQueue = (shouldScroll = false) => {

    const orderedCards = getOrderedCards();

    const visibleCards = orderedCards.slice(0, MAX_FOLLOWING + 1);
    const selected = visibleCards[0] || null;
    const following = visibleCards.slice(1);

    originalOrder.forEach(card => {

      card.classList.remove('selected-lead');

      card.style.display = 'none';

      card.style.order = '';

    });

    orderToggle.remove();

    if (selected && selectedLeadTop) {
      selected.style.display = '';
      selected.classList.add('selected-lead');
      selectedLeadTop.replaceChildren(selected);
    } else if (selectedLeadTop) {
      selectedLeadTop.replaceChildren();
    }

    if (following.length) {
      orderToggle.style.order = '0';
      leadContainer.appendChild(orderToggle);
    }

    following.forEach((card, index) => {

      card.style.display = '';

      card.style.order = String(index + 1);

      leadContainer.appendChild(card);

    });

    originalOrder.filter(card => !visibleCards.includes(card))

      .forEach(card => leadContainer.appendChild(card));

    refreshIcons();

    if (shouldScroll && selected) {

    }

  };

  const selectCard = (card, shouldScroll = true) => {

    if (!card || !matchesFilter(card)) return;

    changeLeads(() => {

    selectedCard = card;

    renderQueue(false);

    if (card.dataset.crmId) {
      window.callcenterSetResumeLocation?.(
        `index.html?crm_id=${encodeURIComponent(card.dataset.crmId)}`,
        companyName(card)
      );
    }

    });

  };

  const applyFilter = label => {

    changeLeads(() => { activeFilter = label; selectedCard = null; renderQueue(false); });

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

        { label: 'Save Note', primary: true, onClick: async (close, root) => {

          const value = q('#lead-note-edit', root).value.trim();

          const client = window.steadyHandsCRMClient;

          if (!client || !card.dataset.crmId) { showToast('CRM is not connected'); return; }

          const { error } = await client.from('crm').update({ notes:value }).eq('id',card.dataset.crmId);

          if (error) { console.error('Unable to save note:',error); showToast('Could not save note. Try again.'); return; }

          if (p) { p.textContent = value || 'No notes added yet.'; p.style.whiteSpace = 'pre-line'; }

          close();

          showToast('Note saved in CRM');

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

        <p class="calendar-lead">Choose when to follow up with <strong>${crmEscape(companyName(card))}</strong>.</p>

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

      const esc = v => String(v).replace(/**\\\\\\**/g,'\\\\\\\\\\\\\\\\').replace(/\n/g,'\\\\\n').replace(/,/g,'\\\\\\\\,').replace(/;/g,'\\\\\\\\;');

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

    if (label.includes('random')) btn.addEventListener('click', async e => {
    e.stopPropagation();
    if (queueTransition) return;

    const client = window.steadyHandsCRMClient;
    if (!client) {
      showToast('Unable to load a random lead.');
      return;
    }

    queueTransition = true;
    const previousHeight = Math.ceil(leadContainer.getBoundingClientRect().height);
    const overlay = document.createElement('div');
    overlay.className = 'lead-skeleton-overlay';
    overlay.innerHTML = skeletonMarkup();

    leadContainer.style.minHeight = `${previousHeight}px`;
    leadContainer.classList.add('leads-switching');
    leadContainer.setAttribute('aria-busy', 'true');
    leadContainer.appendChild(overlay);
    refreshIcons();

    try {
      const { count, error: countError } = await client
        .from('preview_inventory')
        .select('url', { count: 'exact', head: true })
        .not('crm_id', 'is', null);

      if (countError) throw countError;
      if (!count) throw new Error('No approved previews found.');

      const currentId = selectedCard?.dataset.crmId || '';
      let picked = null;

      for (let attempt = 0; attempt < 4; attempt++) {
        const offset = Math.floor(Math.random() * count);

        const { data, error } = await client
          .from('preview_inventory')
          .select('url,crm_id')
          .not('crm_id', 'is', null)
          .order('url', { ascending: true })
          .range(offset, offset);

        if (error) throw error;

        picked = data?.[0] || null;

        if (picked && (picked.crm_id !== currentId || count === 1)) {
          break;
        }
      }

      if (!picked?.crm_id || !crmUrl(picked.url)) {
        throw new Error('Random lead could not be loaded.');
      }

      sessionStorage.setItem(
        'steadyhands-global-random-lead',
        JSON.stringify({
          crm_id: picked.crm_id,
          url: picked.url
        })
      );

      window.location.reload();
    } catch (error) {
      console.error('Unable to load random lead:', error);

      overlay.remove();
      leadContainer.classList.remove('leads-switching');
      leadContainer.removeAttribute('aria-busy');
      leadContainer.style.minHeight = '';
      queueTransition = false;

      showToast('Unable to load a random lead. Try again.');
    }
  });

  if (label.includes('next')) btn.addEventListener('click', e => {

    e.stopPropagation();

    const queue = rankedPool();

    if (!queue.length) return;

    const currentPos = selectedCard ? queue.indexOf(selectedCard) : -1;

    const nextCard = queue[(currentPos + 1 + queue.length) % queue.length];

    changeLeads(() => {
      selectedCard = nextCard;
      renderQueue(false);
      if (nextCard?.dataset.crmId) {
        window.callcenterSetResumeLocation?.(
          `index.html?crm_id=${encodeURIComponent(nextCard.dataset.crmId)}`,
          companyName(nextCard)
        );
      }
    });

  });

  if (label.includes('calendar')) btn.addEventListener('click', e => {

      e.stopPropagation();

      const card = btn.closest('.lead-card') || selectedCard || getOrderedCards()[0];

      if (card) openCalendarSheet(card);

    });

  });

  qa('[data-select-lead]').forEach(btn => {

    btn.addEventListener('click', e => {

      e.stopPropagation();

      const card = btn.closest('.lead-card');

      const company = companyName(card);

      const contact = q('.lead-title .name', card)?.textContent?.trim() || '';

      const number = q('.contact-line span', card)?.textContent?.trim() || '';

      const role = q('.lead-title .role', card)?.textContent?.trim() || '';

      const preview = card.dataset.previewUrl || q('.preview-link', card)?.href || '';

      const params = new URLSearchParams({
        company, contact, number, role, preview, crm_id: card.dataset.crmId || ''
      });

      const callHref = `call.html?${params.toString()}`;
      window.callcenterSetResumeLocation?.(callHref, company);
      window.location.href = callHref;

    });

  });

  qa('.star-button').forEach(star => {

    const toggle = e => {

      e?.stopPropagation?.();

      const card = star.closest('.lead-card');

      const name = starKey(card);

      const currentCard = q('.lead-card.selected-lead');

      if (starredNames.has(name)) starredNames.delete(name);

      else starredNames.add(name);

      syncStars();

      showToast(starredNames.has(name) ? 'Company starred' : 'Company unstarred');

    if (currentCard) selectedCard = currentCard;

    changeLeads(() => renderQueue(false));

  };

    star.addEventListener('click', toggle);

  });

  let searchTimer;

  q('#crmSearch')?.addEventListener('input', () => {

    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => changeLeads(() => { selectedCard = null; renderQueue(false); }), 240);

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

        { label: 'Cancel' }, { label: 'Log Out', danger: true, onClick: async close => { close(); try { const client = window.steadyHandsCRMClient || (window.supabase && window.supabase.createClient(SH_SUPABASE_URL, SH_PUBLISHABLE_KEY)); if (client) await client.auth.signOut(); window.callcenterClearResumeLocation?.(); sessionStorage.removeItem('callcenter-resume-checked'); window.location.replace('login.html'); } catch(error) {console.error('Sign out failed:',error); showToast('Unable to sign out. Try again.');} } }

      ]);

      if (label === 'Phone Settings') return modal('Phone Settings', '<label class="modal-label">Calling number<input class="modal-input" value="(702) 555-0100"></label><label class="modal-label">Caller ID<input class="modal-input" value="Steady Hands"></label>', [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: close => { close(); showToast('Phone settings saved'); } }]);

      if (label === 'Audio Devices') return modal('Audio Devices', '<label class="modal-label">Microphone<select class="modal-input"><option>Default microphone</option></select></label><label class="modal-label">Speaker<select class="modal-input"><option>Default speaker</option></select></label>', [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: close => { close(); showToast('Audio settings saved'); } }]);

      if (label === 'Notifications') return modal('Notifications', '<label class="modal-check"><input type="checkbox" checked> Follow-up reminders</label><label class="modal-check"><input type="checkbox" checked> Earnings updates</label><label class="modal-check"><input type="checkbox"> Team alerts</label>', [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: close => { close(); showToast('Notification settings saved'); } }]);

    });

  });

  function showProfile() {

    modal('Profile Settings', '<label class="modal-label">Name<input class="modal-input" value="Alex Harper"></label><label class="modal-label">Email<input class="modal-input" type="email" value="alex\@company.com"></label>', [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: close => { close(); showToast('Profile saved'); } }]);

  }

}

const SH_SUPABASE_URL = 'https\://glonbvrcudwuzjundrii.supabase.co';

const SH_PUBLISHABLE_KEY = 'sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';

function crmText(v) { return String(v ?? ''); }

function crmEscape(v) { return crmText(v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

function crmUrl(v) {

  try { const url = new URL(crmText(v)); return url.protocol === 'https:' && url.hostname === 'viewyoursite.today' && url.pathname.startsWith('/Sites/') ? url.href : ''; }

  catch { return ''; }

}

function crmTags(data) {

  let all = [];

  for (const key of ['tags','sources']) {

    let tags = data[key];

    if (typeof tags === 'string') { try { tags=JSON.parse(tags); } catch { tags=[]; } }

    if (Array.isArray(tags)) all.push(...tags.filter(t => typeof t === 'string'));

  }

  return all.slice(0,5);

}

function makeCRMLinkCard(lead, siteURLs) {

  const company = crmEscape(lead.company || lead.name || 'Unnamed business');

  const name = crmEscape(lead.name || '____');

  const phone = crmText(lead.phone || '').trim();

  const notes = crmText(lead.notes || '').trim();

  const isFollowup = !!lead.callbackdate || !!lead.callbackat || /follow.?up|callback|call back/i.test([lead.outcome,lead.stage,...crmTags(lead)].join(' '));

  const isNotInterested = lead.stage === 'notinterested' || /not interested/i.test([lead.outcome,...crmTags(lead)].join(' '));

  const tags = crmTags(lead);

  const urls = [...new Set(siteURLs.map(crmUrl).filter(Boolean))];

  const links = urls.map((url,i)=>`<a class="preview-link" target="_blank" rel="noopener noreferrer" href="${crmEscape(url)}"><i data-lucide="external-link"></i> ${urls.length > 1 ? `Preview ${i + 1}` : 'Open Website Preview'}</a>`).join('');

  const card=document.createElement('section');

  card.className='card lead-card';

  card.dataset.crmId=lead.id;

  card.dataset.followup=String(isFollowup);

  card.dataset.notInterested=String(isNotInterested);

  card.dataset.timezone=crmText(lead.timezone||'');
  card.dataset.previewUrl=urls[0] || '';

  const dateText=lead.callbackdate ? `Callback: ${crmEscape(lead.callbackdate)}` : (lead.lastcalled ? 'Previously contacted' : 'Not yet contacted');

  card.innerHTML=`

    <div class="lead-head"><div class="company-icon"><i data-lucide="building-2"></i></div>

      <div class="lead-title"><h2>${company}</h2><div class="name">${name}</div><div class="role">${urls.length} approved preview${urls.length === 1 ? '' : 's'}</div></div>

      <button class="star-button" type="button" aria-label="Star company" aria-pressed="false"><i data-lucide="star"></i></button>

    </div>

    <div class="contact-line"><i data-lucide="phone"></i><span>${crmEscape(phone || 'No phone listed')}</span>${phone ? `<button class="copy-btn" type="button" data-copy="${crmEscape(phone)}" aria-label="Copy phone"><i data-lucide="copy"></i></button>` : ''}</div>

    <div class="lead-details">

      <div class="tag-row">${tags.map((t,i)=>`<span class="tag ${['blue','purple','orange'][i%3]}">${crmEscape(t)}</span>`).join('') || '<span class="tag blue">Approved preview</span>'}</div>

      <div class="time-row"><span><i data-lucide="calendar"></i> ${dateText}</span></div>

      <div class="preview-links">${links}</div>

      <div class="notes"><div class="notes-title"><i data-lucide="notebook-pen"></i> CRM Notes</div><p>${crmEscape(notes || 'No notes added yet.')}</p></div>

      <button class="call-btn" type="button" data-select-lead ${phone ? '' : 'disabled'}><i data-lucide="check-circle-2"></i> ${phone ? 'Select Lead' : 'No Phone Number'}</button>

      <div class="quick-actions"><button class="quick-btn" type="button"><i data-lucide="shuffle"></i>Random</button><button class="quick-btn" type="button"><i data-lucide="play"></i>Next</button><button class="quick-btn calendar-btn" type="button"><i data-lucide="calendar-plus"></i>Add to Calendar</button></div>

    </div>`;

  return card;

}

async function loadApprovedPreviewCRM() {
  const status = q('#crmStatus');
  const box = q('#crmLeadCards');

  if (!status || !box) return;

  q('#crmReload')?.addEventListener('click', () => location.reload());

  if (!window.supabase) {
    status.textContent = 'Unable to connect. Please try again.';
    return;
  }

  const client =
    window.steadyHandsCRMClient ||
    window.supabase.createClient(
      SH_SUPABASE_URL,
      SH_PUBLISHABLE_KEY
    );

  window.steadyHandsCRMClient = client;

  try {
    const authResult = await client.auth.getSession();

    if (authResult.error) {
      throw authResult.error;
    }

    if (!authResult.data.session) {
      window.location.replace('login.html');
      return;
    }
  } catch (error) {
    console.error('Authentication check failed:', error);
    status.textContent = 'Unable to connect. Please try again.';
    return;
  }

  status.textContent = 'Loading leads...';

  box.innerHTML = Array.from({ length: 6 }, () => `
    <div class="skeleton-lead skeleton-compact" aria-hidden="true">
      <div class="sk-row">
        <div class="sk-shape sk-icon"></div>
        <div class="sk-grow">
          <div class="sk-shape sk-title"></div>
          <div class="sk-shape sk-subtitle"></div>
        </div>
        <div class="sk-shape sk-star"></div>
      </div>
      <div class="sk-shape sk-phone"></div>
    </div>
  `).join('');

  try {
    const TARGET_LEADS = 80;
    const INVENTORY_PAGE = 100;
    const MAX_INVENTORY_PAGES = 2;
    const byCRM = new Map();

    let forcedRandom = null;

    try {
      forcedRandom = JSON.parse(
        sessionStorage.getItem('steadyhands-global-random-lead') || 'null'
      );
    } catch {}

    sessionStorage.removeItem('steadyhands-global-random-lead');

    const requestedCRMId = new URLSearchParams(location.search).get('crm_id');
    if (requestedCRMId) {
      forcedRandom = { crm_id: requestedCRMId, url: '' };
      history.replaceState({}, '', 'index.html');
    }

    if (forcedRandom?.crm_id) {
      const { data, error } = await client
        .from('preview_inventory')
        .select('url,crm_id')
        .eq('crm_id', forcedRandom.crm_id)
        .order('url', { ascending: true })
        .limit(20);

      if (!error && data?.length) {
        const urls = data
          .map(item => crmUrl(item.url))
          .filter(Boolean);

        if (urls.length) {
          byCRM.set(
            forcedRandom.crm_id,
            [...new Set(urls)]
          );
        }
      } else {
        byCRM.set(
          forcedRandom.crm_id,
          [forcedRandom.url]
        );
      }
    }

    for (
      let page = 0;
      page < MAX_INVENTORY_PAGES &&
      byCRM.size < TARGET_LEADS;
      page++
    ) {
      const from = page * INVENTORY_PAGE;

      const { data, error } = await client
        .from('preview_inventory')
        .select('url,crm_id')
        .not('crm_id', 'is', null)
        .order('url', { ascending: true })
        .range(
          from,
          from + INVENTORY_PAGE - 1
        );

      if (error) {
        throw new Error(
          'Preview inventory: ' + error.message
        );
      }

      for (const item of data || []) {
        const url = crmUrl(item.url);

        if (!item.crm_id || !url) {
          continue;
        }

        const urls = byCRM.get(item.crm_id) || [];

        if (!urls.includes(url)) {
          urls.push(url);
        }

        byCRM.set(item.crm_id, urls);

        if (byCRM.size >= TARGET_LEADS) {
          break;
        }
      }

      if (
        !data ||
        data.length < INVENTORY_PAGE
      ) {
        break;
      }
    }

    const ids = [...byCRM.keys()]
      .slice(0, TARGET_LEADS);

    if (!ids.length) {
      throw new Error(
        'No approved preview leads returned.'
      );
    }

    const leads = [];

    for (
      let i = 0;
      i < ids.length;
      i += 80
    ) {
      const { data, error } = await client
        .from('crm')
        .select(
          'id,company,name,phone,notes,tags,sources,stage,outcome,callbackdate,callbackat,lastcalled,timezone,leadpotential,tier'
        )
        .in(
          'id',
          ids.slice(i, i + 80)
        );

      if (error) {
        throw new Error(
          'CRM: ' + error.message
        );
      }

      leads.push(...(data || []));
    }

    if (!leads.length) {
      throw new Error(
        'No matching CRM leads returned.'
      );
    }

    leads.sort((a, b) =>
      crmText(a.company)
        .localeCompare(
          crmText(b.company)
        )
    );

    if (forcedRandom?.crm_id) {
      const index = leads.findIndex(
        lead =>
          lead.id === forcedRandom.crm_id
      );

      if (index > 0) {
        const [randomLead] =
          leads.splice(index, 1);

        leads.unshift(randomLead);
      }

      window.steadyHandsForcedCRMId =
        forcedRandom.crm_id;
    }

    box.replaceChildren(
      ...leads.map(lead =>
        makeCRMLinkCard(
          lead,
          byCRM.get(lead.id) || []
        )
      )
    );

    status.textContent = '';
    status.style.display = 'none';

    // User-specific Outreach stats are loaded from callcenter_call_activity in user-data.js.\n\n    setupCopyButtons();
    setupOutreach();
    refreshIcons();
  } catch (error) {
    status.textContent =
      'Unable to load leads. Please try again.';

    box.replaceChildren();

    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', () => {

  refreshIcons();

  setupCopyButtons();

  loadApprovedPreviewCRM();

  setupSkills();

  setupEarnings();

  setupAccount();

});
