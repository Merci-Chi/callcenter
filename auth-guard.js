// Checks the authenticated session on every non-login screen.
(() => {
  if (location.pathname.endsWith('/login.html')) return;
  document.documentElement.classList.add('auth-checking');
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (!window.supabase) throw new Error('Sign-in library unavailable');
      const client = window.steadyHandsCRMClient || window.supabase.createClient(
        'https://glonbvrcudwuzjundrii.supabase.co',
        'sb_publishable_VZbed_uuOXSE744UrAfHXw_z2xDdYtr'
      );
      window.steadyHandsCRMClient=client;
      const { data, error }=await client.auth.getSession();
      if(error) throw error;
      if(!data.session){location.replace('login.html');return;}
      document.documentElement.classList.remove('auth-checking');
    }catch(e){
      console.error('Login check failed:',e);
      location.replace('login.html');
    }
  });
})();
