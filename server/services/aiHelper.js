// ============================================================
//  services/aiHelper.js
//  Core AI caller — reads config from ai.config.js
//  To switch provider/model: edit config/ai.config.js only
// ============================================================

import OpenAI from "openai";
import { AI_CONFIG, getChainForFeature } from "../config/ai.config.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Build a live provider client from config ───────────────
function buildProviders(feature) {
  const chain = getChainForFeature(feature);
  return chain
    .map((key) => {
      const p = AI_CONFIG.providers[key];
      if (!p) { console.warn(`⚠ Unknown provider "${key}" in chain`); return null; }
      const apiKey = p.apiKey();
      if (!apiKey) { console.log(`⏭ Skipping ${p.name} — no API key in .env`); return null; }
      return {
        key,
        name: p.name,
        model: p.model(),
        client: new OpenAI({ apiKey, baseURL: p.baseURL }),
      };
    })
    .filter(Boolean);
}

// ── Core caller with retry + fallback chain ────────────────
export async function callWithChain(feature, messages, temperature) {
  const temp = temperature ?? AI_CONFIG.temperature[feature] ?? 0.4;
  const { attempts, rateLimitWaitMs } = AI_CONFIG.retry;
  const providers = buildProviders(feature);

  if (providers.length === 0) {
    throw new Error("No AI providers configured. Add GROQ_API_KEY or OPENROUTER_API_KEY to .env");
  }

  for (const { client, model, name, key } of providers) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`🤖 [${name} / ${model}] feature:${feature} attempt:${attempt}`);
        const res = await client.chat.completions.create({ model, messages, temperature: temp });
        console.log(`✅ [${name}] success`);
        return res.choices[0].message.content.trim();
      } catch (err) {
        const status = err.status || err.response?.status;
        console.warn(`⚠ [${name}] failed: ${status} — ${err.message?.substring(0, 80)}`);
        if (status === 429 && attempt === 1) {
          console.log(`⏳ Rate limited on ${name}. Waiting ${rateLimitWaitMs / 1000}s...`);
          await sleep(rateLimitWaitMs);
          continue;
        }
        break; // move to next provider
      }
    }
  }

  throw new Error("All AI providers are unavailable. Wait a minute and retry.");
}

// ── Voice utilities ────────────────────────────────────────
export function cleanForVoice(text = "") {
  return text
    .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^[\s]*[-•→*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/_{1,2}(.*?)_{1,2}/g, "$1")
    .replace(/\*/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function makeVoiceFriendly(messages) {
  const voiceNote = `VOICE OUTPUT: Plain sentences only. No bullets, no markdown, no asterisks. Max 3 sentences.`;
  const hasSystem = messages[0]?.role === "system";
  if (hasSystem) {
    return [{ role: "system", content: messages[0].content + "\n\n" + voiceNote }, ...messages.slice(1)];
  }
  return [{ role: "system", content: voiceNote }, ...messages];
}

// ── JSON parser helper ─────────────────────────────────────
export function parseJSON(raw) {
  // Try direct
  try { return JSON.parse(raw.trim()); } catch {}
  // Strip markdown fences
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch {}
  // Extract first { } block
  try { const m = raw.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
  return null;
}

// ── Public feature functions ───────────────────────────────
export async function callResumeAI(messages)    { return callWithChain("resume",    messages); }
export async function callChatAI(messages)      { return callWithChain("chat",      messages); }
export async function callResearchAI(messages)  { return callWithChain("research",  messages); }
export async function callRoadmapAI(messages)   { return callWithChain("roadmap",   messages); }

export async function callInterviewAI(messages) {
  const raw = await callWithChain("interview", makeVoiceFriendly(messages));
  return cleanForVoice(raw);
}

// Agent sub-task callers — each maps to its own chain in ai.config.js
export async function callAgentPlan(messages)     { return callWithChain("agent_plan",     messages); }
export async function callAgentAssess(messages)   { return callWithChain("agent_assess",   messages); }
export async function callAgentQuestion(messages) { return callWithChain("agent_question", messages); }
export async function callAgentFeedback(messages) { return callWithChain("agent_feedback", messages); }
export async function callAgentAdapt(messages)    { return callWithChain("agent_adapt",    messages); }

// Backwards-compat default export used by older services
export async function callAI(messages) { return callWithChain("research", messages); }
