const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-twilio-signature',
};

function base64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function verifyTwilioSignature(
  url: string,
  params: URLSearchParams,
  signature: string,
  authToken: string,
) {
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  let payload = url;
  for (const [key, value] of sorted) payload += key + value;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return base64(digest) === signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!authToken || !supabaseUrl || !serviceRoleKey) {
      throw new Error('Transcription webhook secrets are not configured.');
    }

    const raw = await req.text();
    const params = new URLSearchParams(raw);
    const signature = req.headers.get('x-twilio-signature') || '';

    const canonicalCallbackUrl =
      supabaseUrl.replace(/\/$/, '') + '/functions/v1/twilio-transcription-webhook';
    const configuredCallbackUrl = Deno.env.get('TWILIO_TRANSCRIPTION_CALLBACK_URL') || '';

    const callbackCandidates = [
      configuredCallbackUrl,
      canonicalCallbackUrl,
      req.url,
    ].filter((value, index, list) => value && list.indexOf(value) === index);

    let signatureValid = false;
    if (signature) {
      for (const callbackUrl of callbackCandidates) {
        if (await verifyTwilioSignature(callbackUrl, params, signature, authToken)) {
          signatureValid = true;
          break;
        }
      }
    }

    if (!signatureValid) {
      console.warn('Rejected Twilio transcription webhook with invalid signature.', {
        event: params.get('TranscriptionEvent') || '',
        callSid: params.get('CallSid') || '',
      });
      return new Response('Forbidden', { status: 403 });
    }

    const event = params.get('TranscriptionEvent') || '';
    const diagnosticCallSid = params.get('CallSid') || '';
    const diagnosticTranscriptionSid = params.get('TranscriptionSid') || '';

    async function storeDiagnostic(message: string) {
      if (!diagnosticCallSid || !message) return false;
      const response = await fetch(
        supabaseUrl + '/rest/v1/callcenter_live_transcript_events',
        {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: 'Bearer ' + serviceRoleKey,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            call_sid: diagnosticCallSid,
            transcription_sid: diagnosticTranscriptionSid || null,
            track: 'system',
            speaker: 'system',
            text: message,
            is_final: true,
          }),
        },
      );
      if (!response.ok) {
        console.error('Unable to store transcription diagnostic:', response.status, await response.text());
        return false;
      }
      return true;
    }

    if (event === 'transcription-error') {
      const errorCode =
        params.get('TranscriptionErrorCode') ||
        params.get('ErrorCode') ||
        '';
      const errorMessage =
        params.get('TranscriptionError') ||
        params.get('ErrorMessage') ||
        'Twilio reported a realtime transcription error.';

      console.error('Twilio realtime transcription error:', {
        callSid: diagnosticCallSid,
        transcriptionSid: diagnosticTranscriptionSid,
        errorCode,
        errorMessage,
      });

      await storeDiagnostic(
        'ERROR' + (errorCode ? ' ' + errorCode : '') + ': ' + errorMessage
      );
      return new Response('ok', { status: 200 });
    }

    if (event === 'transcription-started') {
      console.log('Twilio realtime transcription started:', {
        callSid: diagnosticCallSid,
        transcriptionSid: diagnosticTranscriptionSid,
      });
      await storeDiagnostic(
        'Twilio transcription started' +
        (diagnosticTranscriptionSid ? ' (' + diagnosticTranscriptionSid + ')' : '') +
        '. Waiting for speech.'
      );
      return new Response('ok', { status: 200 });
    }

    if (event === 'transcription-stopped') {
      console.log('Twilio realtime transcription stopped:', {
        callSid: diagnosticCallSid,
        transcriptionSid: diagnosticTranscriptionSid,
      });
      await storeDiagnostic('Twilio transcription stopped.');
      return new Response('ok', { status: 200 });
    }

    if (event !== 'transcription-content') {
      console.log('Twilio realtime transcription event:', {
        event,
        callSid: diagnosticCallSid,
        transcriptionSid: diagnosticTranscriptionSid,
      });
      await storeDiagnostic('Twilio callback received: ' + (event || 'unknown event'));
      return new Response('ok', { status: 200 });
    }

    const callSid = params.get('CallSid') || '';
    const transcriptionSid = params.get('TranscriptionSid') || '';
    const sequenceId = Number(params.get('SequenceId') || 0);
    const track = params.get('Track') || '';
    const finalValue = String(params.get('Final') || '').toLowerCase();
    const isFinal = finalValue === 'true' || finalValue === '1';

    let transcript = '';
    let confidence: number | null = null;

    try {
      const data = JSON.parse(params.get('TranscriptionData') || '{}');
      transcript = String(data?.transcript || '').trim();
      const numericConfidence = Number(data?.confidence);
      if (Number.isFinite(numericConfidence)) confidence = numericConfidence;
    } catch {
      transcript = '';
    }

    if (!callSid || !transcript) {
      return new Response('ok', { status: 200 });
    }

    // This transcription runs on the browser/agent call leg.
    // inbound_track = audio Twilio receives from the browser agent.
    // outbound_track = audio Twilio sends back to the browser, including the callee.
    const speaker =
      track === 'inbound_track' ? 'agent' :
      track === 'outbound_track' ? 'customer' :
      'unknown';

    const timestamp = params.get('Timestamp') || null;
    const stabilityNumber = Number(params.get('Stability'));
    const stability = Number.isFinite(stabilityNumber) ? stabilityNumber : null;

    const response = await fetch(
      supabaseUrl + '/rest/v1/callcenter_live_transcript_events',
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: 'Bearer ' + serviceRoleKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          call_sid: callSid,
          transcription_sid: transcriptionSid || null,
          sequence_id: sequenceId || null,
          track,
          speaker,
          text: transcript,
          is_final: isFinal,
          stability,
          confidence,
          occurred_at: timestamp,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error('Unable to store live transcript event:', response.status, body);
      return new Response('Database error', { status: 500 });
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Webhook error', { status: 500 });
  }
});
