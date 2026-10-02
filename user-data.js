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
      return { session, profile:null, schemaReady:false, schemaError:profileError };
    }
    return { session, profile, schemaReady:true, schemaError:null };
  }

  function activityState(profile) {
    if (!profile) return { label:'Unknown', cls:'inactive', days:Infinity };
    if (profile.disabled_at) return { label:'Disabled', cls:'disabled', days:Infinity };

    if (!profile.last_call_at) {
      const accountAge = ageDays(profile.created_at);
      if (accountAge >= 90) return { label:'Disabled', cls:'disabled', days:accountAge };
      return { label:'Inactive', cls:'inactive', days:Infinity };
    }

    const days = ageDays(profile.last_call_at);
    if (days >= 90) return { label:'Disabled', cls:'disabled', days };
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
    const stateBox = document.getElementById('earningsState');

    const [
      { data: commissions = [], error: commissionsError },
      { data: bonuses = [], error: bonusesError },
      { data: referred = [], error: referredError }
    ] = await Promise.all([
      c.from('callcenter_commissions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending:false }),
      c.from('callcenter_referral_bonuses')
        .select('*')
        .eq('referrer_user_id', session.user.id)
        .order('created_at', { ascending:false }),
      c.from('callcenter_profiles')
        .select('user_id,display_name,email,last_call_at,created_at,disabled_at')
        .eq('referred_by_user_id', session.user.id)
        .order('created_at', { ascending:false })
    ]);

    const firstError = commissionsError || bonusesError || referredError;
    if (firstError) {
      console.error('Unable to load earnings data:', firstError);
      if (stateBox) {
        stateBox.style.display = '';
        stateBox.innerHTML = '<strong>Unable to load earnings right now.</strong><div class="cc-muted" style="margin-top:6px">Please refresh and try again.</div>';
      }
      return;
    }

    if (stateBox) stateBox.style.display = 'none';

    const completed = commissions.filter(row => row.status === 'complete');
    const pending = commissions.filter(row => row.status === 'pending');
    const waiting = commissions.filter(row => row.status === 'waiting_client_payment');

    const commissionComplete = completed.reduce((sum,row) => sum + (Number(row.commission_amount_cents) || 0), 0);
    const commissionPending = pending.reduce((sum,row) => sum + (Number(row.commission_amount_cents) || 0), 0);

    const referralComplete = bonuses
      .filter(row => row.status === 'complete')
      .reduce((sum,row) => sum + (Number(row.amount_cents) || 0), 0);

    const referralPending = bonuses
      .filter(row => row.status === 'pending')
      .reduce((sum,row) => sum + (Number(row.amount_cents) || 0), 0);

    const totalEarned = commissionComplete + referralComplete;
    const totalPending = commissionPending + referralPending;

    const allSalesValue = commissions.reduce(
      (sum,row) => sum + (Number(row.sale_amount_cents) || 0),
      0
    );

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('earnTotal', money(totalEarned));
    setText('commissionTotal', money(commissionComplete));
    setText('pendingPayoutTotal', money(totalPending));
    setText('closedDeals', commissions.length);
    setText('pipelineValue', money(allSalesValue));
    setText('referralCode', profile.referral_code || '—');
    setText('activeReferralCount', referred.filter(user => activityState(user).label === 'Active').length);
    setText('pendingReferralTotal', money(referralPending));
    setText('referralEarnedTotal', money(referralComplete));

    const chart = document.getElementById('weeklyEarningsChart');
    if (chart) {
      const labels = ['Mon','Tue','Wed','Thu','Fri'];
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setHours(0,0,0,0);
      monday.setDate(now.getDate() + diffToMonday);

      const totals = labels.map((_, index) => {
        const startDay = new Date(monday);
        startDay.setDate(monday.getDate() + index);
        const endDay = new Date(startDay);
        endDay.setDate(startDay.getDate() + 1);

        return completed
          .filter(row => {
            const when = new Date(row.completed_at || row.updated_at || row.created_at);
            return when >= startDay && when < endDay;
          })
          .reduce((sum,row) => sum + (Number(row.commission_amount_cents) || 0), 0);
      });

      const max = Math.max(...totals, 1);
      chart.innerHTML = totals.map((value,index) => {
        const height = value ? Math.max(22, Math.round((value / max) * 88)) : 10;
        return '<div class="bar-wrap"><div class="bar" style="height:' + height + 'px"><b>' + money(value) + '</b></div>' + labels[index] + '</div>';
      }).join('');
    }

    const recent = document.getElementById('recentPayouts');
    if (recent) {
      const rows = [...commissions]
        .sort((a,b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        .slice(0,8);

      recent.innerHTML = rows.length ? rows.map(row => {
        const statusLabel = row.status === 'waiting_client_payment'
          ? 'Waiting on client payment'
          : row.status === 'pending'
            ? 'Pending'
            : 'Complete';

        const badgeClass = row.status === 'complete'
          ? 'paid'
          : 'pending';

        const iconClass = row.status === 'complete'
          ? ''
          : ' pending';

        const icon = row.status === 'complete'
          ? 'check'
          : 'clock-3';

        const amount = row.commission_amount_cents == null
          ? '—'
          : money(row.commission_amount_cents);

        return '<div class="payout-row">' +
          '<div class="payout-dot' + iconClass + '"><i data-lucide="' + icon + '"></i></div>' +
          '<div class="payout-main"><strong>' + esc(row.client_name || 'Client') + '</strong><small>' + new Date(row.updated_at || row.created_at).toLocaleDateString() + '</small></div>' +
          '<div class="payout-side"><strong>' + amount + '</strong><span class="badge ' + badgeClass + '">' + statusLabel + '</span></div>' +
        '</div>';
      }).join('') : '<div class="cc-empty">No sales or payouts yet.</div>';
    }

    const referredUsers = document.getElementById('referredUsers');
    if (referredUsers) {
      referredUsers.innerHTML = referred.length ? referred.map(user => {
        const state = activityState(user);
        const completeForUser = bonuses
          .filter(b => b.referred_user_id === user.user_id && b.status === 'complete')
          .reduce((sum,b) => sum + (Number(b.amount_cents) || 0), 0);

        const pendingForUser = bonuses
          .filter(b => b.referred_user_id === user.user_id && b.status === 'pending')
          .reduce((sum,b) => sum + (Number(b.amount_cents) || 0), 0);

        const display = user.display_name || user.email || 'User';
        const initials = display
          .split(/\\s+/)
          .filter(Boolean)
          .slice(0,2)
          .map(part => part[0])
          .join('')
          .toUpperCase();

        let moneyText = 'No referral earnings yet';
        if (completeForUser) moneyText = money(completeForUser) + ' earned';
        else if (pendingForUser) moneyText = money(pendingForUser) + ' pending';

        return '<div class="user-row">' +
          '<div class="user-avatar">' + esc(initials || 'U') + '</div>' +
          '<div class="user-info"><strong>' + esc(display) + '</strong><small>Joined ' + new Date(user.created_at).toLocaleDateString() + '</small></div>' +
          '<div class="user-side"><span class="badge ' + (state.label === 'Active' ? 'active' : state.label === 'Disabled' ? 'pending' : 'pending') + '">' + state.label + '</span><small>' + moneyText + '</small></div>' +
        '</div>';
      }).join('') : '<div class="cc-empty">No direct referrals yet.</div>';
    }

    const copyButton = document.getElementById('copyReferralCode');
    if (copyButton) {
      copyButton.onclick = async () => {
        try { await navigator.clipboard.writeText(profile.referral_code || ''); } catch {}
        if (window.showToast) window.showToast('Referral code copied');
      };
    }

    const shareButton = document.getElementById('shareReferral');
    if (shareButton) {
      shareButton.onclick = async () => {
        const text = 'Join with my referral code: ' + (profile.referral_code || '');
        if (navigator.share) {
          try {
            await navigator.share({ title:'Invite & Earn', text });
            return;
          } catch {}
        }
        try { await navigator.clipboard.writeText(text); } catch {}
        if (window.showToast) window.showToast('Invite copied');
      };
    }

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

  function renderSetupRequired(error) {
    const main = document.querySelector('main.content');
    if (!main) return;
    const page = document.title;
    if (!['Earnings','Account'].includes(page)) return;

    if (page === 'Earnings') {
      const state = document.getElementById('earningsState');
      if (state) {
        state.style.display = '';
        state.innerHTML = '<strong>Live data is unavailable.</strong><div class="cc-muted" style="margin-top:6px">' + esc(error?.message || 'Unable to connect to the earnings tables.') + '</div>';
      }
      return;
    }

    main.innerHTML = `
      <section class="cc-live-card" style="text-align:center;padding:24px 18px">
        <i data-lucide="database-zap" style="width:34px;height:34px;color:#d27b20"></i>
        <h3 style="margin:10px 0 6px">Live data setup required</h3>
        <p class="cc-muted" style="margin:0">This page is connected to Supabase, but the call-center tables are not available yet.</p>
      </section>`;
    window.lucide?.createIcons();
  }

  async function init() {
    addStyles();
    const { session, profile, schemaReady, schemaError } = await getSessionAndProfile();
    if (!session) return;
    if (!schemaReady || !profile) {
      renderSetupRequired(schemaError);
      return;
    }

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