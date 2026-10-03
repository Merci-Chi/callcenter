import { Device } from 'https://esm.sh/@twilio/voice-sdk@2.18.5';

let device = null;
let activeCall = null;
let tokenRefreshPromise = null;

function emit(state, extra = {}) {
  window.dispatchEvent(new CustomEvent('steadyhands:voice-state', {
    detail: { state, ...extra }
  }));
}

function cleanNumber(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}

async function fetchToken() {
  const client = window.steadyHandsCRMClient;
  if (!client) throw new Error('The signed-in CRM session is not ready yet.');

  const { data, error } = await client.functions.invoke('twilio-voice-token', {
    body: {}
  });

  if (error) throw error;
  if (!data?.token) throw new Error(data?.error || 'Twilio token was not returned.');
  return data.token;
}

async function refreshToken() {
  if (tokenRefreshPromise) return tokenRefreshPromise;

  tokenRefreshPromise = (async () => {
    const token = await fetchToken();
    if (device) device.updateToken(token);
    return token;
  })();

  try {
    return await tokenRefreshPromise;
  } finally {
    tokenRefreshPromise = null;
  }
}

async function ensureDevice() {
  if (device) return device;

  const token = await fetchToken();

  device = new Device(token, {
    logLevel: 'warn',
    closeProtection: true
  });

  device.on('error', error => {
    console.error('Twilio Device error:', error);
    emit('error', {
      code: error?.code || '',
      message: error?.message || 'The browser phone encountered an error.'
    });
  });

  device.on('tokenWillExpire', () => {
    refreshToken().catch(error => {
      console.error('Unable to refresh Twilio token:', error);
    });
  });

  return device;
}

function bindCall(call) {
  const finish = (reason = 'ended') => {
    if (activeCall === call) activeCall = null;
    emit('ended', { reason });
  };

  call.on('ringing', () => emit('ringing'));
  call.on('accept', () => emit('connected'));

  call.on('disconnect', () => finish('disconnect'));
  call.on('cancel', () => finish('cancel'));
  call.on('reject', () => finish('reject'));

  call.on('error', error => {
    console.error('Twilio Call error:', error);
    emit('error', {
      code: error?.code || '',
      message: error?.message || 'The call could not be completed.'
    });
    finish('error');
  });
}

async function start(destination, metadata = {}) {
  if (activeCall) throw new Error('A call is already active.');

  const to = cleanNumber(destination);
  if (!/^\+[1-9]\d{7,14}$/.test(to)) {
    throw new Error('This lead does not have a valid phone number.');
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support microphone calling.');
  }

  const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  permissionStream.getTracks().forEach(track => track.stop());

  const readyDevice = await ensureDevice();
  emit('calling');

  const params = {
    To: to,
    crm_id: String(metadata.crmId || ''),
    company: String(metadata.company || '').slice(0, 80)
  };

  const call = await readyDevice.connect({ params });
  activeCall = call;
  bindCall(call);
  return call;
}

function hangup() {
  if (!activeCall) return;
  try {
    activeCall.disconnect();
  } catch (error) {
    console.warn('Unable to disconnect Twilio call:', error);
  }
}

function setMuted(muted) {
  if (!activeCall) return false;
  activeCall.mute(Boolean(muted));
  return activeCall.isMuted?.() ?? Boolean(muted);
}

function isActive() {
  return Boolean(activeCall);
}

window.SteadyHandsTwilioVoice = {
  start,
  hangup,
  setMuted,
  isActive,
  refreshToken
};
