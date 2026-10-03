const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
};

function xmlEscape(value: string) {
  return value
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
  if (!callerId) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Calling is not configured.</Say></Response>',
      { status: 500, headers: { 'Content-Type': 'text/xml; charset=utf-8' } },
    );
  }

  try {
    const bodyText = await req.text();
    const contentType = req.headers.get('content-type') || '';
    let to = '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      to = new URLSearchParams(bodyText).get('To') || '';
    } else {
      try {
        const parsed = JSON.parse(bodyText || '{}');
        to = String(parsed.To || parsed.to || '');
      } catch {
        to = '';
      }
    }

    const destination = normalizeE164(to);

    if (!/^\+[1-9]\d{7,14}$/.test(destination)) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>The destination number is invalid.</Say></Response>',
        { headers: { 'Content-Type': 'text/xml; charset=utf-8' } },
      );
    }

    const twiml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
        '<Dial answerOnBridge="true" callerId="' + xmlEscape(callerId) + '">' +
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
