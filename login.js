(() => {
  const url = 'https://glonbvrcudwuzjundrii.supabase.co';
  const key = 'sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr';
  const form = document.getElementById('loginForm');
  const message = document.getElementById('loginMessage');
  const button = document.getElementById('signInButton');
  const password = document.getElementById('loginPassword');
  const eye = document.getElementById('showPassword');
  window.lucide?.createIcons();
  eye.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    eye.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    eye.innerHTML = visible ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
    window.lucide?.createIcons();
  });
  let client;
  try {
    if (!window.supabase) throw new Error('Authentication library unavailable');
    client = window.supabase.createClient(url, key);
    client.auth.getSession().then(({data,error})=>{
      if(error)throw error;
      if(data.session) location.replace('index.html');
    }).catch(e=>console.error('Session check:',e));
  } catch(e){console.error('Login setup:',e); message.textContent='Unable to connect. Please try again.';}
  form.addEventListener('submit', async event=>{
    event.preventDefault();
    if (!client) { message.textContent='Unable to connect. Please try again.';return; }
    button.disabled=true;
    message.textContent='Signing in...';
    try {
      const {error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:password.value});
      if(error) throw error;
      location.replace('index.html');
    }catch(error){
      console.error('Sign-in failed:', error);
      message.textContent='Unable to sign in. Check your email and password.';
      button.disabled=false;
    }
  });
})();
