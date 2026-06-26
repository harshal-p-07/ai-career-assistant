

export const AI_CONFIG = {

 
  providers: {
    groq: {
      name: "Groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: () => process.env.GROQ_API_KEY,
     
      model: () => process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    },
    openrouter: {
      name: "OpenRouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: () => process.env.OPENROUTER_API_KEY,
      
      model: () => process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
    },
  },

  
  chains: {
    resume:    ["openrouter", "groq"],   
    chat:      ["groq",       "openrouter"],
    interview: ["groq",       "openrouter"], 
    research:  ["openrouter", "groq"],   
    roadmap:   ["openrouter", "groq"],   
    
    agent_plan:     ["groq",       "openrouter"], 
    agent_assess:   ["openrouter", "groq"],       
    agent_question: ["groq",       "openrouter"], 
    agent_feedback: ["openrouter", "groq"],      
    agent_adapt:    ["groq",       "openrouter"], 
  },

  
  temperature: {
    resume:    0.3,
    chat:      0.7,
    interview: 0.5,
    research:  0.4,
    roadmap:   0.3,
    agent:     0.4,
  },


  retry: {
    attempts: 2,
    rateLimitWaitMs: 8000,
  },

  
  serper: {
    apiKey: () => process.env.SERPER_API_KEY,
    endpoint: "https://google.serper.dev/search",
    resultsPerQuery: 5,
  },
};

export function getProviderInfo() {
  return Object.entries(AI_CONFIG.providers).map(([key, p]) => ({
    key,
    name: p.name,
    model: p.model(),
    hasKey: !!p.apiKey(),
  }));
}

export function getChainForFeature(feature) {
  return AI_CONFIG.chains[feature] || AI_CONFIG.chains.research;
}
