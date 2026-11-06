
import "dotenv/config";

const key = process.env.OPENROUTER_API_KEY?.trim();

if (!key) {
  throw new Error("OPENROUTER_API_KEY is missing");
}

const response = await fetch(
  "https://openrouter.ai/api/v1/chat/completions",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemma-4-31b-it:free",
      messages: [
        {
          role: "user",
          content: "Reply with only: OpenRouter working"
        }
      ],
      max_tokens: 50
    })
  }
);

console.log("HTTP Status:", response.status);

console.log("Retry-After:",
  response.headers.get("retry-after")
);

console.log("Rate Limit Remaining:",
  response.headers.get("x-ratelimit-remaining")
);

const result = await response.json();

console.log(
  "Response:",
  JSON.stringify(result, null, 2)
);
