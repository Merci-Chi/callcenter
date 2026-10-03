(() => {
  const SUPABASE_URL = 'https://glonbvrcudwuzjundrii.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  const client = () => {
    if (!window.supabase) return null;
    if (!window.steadyHandsCRMClient) {
      window.steadyHandsCRMClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return window.steadyHandsCRMClient;
  };

  const formatPhone = value => {
    const digits = String(value || '').replace(/\D/g,'');
    const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
    if (ten.length !== 10) return value || 'No phone';
    return '(' + ten.slice(0,3) + ') ' + ten.slice(3,6) + '-' + ten.slice(6);
  };

  const formatDate = value => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  };

  async function getAdminSession() {
    const c = client();
    if (!c) return {};

    const { data:{ session } = {}, error } = await c.auth.getSession();
    if (error || !session) return {};

    const { data: permission, error: permissionError } = await c
      .from('team_permissions')
      .select('role,active')
      .eq('user_id', session.user.id)
      .maybeSingle();

    return {
      session,
      isAdmin: !permissionError && permission?.active === true && permission?.role === 'ADMIN'
    };
  }

  function denied(main) {
    main.innerHTML = `
      <section class="admin-access-denied">
        <div class="admin-access-icon"><i data-lucide="shield-x"></i></div>
        <h2>Admin access required</h2>
        <p>This page is only available to users with an active ADMIN role in Supabase.</p>
        <a href="account.html">Back to Settings</a>
      </section>`;
    window.lucide?.createIcons();
  }

  function errorState(main, message) {
    main.innerHTML = `
      <section class="admin-access-denied">
        <div class="admin-access-icon"><i data-lucide="triangle-alert"></i></div>
        <h2>Unable to load approvals</h2>
        <p>${esc(message || 'Please refresh and try again.')}</p>
        <button type="button" id="adminRetry">Try Again</button>
      </section>`;
    document.getElementById('adminRetry')?.addEventListener('click', () => location.reload());
    window.lucide?.createIcons();
  }

  async function loadApprovals(main, session) {
    const c = client();

    const { data: pending = [], error } = await c
      .from('callcenter_profiles')
      .select('user_id,display_name,email,phone,phone_verified_at,phone_approval_status,phone_approval_requested_at')
      .eq('phone_approval_status','pending')
      .not('phone_verified_at','is',null)
      .order('phone_approval_requested_at',{ascending:true});

    if (error) {
      errorState(main, error.message);
      return;
    }

    main.innerHTML = `
      <section class="admin-summary-card">
        <div class="admin-summary-icon"><i data-lucide="shield-check"></i></div>
        <div>
          <strong>Admin Access</strong>
          <span>Signed in as ${esc(session.user.email || '')}</span>
        </div>
      </section>

      <section class="admin-approval-section">
        <div class="admin-section-head">
          <div>
            <h2>Pending Approvals</h2>
            <p>Phone numbers that passed SMS verification and are waiting for an admin.</p>
          </div>
          <span class="admin-count" id="pendingApprovalCount">${pending.length}</span>
        </div>

        <div class="admin-approval-list" id="pendingApprovalList">
          ${pending.length ? pending.map(row => `
            <article class="admin-approval-card" data-user-id="${esc(row.user_id)}">
              <div class="admin-approval-user">
                <div class="admin-approval-avatar">${esc((row.display_name || row.email || 'U').trim().charAt(0).toUpperCase())}</div>
                <div class="admin-approval-copy">
                  <strong>${esc(row.display_name || 'User')}</strong>
                  <span>${esc(row.email || '')}</span>
                </div>
                <span class="admin-pending-badge">Pending</span>
              </div>

              <div class="admin-phone-box">
                <span>Verified phone number</span>
                <strong>${esc(formatPhone(row.phone))}</strong>
                <small>${row.phone_verified_at ? 'SMS verified ' + esc(formatDate(row.phone_verified_at)) : ''}</small>
              </div>

              <div class="admin-approval-actions">
                <button class="admin-reject-btn" type="button" data-admin-action="reject"><i data-lucide="x"></i>Reject</button>
                <button class="admin-approve-btn" type="button" data-admin-action="approve"><i data-lucide="check"></i>Approve</button>
              </div>
            </article>
          `).join('') : `
            <div class="admin-empty">
              <i data-lucide="circle-check-big"></i>
              <strong>No pending approvals</strong>
              <span>Verified phone numbers waiting for approval will appear here.</span>
            </div>`}
        </div>
      </section>
    `;

    const updateCount = () => {
      const remaining = main.querySelectorAll('.admin-approval-card').length;
      const count = document.getElementById('pendingApprovalCount');
      if (count) count.textContent = String(remaining);
      if (!remaining) {
        const list = document.getElementById('pendingApprovalList');
        if (list) list.innerHTML = `
          <div class="admin-empty">
            <i data-lucide="circle-check-big"></i>
            <strong>No pending approvals</strong>
            <span>Verified phone numbers waiting for approval will appear here.</span>
          </div>`;
      }
      window.lucide?.createIcons();
    };

    main.querySelectorAll('[data-admin-action]').forEach(button => {
      button.addEventListener('click', async () => {
        const card = button.closest('.admin-approval-card');
        const userId = card?.dataset.userId;
        const action = button.dataset.adminAction;
        if (!userId || !['approve','reject'].includes(action)) return;

        const buttons = card.querySelectorAll('button');
        buttons.forEach(item => item.disabled = true);

        const payload = action === 'approve'
          ? {
              phone_approval_status:'approved',
              phone_approved_at:new Date().toISOString(),
              phone_approved_by:session.user.id
            }
          : {
              phone_approval_status:'rejected',
              phone_approved_at:null,
              phone_approved_by:session.user.id
            };

        const { error:updateError } = await c
          .from('callcenter_profiles')
          .update(payload)
          .eq('user_id',userId)
          .eq('phone_approval_status','pending');

        if (updateError) {
          alert(updateError.message || 'Unable to update this approval.');
          buttons.forEach(item => item.disabled = false);
          return;
        }

        card.classList.add('admin-card-removing');
        setTimeout(() => {
          card.remove();
          updateCount();
        },180);
      });
    });

    window.lucide?.createIcons();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const main = document.getElementById('adminSettingsContent');
    if (!main) return;

    const { session, isAdmin } = await getAdminSession();
    if (!session) return;
    if (!isAdmin) {
      denied(main);
      return;
    }

    await loadApprovals(main, session);
  });
})();
