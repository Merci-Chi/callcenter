const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
};

function xmlEscape(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeE164(value: string) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const callerId = Deno.env.get('TWILIO_CALLER_ID') || '';

  try {
    const bodyText = await req.text();
    const contentType = req.headers.get('content-type') || '';
    let params: URLSearchParams;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      params = new URLSearchParams(bodyText);
    } else {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(bodyText || '{}'); } catch {}
      params = new URLSearchParams();
      for (const [key, value] of Object.entries(parsed)) {
        params.set(key, String(value ?? ''));
      }
    }

    const destination = normalizeE164(params.get('To') || params.get('to') || '');
    const transcribe = /^(1|true|yes)$/i.test(params.get('transcribe') || '');
    const crmId = String(params.get('crm_id') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);

    if (!/^\+[1-9]\d{7,14}$/.test(destination)) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>The destination number is invalid.</Say></Response>',
        { headers: { 'Content-Type': 'text/xml; charset=utf-8' } },
      );
    }

    const callbackUrl =
      Deno.env.get('TWILIO_TRANSCRIPTION_CALLBACK_URL') ||
      (Deno.env.get('SUPABASE_URL') || '') + '/functions/v1/twilio-transcription-webhook';

    const callerIdAttribute = callerId
      ? ' callerId="' + xmlEscape(callerId) + '"'
      : '';

    const transcription = transcribe && callbackUrl
      ? '<Start><Transcription' +
          ' statusCallbackUrl="' + xmlEscape(callbackUrl) + '"' +
          ' track="both_tracks"' +
          ' inboundTrackLabel="customer"' +
          ' outboundTrackLabel="agent"' +
          ' languageCode="en-US"' +
          ' partialResults="true"' +
          ' enableAutomaticPunctuation="true"' +
          ' transcriptionEngine="auto"' +
          (crmId ? ' name="' + xmlEscape('crm_' + crmId) + '"' : '') +
        '/></Start>'
      : '';

    const twiml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
        transcription +
        '<Dial answerOnBridge="true"' + callerIdAttribute + '>' +
          '<Number>' + xmlEscape(destination) + '</Number>' +
        '</Dial>' +
      '</Response>';

    return new Response(twiml, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>The call could not be started.</Say></Response>',
      { status: 500, headers: { 'Content-Type': 'text/xml; charset=utf-8' } },
    );
  }
});
