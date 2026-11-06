import "dotenv/config";

const response = await fetch(
  "https://openrouter.ai/api/v1/key",
  {
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY.trim()}`
    }
  }
);

const result = await response.json();

console.log(JSON.stringify(result, null, 2)); 