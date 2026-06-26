// services/aiService.js
// -------------------------------------------------------
// Multi-provider AI service with automatic fallback
// Priority: Primary provider → fallback chain → error
// Change AI_PROVIDER in .env to switch primary provider
// -------------------------------------------------------

import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

// -------------------------------------------------------
// Provider configurations — all OpenAI-compatible
// -------------------------------------------------------
const PROVIDERS = {
  gemini: {
    name: "Gemini",
    apiKey: () => process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: () => process.env.GEMINI_MODEL || "gemini-2.0-flash",
  },
  groq: {
    name: "Groq",
    apiKey: () => process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    model: () => process.env.GROQ_MODEL || "llama-3.1-70b-versatile",
  },
  openrouter: {
    name: "OpenRouter",
    apiKey: () => process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    model: () => process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
  },
};

// Fallback order — if primary hits 429, try next in list
const FALLBACK_ORDER = ["gemini", "groq", "openrouter"];

function getClient(providerKey) {
  const p = PROVIDERS[providerKey];
  if (!p || !p.apiKey()) return null;
  return {
    client: new OpenAI({ apiKey: p.apiKey(), baseURL: p.baseURL }),
    model: p.model(),
    name: p.name,
  };
}

// Build fallback chain: primary first, then others that have keys
function getFallbackChain() {
  const primary = process.env.AI_PROVIDER || "gemini";
  const chain = [primary, ...FALLBACK_ORDER.filter(p => p !== primary)];
  return chain.map(getClient).filter(Boolean); // skip providers with no key
}

// -------------------------------------------------------
// Sleep helper
// -------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -------------------------------------------------------
// Call AI with retry + automatic provider fallback
// -------------------------------------------------------
async function callWithFallback(messages) {
  const chain = getFallbackChain();

  if (chain.length === 0) {
    throw new Error("No AI provider configured. Add at least one API key to .env");
  }

  for (const { client, model, name } of chain) {
    // Try each provider up to 2 times before moving to next
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`🤖 Trying ${name} (attempt ${attempt})...`);
        const response = await client.chat.completions.create({
          model,
          messages,
          temperature: 0.3,
        });
        console.log(`✅ Success with ${name}`);
        return response;
      } catch (err) {
        const is429 = err.status === 429 || err.message?.includes("429");
        console.warn(`⚠️ ${name} failed: ${err.status || err.message}`);

        if (is429 && attempt === 1) {
          // Wait 8 seconds then retry same provider once
          console.log(`⏳ Rate limited on ${name}. Waiting 8s before retry...`);
          await sleep(8000);
          continue;
        }
        // Move to next provider
        break;
      }
    }
  }

  throw new Error(
    "All AI providers are rate limited or unavailable. Wait 1 minute and try again, or add more provider keys to .env"
  );
}

// -------------------------------------------------------
// Main: Analyze resume and return structured JSON
// -------------------------------------------------------
export async function analyzeResume(resumeText, jobRole = "") {
  const jobContext = jobRole
    ? `The user is targeting the role: "${jobRole}". Tailor your analysis to this specific role.`
    : "Analyze for general software engineering / tech roles.";

  const prompt = `
You are an expert ATS (Applicant Tracking System) analyzer and career coach with 10+ years of experience in tech hiring.

Analyze the following resume text and return a detailed JSON report.

${jobContext}

Resume Text:
"""
${resumeText}
"""

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "ats_score": <number 0-100>,
  "overall_summary": "<2-3 sentence summary of the candidate>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "missing_skills": ["<skill 1>", "<skill 2>", "<skill 3>"],
  "improvements": [
    { "section": "<section name>", "issue": "<what's wrong>", "fix": "<specific fix>" }
  ],
  "keywords_found": ["<keyword 1>", "<keyword 2>"],
  "keywords_missing": ["<important keyword not in resume>"],
  "experience_level": "<Fresher | Junior | Mid-level | Senior>",
  "top_roles_matched": ["<role 1>", "<role 2>", "<role 3>"],
  "action_items": ["<specific action 1>", "<specific action 2>", "<specific action 3>"]
}
`;

  const response = await callWithFallback([
    { role: "user", content: prompt },
  ]);

  const raw = response.choices[0].message.content.trim();
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
