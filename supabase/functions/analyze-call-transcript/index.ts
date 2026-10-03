import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const jsonHeaders = { "Content-Type": "application/json" };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

function clampScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function cleanStringArray(value: unknown, limit = 5) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  if (!OPENAI_API_KEY) {
    return response({ error: "OPENAI_API_KEY is not configured" }, 500);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return response({ error: "Missing authorization" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const {
      data: { user },
      error: userError
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return response({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const transcriptId = String(body?.transcript_id || "").trim();

    if (!transcriptId) {
      return response({ error: "transcript_id is required" }, 400);
    }

    const { data: transcript, error: transcriptError } = await userClient
      .from("callcenter_transcripts")
      .select("id,user_id,company,contact,duration_seconds,transcript,segments,outcome,created_at")
      .eq("id", transcriptId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (transcriptError) {
      console.error("Transcript query failed:", transcriptError);
      return response({ error: transcriptError.message }, 500);
    }

    if (!transcript) {
      return response({ error: "Transcript not found" }, 404);
    }

    const transcriptText = String(transcript.transcript || "").trim();

    if (!transcriptText) {
      return response({
        ok: true,
        skipped: true,
        reason: "No transcript text was captured"
      });
    }

    const prompt = [
      "You are a sales-call coach for a small-business website outreach team.",
      "Analyze only the evidence contained in the transcript and call outcome.",
      "Do not invent customer statements, tone, or facts that are not present.",
      "The transcript may contain only the salesperson's microphone side, so do not claim to know the customer's tone or exact words unless present.",
      "Return ONLY valid JSON. No markdown, no code fences.",
      "",
      "Required JSON shape:",
      JSON.stringify({
        summary: "1-3 sentence concise coaching summary",
        strengths: ["specific strength"],
        improvements: ["specific improvement"],
        sentiment: "positive | neutral | negative | mixed",
        scores: {
          opening: 0,
          questions: 0,
          pricing: 0,
          objection_handling: 0,
          closing: 0
        }
      }),
      "",
      "Scoring rules:",
      "- Scores must be integers from 0 to 100.",
      "- If there is not enough evidence for a category, use 50 rather than guessing.",
      "- Strengths and improvements should each have no more than 4 items.",
      "- Feedback should be practical and specific.",
      "",
      `Company: ${transcript.company || "Unknown"}`,
      `Call duration seconds: ${transcript.duration_seconds || 0}`,
      `Recorded outcome: ${transcript.outcome || "Unknown"}`,
      "",
      "Transcript:",
      transcriptText.slice(0, 20000)
    ].join("\n");

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        input: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_output_tokens: 900,
        store: false
      })
    });

    const aiData = await aiResponse.json().catch(() => ({}));

    if (!aiResponse.ok) {
      console.error("OpenAI request failed:", aiData);
      return response({
        error: aiData?.error?.message || "Transcript analysis failed"
      }, 500);
    }

    const outputText =
      aiData?.output_text ||
      (Array.isArray(aiData?.output)
        ? aiData.output
            .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
            .filter((part: any) => part?.type === "output_text")
            .map((part: any) => part?.text || "")
            .join("\n")
        : "");

    if (!outputText) {
      return response({ error: "The analysis returned no text" }, 500);
    }

    let parsed: any;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      const match = outputText.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("Invalid analysis JSON:", outputText);
        return response({ error: "The analysis returned invalid JSON" }, 500);
      }

      try {
        parsed = JSON.parse(match[0]);
      } catch {
        console.error("Invalid analysis JSON:", outputText);
        return response({ error: "The analysis returned invalid JSON" }, 500);
      }
    }

    const sentimentRaw = String(parsed?.sentiment || "neutral").toLowerCase();
    const sentiment = ["positive", "neutral", "negative", "mixed"].includes(sentimentRaw)
      ? sentimentRaw
      : "neutral";

    const feedback = {
      transcript_id: transcript.id,
      user_id: user.id,
      summary: String(parsed?.summary || "").trim().slice(0, 2000),
      strengths: cleanStringArray(parsed?.strengths, 4),
      improvements: cleanStringArray(parsed?.improvements, 4),
      sentiment,
      scores: {
        opening: clampScore(parsed?.scores?.opening),
        questions: clampScore(parsed?.scores?.questions),
        pricing: clampScore(parsed?.scores?.pricing),
        objection_handling: clampScore(parsed?.scores?.objection_handling),
        closing: clampScore(parsed?.scores?.closing)
      },
      updated_at: new Date().toISOString()
    };

    const { data: saved, error: saveError } = await admin
      .from("callcenter_call_feedback")
      .upsert(feedback, {
        onConflict: "transcript_id"
      })
      .select("id,transcript_id,summary,strengths,improvements,sentiment,scores,created_at,updated_at")
      .single();

    if (saveError) {
      console.error("Unable to save feedback:", saveError);
      return response({ error: saveError.message }, 500);
    }

    return response({
      ok: true,
      feedback: saved
    });
  } catch (error: any) {
    console.error("analyze-call-transcript fatal error:", error);
    return response({
      error: error?.message || "Unknown server error"
    }, 500);
  }
});
