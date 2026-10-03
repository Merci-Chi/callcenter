const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signHmacSha256(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)),
  );
}

function jwtSubjectFromAuthorization(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) return '';

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    return String(payload.sub || '');
  } catch {
    return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
    const apiKeySid = Deno.env.get('TWILIO_API_KEY_SID') || '';
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET') || '';
    const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID') || '';

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      throw new Error('Twilio Voice secrets are not configured.');
    }

    // Deploy this function with Supabase JWT verification ON.
    // The gateway validates the Authorization header before this code runs.
    const userId = jwtSubjectFromAuthorization(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Sign in again before calling.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const identity = 'user_' + userId.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 100);
    const now = Math.floor(Date.now() / 1000);
    const ttl = 3600;

    const header = {
      typ: 'JWT',
      alg: 'HS256',
      cty: 'twilio-fpa;v=1',
    };

    const payload = {
      jti: apiKeySid + '-' + crypto.randomUUID(),
      grants: {
        identity,
        voice: {
          outgoing: {
            application_sid: twimlAppSid,
          },
        },
      },
      iat: now,
      exp: now + ttl,
      iss: apiKeySid,
      sub: accountSid,
    };

    const unsigned =
      base64Url(JSON.stringify(header)) + '.' + base64Url(JSON.stringify(payload));
    const signature = base64Url(await signHmacSha256(unsigned, apiKeySecret));
    const token = unsigned + '.' + signature;

    return new Response(JSON.stringify({ token, identity, expires_in: ttl }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to create Twilio token.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
