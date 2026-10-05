const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
    const callbackUrl =
      Deno.env.get('TWILIO_TRANSCRIPTION_CALLBACK_URL') ||
      (Deno.env.get('SUPABASE_URL') || '') + '/functions/v1/twilio-transcription-webhook';

    if (!accountSid || !authToken || !callbackUrl) {
      throw new Error('Twilio realtime transcription is not configured.');
    }

    const body = await req.json().catch(() => ({}));
    const callSid = String(body?.call_sid || '').trim();

    if (!/^CA[0-9a-fA-F]{32}$/.test(callSid)) {
      return new Response(JSON.stringify({ error: 'Invalid CallSid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const form = new URLSearchParams();
    form.set('Track', 'both_tracks');
    form.set('StatusCallbackUrl', callbackUrl);
    form.set('StatusCallbackMethod', 'POST');
    form.set('LanguageCode', 'en-US');
    form.set('TranscriptionEngine', 'google');
    form.set('SpeechModel', 'telephony');
    form.set('PartialResults', 'true');
    form.set('InboundTrackLabel', 'customer');
    form.set('OutboundTrackLabel', 'agent');

    const auth = btoa(accountSid + ':' + authToken);
    const twilioResponse = await fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' +
        encodeURIComponent(accountSid) +
        '/Calls/' +
        encodeURIComponent(callSid) +
        '/Transcriptions.json',
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + auth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );

    const text = await twilioResponse.text();

    if (!twilioResponse.ok) {
      console.error('Twilio start transcription failed:', twilioResponse.status, text);
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch {}

      return new Response(JSON.stringify({
        ok: false,
        error: parsed?.message || 'Unable to start Twilio transcription',
        code: parsed?.code || null,
        status: twilioResponse.status,
        detail: parsed?.more_info || text,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data = {};
    try { data = JSON.parse(text); } catch {}

    return new Response(JSON.stringify({
      ok: true,
      transcription_sid: data?.sid || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unable to start transcription',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
