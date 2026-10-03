import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:kiara@steadyhandsop.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function reminderCopy(minutes: number, company: string, startsAt: string) {
  const name = company || "this lead";
  const time = new Date(startsAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles"
  });

  if (minutes === 60) return { title: "Call in 1 hour", body: `Your call with ${name} is in 1 hour at ${time}.` };
  if (minutes === 30) return { title: "Call in 30 minutes", body: `Your call with ${name} is in 30 minutes at ${time}.` };
  if (minutes === 10) return { title: "Call in 10 minutes", body: `Your call with ${name} is in 10 minutes at ${time}.` };
  if (minutes === 5) return { title: "Call in 5 minutes", body: `Your call with ${name} is in 5 minutes at ${time}.` };
  return { title: "Scheduled call is due", body: `It's time to call ${name}.` };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const suppliedSecret = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || suppliedSecret !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const lower = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
  const upper = new Date(now.getTime() + 20 * 1000).toISOString();

  const { data: reminders, error: reminderError } = await supabase
    .from("callcenter_scheduled_reminders")
    .select("id,user_id,reminder_minutes,due_at,callcenter_scheduled_calls!inner(id,crm_id,company,starts_at,active)")
    .is("sent_at", null)
    .gte("due_at", lower)
    .lte("due_at", upper)
    .eq("callcenter_scheduled_calls.active", true)
    .limit(200);

  if (reminderError) {
    return new Response(JSON.stringify({ error: reminderError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const userIds = [...new Set((reminders || []).map((row: any) => row.user_id).filter(Boolean))];
  let subscriptions: any[] = [];

  if (userIds.length) {
    const { data, error } = await supabase
      .from("callcenter_push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", userIds);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    subscriptions = data || [];
  }

  const byUser = new Map<string, any[]>();

  for (const subscription of subscriptions) {
    const list = byUser.get(subscription.user_id) || [];
    list.push(subscription);
    byUser.set(subscription.user_id, list);
  }

  let sent = 0;
  let removed = 0;

  for (const reminder of reminders || []) {
    const scheduled = Array.isArray((reminder as any).callcenter_scheduled_calls)
      ? (reminder as any).callcenter_scheduled_calls[0]
      : (reminder as any).callcenter_scheduled_calls;

    if (!scheduled) continue;

    const targets = byUser.get((reminder as any).user_id) || [];
    if (!targets.length) continue;

    const copy = reminderCopy(
      Number((reminder as any).reminder_minutes),
      scheduled.company || "",
      scheduled.starts_at
    );

    const payload = JSON.stringify({
      title: copy.title,
      body: copy.body,
      tag: `scheduled-call-${scheduled.id}-${(reminder as any).reminder_minutes}`,
      url: scheduled.crm_id
        ? `index.html?crm_id=${encodeURIComponent(scheduled.crm_id)}`
        : "index.html",
      crm_id: scheduled.crm_id,
      reminder_minutes: (reminder as any).reminder_minutes
    });

    let delivered = false;

    for (const subscription of targets) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          payload,
          { TTL: 300 }
        );

        delivered = true;
        sent++;
      } catch (error: any) {
        const statusCode = error?.statusCode || error?.status;

        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("callcenter_push_subscriptions")
            .delete()
            .eq("id", subscription.id);

          removed++;
        }
      }
    }

    if (delivered) {
      await supabase
        .from("callcenter_scheduled_reminders")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", (reminder as any).id)
        .is("sent_at", null);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      due: reminders?.length || 0,
      sent,
      removed
    }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
});
