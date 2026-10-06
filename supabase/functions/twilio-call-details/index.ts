import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asIso(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Supabase server configuration is missing." }, 500);
    }
    if (!twilioAccountSid || !twilioAuthToken) {
      return json({ ok: false, error: "Twilio server configuration is missing." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ ok: false, error: "Missing authorization token." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData?.user?.id) {
      return json({ ok: false, error: "Invalid or expired session." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const activityId = String(body?.activity_id || "").trim();
    const callSid = String(body?.call_sid || "").trim();

    if (!activityId || !callSid) {
      return json({ ok: false, error: "activity_id and call_sid are required." }, 400);
    }

    const { data: activity, error: activityError } = await admin
      .from("callcenter_call_activity")
      .select("id,user_id,call_sid")
      .eq("id", activityId)
      .maybeSingle();

    if (activityError) return json({ ok: false, error: activityError.message }, 500);
    if (!activity) return json({ ok: false, error: "Call activity was not found." }, 404);

    if (String(activity.user_id) !== String(userData.user.id)) {
      return json({ ok: false, error: "You cannot inspect another user's call." }, 403);
    }

    if (String(activity.call_sid || "") !== callSid) {
      return json({ ok: false, error: "CallSid does not match the saved activity." }, 400);
    }

    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const twilioHeaders = { Authorization: `Basic ${auth}` };

    const parentUrl =
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioAccountSid)}/Calls/${encodeURIComponent(callSid)}.json`;

    const parentResponse = await fetch(parentUrl, { headers: twilioHeaders });
    const parent = await parentResponse.json().catch(() => ({}));

    if (!parentResponse.ok) {
      return json({
        ok: false,
        code: parent?.code || parentResponse.status,
        error: parent?.message || "Unable to load the Twilio call.",
      }, 502);
    }

    const childrenUrl = new URL(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioAccountSid)}/Calls.json`
    );
    childrenUrl.searchParams.set("ParentCallSid", callSid);
    childrenUrl.searchParams.set("PageSize", "20");

    const childrenResponse = await fetch(childrenUrl, { headers: twilioHeaders });
    const childrenJson = await childrenResponse.json().catch(() => ({}));
    const children = Array.isArray(childrenJson?.calls) ? childrenJson.calls : [];

    const pstnLeg =
      children.find((row: any) => /^\+[1-9]\d{7,14}$/.test(String(row?.from || ""))) ||
      children.find((row: any) => /^\+[1-9]\d{7,14}$/.test(String(row?.to || ""))) ||
      null;

    const source = pstnLeg || parent;
    const callerIdUsed =
      /^\+[1-9]\d{7,14}$/.test(String(source?.from || ""))
        ? String(source.from)
        : null;

    const twilioDuration = Number(source?.duration);
    const update: Record<string, unknown> = {
      caller_id_used: callerIdUsed,
      connected_at: asIso(source?.start_time) || asIso(parent?.start_time),
      ended_at: asIso(source?.end_time) || asIso(parent?.end_time),
    };

    if (Number.isFinite(twilioDuration) && twilioDuration >= 0) {
      update.duration_seconds = twilioDuration;
    }

    const { data: updated, error: updateError } = await admin
      .from("callcenter_call_activity")
      .update(update)
      .eq("id", activityId)
      .select("id,user_id,crm_id,duration_seconds,outcome,call_sid,caller_id_used,connected_at,ended_at,created_at")
      .single();

    if (updateError) return json({ ok: false, error: updateError.message }, 500);

    return json({
      ok: true,
      activity: updated,
      twilio: {
        parent_call_sid: callSid,
        pstn_call_sid: pstnLeg?.sid || null,
        caller_id_used: callerIdUsed,
      },
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
