(() => {
  const URL = 'https://glonbvrcudwuzjundrii.supabase.co';
  const KEY = 'sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';

  const money = cents => cents == null
    ? '—'
    : new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(Number(cents) / 100);

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  const ageDays = value => {
    if (!value) return Infinity;
    return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  };

  function client() {
    if (!window.supabase) return null;
    if (!window.steadyHandsCRMClient) {
      window.steadyHandsCRMClient = window.supabase.createClient(URL, KEY);
    }
    return window.steadyHandsCRMClient;
  }

  function addStyles() {
    if (document.getElementById('callcenterLiveStyles')) return;
    const style = document.createElement('style');
    style.id = 'callcenterLiveStyles';
    style.textContent = `
      .cc-live-card{background:#fff;border:1px solid rgba(20,43,69,.08);border-radius:18px;box-shadow:0 10px 28px rgba(15,33,54,.08);padding:15px;margin-top:12px}
      .cc-live-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .cc-live-stat{background:#fff;border:1px solid #e7ebf0;border-radius:14px;padding:12px 8px;text-align:center}
      .cc-live-stat strong{display:block;font-size:20px;margin-bottom:4px}
      .cc-live-stat span{font-size:10px;color:#718096;font-weight:800}
      .cc-status{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900}
      .cc-status.waiting{background:#fff4df;color:#a56800}
      .cc-status.pending{background:#e9f2ff;color:#2169b8}
      .cc-status.complete,.cc-status.active{background:#e7f8ef;color:#138550}
      .cc-status.inactive{background:#fff1e4;color:#b46312}
      .cc-status.disabled{background:#fdecec;color:#b33c3c}
      .cc-row{display:flex;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid #edf0f4}
      .cc-row:last-child{border-bottom:0}
      .cc-row-main{flex:1;min-width:0}
      .cc-row-main strong{display:block;font-size:13px}
      .cc-row-main small{display:block;color:#77869a;margin-top:3px}
      .cc-row-side{text-align:right}
      .cc-row-side strong{display:block;font-size:13px}
      .cc-muted{color:#77869a;font-size:12px;line-height:1.5}
      .cc-empty{padding:20px 6px;text-align:center;color:#7d899a;font-size:12px}
      .cc-referral-rule{font-size:12px;line-height:1.55;color:#546579;margin:8px 0 0}
      .cc-code{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f6f8fb;border:1px solid #e6ebf1;border-radius:12px;padding:11px 12px;margin-top:12px;font-weight:900;letter-spacing:.8px}
      .cc-code button{border:0;background:transparent;color:#2378d2}
      .cc-overlay{position:fixed;inset:0;z-index:99999;background:rgba(7,22,37,.72);display:grid;place-items:end center;padding:0}
      .cc-sheet{width:min(430px,100%);background:#f6f8fb;border-radius:24px 24px 0 0;padding:18px 16px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -18px 50px rgba(0,0,0,.25)}
      .cc-progress{height:5px;background:#e2e8ef;border-radius:999px;overflow:hidden;margin-bottom:18px}
      .cc-progress span{display:block;height:100%;background:#2381e3;transition:width .2s ease}
      .cc-sheet h2{margin:0 0 7px;font-size:23px}
      .cc-sheet p{margin:0 0 15px;color:#68778a;font-size:13px;line-height:1.5}
      .cc-question{background:#fff;border:1px solid #e4e9ef;border-radius:16px;padding:14px;margin:10px 0}
      .cc-question label{display:block;font-size:12px;font-weight:900;margin-bottom:7px}
      .cc-question input{width:100%;border:1px solid #dfe5ec;border-radius:11px;padding:12px;font:inherit}
      .cc-check{display:flex;align-items:flex-start;gap:9px;background:#fff;border:1px solid #e4e9ef;border-radius:14px;padding:12px;margin:9px 0;font-size:12px;line-height:1.45}
      .cc-actions{display:flex;justify-content:space-between;gap:10px;margin-top:16px}
      .cc-actions button{border:0;border-radius:12px;padding:12px 14px;font-weight:900;min-width:105px}
      .cc-actions .primary{background:#177bdd;color:#fff;margin-left:auto}
      .cc-actions .secondary{background:#e8edf3;color:#435268}
      .cc-disabled{width:min(390px,calc(100% - 28px));background:#fff;border-radius:20px;padding:22px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.24)}
      .cc-disabled h2{margin:8px 0}
      .cc-disabled p{color:#68778a;line-height:1.5;font-size:13px}
      .cc-activity{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}
    `;
    document.head.appendChild(style);
  }

  async function getSessionAndProfile() {
    const c = client();
    if (!c) return {};
    const { data:{ session } = {}, error } = await c.auth.getSession();
    if (error || !session) return {};
    const { data: profile, error: profileError } = await c
      .from('callcenter_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (profileError) {
      console.warn('Call center profile unavailable:', profileError.message);
      return { session, profile:null, schemaReady:false };
    }
    return { session, profile, schemaReady:true };
  }

  function activityState(profile) {
    if (!profile) return { label:'Unknown', cls:'inactive', days:Infinity };
    const since = profile.last_call_at || profile.created_at;
    const days = ageDays(since);
    if (profile.disabled_at || days >= 90) return { label:'Disabled', cls:'disabled', days };
    if (days <= 30) return { label:'Active', cls:'active', days };
    return { label:'Inactive', cls:'inactive', days };
  }

  function showDisabled(profile) {
    if (document.querySelector('.cc-overlay[data-disabled]')) return;
    const overlay = document.createElement('div');
    overlay.className = 'cc-overlay';
    overlay.dataset.disabled = 'true';
    overlay.innerHTML = `
      <div class="cc-disabled">
        <i data-lucide="lock-keyhole" style="width:38px;height:38px;color:#b33c3c"></i>
        <h2>Account disabled</h2>
        <p>This account has not completed a call in 90 days. Contact support to renew access.</p>
        <button id="ccDisabledLogout" style="margin-top:10px;border:0;background:#102945;color:#fff;border-radius:12px;padding:12px 16px;font-weight:900">Log out</button>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('ccDisabledLogout').onclick = async () => {
      await client()?.auth.signOut();
      location.replace('login.html');
    };
    window.lucide?.createIcons();
  }

  async function showOnboarding(session, profile) {
    if (!profile || profile.onboarding_completed || document.querySelector('.cc-overlay[data-onboarding]')) return;
    const c = client();
    const overlay = document.createElement('div');
    overlay.className = 'cc-overlay';
    overlay.dataset.onboarding = 'true';
    document.body.appendChild(overlay);

    const state = {
      step: 0,
      name: profile.display_name || '',
      phone: profile.phone || '',
      referral: '',
      commissionOk: !!profile.commission_acknowledged,
      referralsOk: !!profile.referrals_acknowledged
    };

    const screens = [
      () => `
        <h2>Welcome</h2>
        <p>Before you start, answer a couple quick questions so your account is set up correctly.</p>
        <div class="cc-question"><label>What name should appear on your account?</label><input id="ccName" value="${esc(state.name)}" autocomplete="name"></div>
        <div class="cc-question"><label>Phone number <span style="font-weight:600;color:#8a96a6">(optional)</span></label><input id="ccPhone" value="${esc(state.phone)}" autocomplete="tel"></div>
      `,
      () => `
        <h2>How commission works</h2>
        <p>Your earnings are tied to your own sales and move through three live stages.</p>
        <div class="cc-question"><strong>1. Waiting on client payment</strong><p class="cc-muted">The sale is recorded, but the client has not paid yet.</p></div>
        <div class="cc-question"><strong>2. Pending</strong><p class="cc-muted">The client paid and your commission is waiting to be paid out.</p></div>
        <div class="cc-question"><strong>3. Complete</strong><p class="cc-muted">Your commission payout is finished.</p></div>
        <label class="cc-check"><input id="ccCommissionOk" type="checkbox" ${state.commissionOk?'checked':''}><span>I understand how the commission stages work.</span></label>
      `,
      () => `
        <h2>Direct referrals</h2>
        <p>After referring someone, you get <strong>$50 from their first commission</strong>, and <strong>$10 per commission they receive after</strong>.</p>
        <div class="cc-question"><label>Were you referred by someone? <span style="font-weight:600;color:#8a96a6">(optional)</span></label><input id="ccReferral" value="${esc(state.referral)}" placeholder="Enter referral code"></div>
        <label class="cc-check"><input id="ccReferralsOk" type="checkbox" ${state.referralsOk?'checked':''}><span>I understand how direct referral earnings work.</span></label>
      `,
      () => `
        <h2>Account activity</h2>
        <p>An account is considered <strong>Active</strong> when it has completed a call within the last 30 days.</p>
        <div class="cc-question"><strong>30 days</strong><p class="cc-muted">At least one completed call in the last 30 days keeps the account Active.</p></div>
        <div class="cc-question"><strong>90 days</strong><p class="cc-muted">If the account has not completed a call in 90 days, access is disabled. Contact support for renewals.</p></div>
      `
    ];

    const saveInputs = () => {
      const name = document.getElementById('ccName');
      const phone = document.getElementById('ccPhone');
      const referral = document.getElementById('ccReferral');
      const commissionOk = document.getElementById('ccCommissionOk');
      const referralsOk = document.getElementById('ccReferralsOk');
      if (name) state.name = name.value.trim();
      if (phone) state.phone = phone.value.trim();
      if (referral) state.referral = referral.value.trim().toUpperCase();
      if (commissionOk) state.commissionOk = commissionOk.checked;
      if (referralsOk) state.referralsOk = referralsOk.checked;
    };

    async function finish() {
      saveInputs();
      if (!state.name) {
        alert('Please enter your name.');
        state.step = 0;
        render();
        return;
      }
      if (!state.commissionOk) {
        alert('Please confirm that you understand the commission stages.');
        state.step = 1;
        render();
        return;
      }
      if (!state.referralsOk) {
        alert('Please confirm that you understand referrals.');
        state.step = 2;
        render();
        return;
      }

      let referredBy = null;
      if (state.referral) {
        const { data, error } = await c
          .from('callcenter_referral_codes')
          .select('user_id')
          .eq('code', state.referral)
          .maybeSingle();
        if (error || !data?.user_id || data.user_id === session.user.id) {
          alert('That referral code is not valid.');
          state.step = 2;
          render();
          return;
        }
        referredBy = data.user_id;
      }

      const { error } = await c
        .from('callcenter_profiles')
        .update({
          display_name: state.name,
          phone: state.phone,
          referred_by_user_id: referredBy,
          commission_acknowledged: true,
          referrals_acknowledged: true,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', session.user.id);

      if (error) {
        alert(error.message || 'Unable to save your account setup.');
        return;
      }
      overlay.remove();
      location.reload();
    }

    function render() {
      overlay.innerHTML = `
        <div class="cc-sheet">
          <div class="cc-progress"><span style="width:${((state.step+1)/screens.length)*100}%"></span></div>
          ${screens[state.step]()}
          <div class="cc-actions">
            ${state.step ? '<button class="secondary" id="ccBack">Back</button>' : '<span></span>'}
            <button class="primary" id="ccNext">${state.step === screens.length-1 ? 'Finish setup' : 'Continue'}</button>
          </div>
        </div>`;
      document.getElementById('ccBack')?.addEventListener('click', () => {
        saveInputs();
        state.step--;
        render();
      });
      document.getElementById('ccNext')?.addEventListener('click', () => {
        saveInputs();
        if (state.step === 0 && !state.name) return alert('Please enter your name.');
        if (state.step === 1 && !state.commissionOk) return alert('Please confirm that you understand the commission stages.');
        if (state.step === 2 && !state.referralsOk) return alert('Please confirm that you understand referrals.');
        if (state.step === screens.length - 1) return finish();
        state.step++;
        render();
      });
      window.lucide?.createIcons();
    }

    render();
  }

  window.callcenterRecordCall = async ({ crmId = null, duration = 0, outcome = '' } = {}) => {
    const c = client();
    if (!c || !duration) return;
    const { data:{ session } = {} } = await c.auth.getSession();
    if (!session) return;
    const payload = {
      user_id: session.user.id,
      crm_id: crmId || null,
      duration_seconds: Math.max(0, Number(duration) || 0),
      outcome: String(outcome || '')
    };
    const { error } = await c.from('callcenter_call_activity').insert(payload);
    if (error) console.warn('Unable to save call activity:', error.message);
  };

  async function loadEarnings(session, profile) {
    if (document.title !== 'Earnings') return;
    const c = client();
    const main = document.querySelector('main.content');
    if (!main) return;

    const [{ data: commissions = [] }, { data: bonuses = [] }, { data: referred = [] }] = await Promise.all([
      c.from('callcenter_commissions').select('*').eq('user_id', session.user.id).order('created_at', { ascending:false }),
      c.from('callcenter_referral_bonuses').select('*').eq('referrer_user_id', session.user.id).order('created_at', { ascending:false }),
      c.from('callcenter_profiles').select('user_id,display_name,email,last_call_at,created_at,disabled_at').eq('referred_by_user_id', session.user.id).order('created_at', { ascending:false })
    ]);

    const completed = commissions.filter(x => x.status === 'complete');
    const pending = commissions.filter(x => x.status === 'pending');
    const waiting = commissions.filter(x => x.status === 'waiting_client_payment');
    const completedAmount = completed.reduce((s,x) => s + (Number(x.commission_amount_cents)||0), 0);
    const pendingAmount = pending.reduce((s,x) => s + (Number(x.commission_amount_cents)||0), 0);
    const referralComplete = bonuses.filter(x => x.status === 'complete').reduce((s,x) => s + Number(x.amount_cents||0),0);
    const referralPending = bonuses.filter(x => x.status === 'pending').reduce((s,x) => s + Number(x.amount_cents||0),0);
    const totalEarned = completedAmount + referralComplete;

    const stageRows = [
      ['Waiting on client payment','waiting',waiting],
      ['Pending','pending',pending],
      ['Complete','complete',completed]
    ];

    main.innerHTML = `
      <section class="earn-hero">
        <div class="label">Total Completed Earnings</div>
        <div class="earn-row"><div><span class="earn-total">${money(totalEarned)}</span></div></div>
      </section>

      <div class="cc-live-grid" style="margin-top:12px">
        <div class="cc-live-stat"><strong>${waiting.length}</strong><span>Waiting on Client Payment</span></div>
        <div class="cc-live-stat"><strong>${pending.length}</strong><span>Pending</span></div>
        <div class="cc-live-stat"><strong>${completed.length}</strong><span>Complete</span></div>
      </div>

      <div class="section-title">Commission Status</div>
      ${stageRows.map(([label,cls,rows]) => `
        <section class="cc-live-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <strong>${label}</strong><span class="cc-status ${cls}">${rows.length}</span>
          </div>
          ${rows.length ? rows.slice(0,8).map(row => `
            <div class="cc-row">
              <div class="cc-row-main"><strong>${esc(row.client_name || 'Client')}</strong><small>${new Date(row.created_at).toLocaleDateString()}</small></div>
              <div class="cc-row-side"><strong>${money(row.commission_amount_cents)}</strong><span class="cc-status ${cls}">${label}</span></div>
            </div>`).join('') : '<div class="cc-empty">Nothing here yet.</div>'}
        </section>`).join('')}

      <div class="section-title">Referrals</div>
      <section class="cc-live-card">
        <strong>Invite & Earn</strong>
        <p class="cc-referral-rule">After referring someone, you get <strong>$50 from their first commission</strong>, and <strong>$10 per commission they receive after</strong>.</p>
        <div class="cc-code"><span>${esc(profile.referral_code)}</span><button id="ccCopyReferral"><i data-lucide="copy"></i></button></div>
      </section>

      <div class="cc-live-grid" style="margin-top:10px">
        <div class="cc-live-stat"><strong>${referred.filter(x=>activityState(x).label==='Active').length}</strong><span>Active Referrals</span></div>
        <div class="cc-live-stat"><strong>${money(referralPending)}</strong><span>Pending Referral Earnings</span></div>
        <div class="cc-live-stat"><strong>${money(referralComplete)}</strong><span>Referral Earnings Complete</span></div>
      </div>

      <div class="section-title">Referred Users</div>
      <section class="cc-live-card">
        ${referred.length ? referred.map(user => {
          const state = activityState(user);
          const earned = bonuses.filter(b => b.referred_user_id === user.user_id && b.status === 'complete').reduce((s,b)=>s+Number(b.amount_cents||0),0);
          const pendingUser = bonuses.filter(b => b.referred_user_id === user.user_id && b.status === 'pending').reduce((s,b)=>s+Number(b.amount_cents||0),0);
          return `<div class="cc-row">
            <div class="cc-row-main"><strong>${esc(user.display_name || user.email || 'User')}</strong><small>Joined ${new Date(user.created_at).toLocaleDateString()}</small></div>
            <div class="cc-row-side"><span class="cc-status ${state.cls}">${state.label}</span><small style="display:block;margin-top:5px;color:#77869a">${earned ? money(earned)+' earned' : pendingUser ? money(pendingUser)+' pending' : 'No referral earnings yet'}</small></div>
          </div>`;
        }).join('') : '<div class="cc-empty">No direct referrals yet.</div>'}
      </section>

      <div class="cc-live-card"><span class="cc-muted">Commission dollar amounts stay blank until a commission amount is assigned. Client payment totals are never shown as if they were salesperson earnings.</span></div>
    `;

    document.getElementById('ccCopyReferral')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(profile.referral_code); } catch {}
      if (window.showToast) window.showToast('Referral code copied');
    });
    window.lucide?.createIcons();
  }

  async function loadAccount(session, profile) {
    if (document.title !== 'Account') return;
    const main = document.querySelector('main.content');
    if (!main) return;
    const state = activityState(profile);
    const initials = (profile.display_name || session.user.email || 'U')
      .split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();

    main.innerHTML = `
      <section class="card profile-card">
        <div class="profile-avatar">${esc(initials)}</div>
        <div class="profile-info"><strong>${esc(profile.display_name || 'User')}</strong><small>${esc(session.user.email || '')}</small></div>
      </section>

      <section class="cc-live-card">
        <strong>Account Activity</strong>
        <div class="cc-activity"><span class="cc-muted">A call within the last 30 days keeps your account active.</span><span class="cc-status ${state.cls}">${state.label}</span></div>
        <p class="cc-muted" style="margin:10px 0 0">Last call: ${profile.last_call_at ? new Date(profile.last_call_at).toLocaleString() : 'No calls yet'}.</p>
        <p class="cc-muted" style="margin:5px 0 0">If no call is completed for 90 days, the account is disabled and support must renew it.</p>
      </section>

      <section class="card settings-group" style="margin-top:12px">
        <div class="group-title">Account</div>
        <a class="setting-row" href="#" id="ccProfileEdit"><i data-lucide="user-round"></i><span>Profile Settings</span><i class="chev" data-lucide="chevron-right"></i></a>
        <a class="setting-row logout" href="#" id="ccLogout"><i data-lucide="log-out"></i><span>Log Out</span><i class="chev" data-lucide="chevron-right"></i></a>
      </section>
    `;

    document.getElementById('ccLogout').onclick = async e => {
      e.preventDefault();
      await client()?.auth.signOut();
      location.replace('login.html');
    };

    document.getElementById('ccProfileEdit').onclick = async e => {
      e.preventDefault();
      const name = prompt('Display name', profile.display_name || '');
      if (name === null) return;
      const phone = prompt('Phone number', profile.phone || '');
      if (phone === null) return;
      const { error } = await client().from('callcenter_profiles').update({
        display_name:name.trim(), phone:phone.trim(), updated_at:new Date().toISOString()
      }).eq('user_id', session.user.id);
      if (error) return alert(error.message);
      location.reload();
    };
    window.lucide?.createIcons();
  }

  async function loadPersonalOutreachStats(session) {
    if (document.title !== 'Outreach') return;
    const c = client();
    const start = new Date();
    start.setHours(0,0,0,0);
    const { data = [], error } = await c
      .from('callcenter_call_activity')
      .select('outcome,created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending:false })
      .limit(1000);

    if (error) return;

    const callsToday = data.filter(row => new Date(row.created_at) >= start).length;
    const callbacks = data.filter(row => /follow up|call back|callback/i.test(row.outcome || '')).length;
    const interested = data.filter(row => /interested/i.test(row.outcome || '')).length;

    if (document.getElementById('statCalls')) document.getElementById('statCalls').textContent = callsToday;
    if (document.getElementById('statCallbacks')) document.getElementById('statCallbacks').textContent = callbacks;
    if (document.getElementById('statInterested')) document.getElementById('statInterested').textContent = interested;
  }

  async function init() {
    addStyles();
    const { session, profile, schemaReady } = await getSessionAndProfile();
    if (!session || !schemaReady || !profile) return;

    const state = activityState(profile);
    if (state.label === 'Disabled') {
      showDisabled(profile);
      return;
    }

    await showOnboarding(session, profile);
    if (!profile.onboarding_completed) return;

    await Promise.all([
      loadEarnings(session, profile),
      loadAccount(session, profile),
      loadPersonalOutreachStats(session)
    ]);
  }

  document.addEventListener('DOMContentLoaded', init);
})();