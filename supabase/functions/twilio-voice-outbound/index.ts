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

  const fallbackCallerId = Deno.env.get('TWILIO_CALLER_ID') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
    if (!/^\+[1-9]\d{7,14}$/.test(destination)) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>The destination number is invalid.</Say></Response>',
        { headers: { 'Content-Type': 'text/xml; charset=utf-8' } },
      );
    }

    const agentUserId = String(params.get('agent_user_id') || '').trim();
    let callerId = fallbackCallerId;

    if (
      supabaseUrl &&
      serviceRoleKey &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(agentUserId)
    ) {
      try {
        const assignmentResponse = await fetch(
          supabaseUrl.replace(/\/$/, '') +
            '/rest/v1/callcenter_phone_assignments?user_id=eq.' +
            encodeURIComponent(agentUserId) +
            '&select=phone_number_id&limit=1',
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: 'Bearer ' + serviceRoleKey,
            },
          },
        );

        if (assignmentResponse.ok) {
          const assignments = await assignmentResponse.json();
          const phoneNumberId = assignments?.[0]?.phone_number_id || '';

          if (phoneNumberId) {
            const phoneResponse = await fetch(
              supabaseUrl.replace(/\/$/, '') +
                '/rest/v1/callcenter_phone_numbers?id=eq.' +
                encodeURIComponent(phoneNumberId) +
                '&active=eq.true&select=phone_number&limit=1',
              {
                headers: {
                  apikey: serviceRoleKey,
                  Authorization: 'Bearer ' + serviceRoleKey,
                },
              },
            );

            if (phoneResponse.ok) {
              const phoneRows = await phoneResponse.json();
              const assigned = normalizeE164(phoneRows?.[0]?.phone_number || '');
              if (/^\+[1-9]\d{7,14}$/.test(assigned)) {
                callerId = assigned;
              }
            }
          }
        }
      } catch (assignmentError) {
        console.warn('Unable to resolve assigned caller ID; using fallback.', assignmentError);
      }
    }

    const callerIdAttribute = callerId
      ? ' callerId="' + xmlEscape(callerId) + '"'
      : '';

    const twiml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
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
