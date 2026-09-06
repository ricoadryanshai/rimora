export type AiProvider = {
  endpoint: string;
  apiKey: string;
  model: string;
};

export const getAiProviders = (): AiProvider[] => {
  const providers: AiProvider[] = [];
  for (const suffix of ["_1", "_2"]) {
    const endpoint = Deno.env.get(`AI_API_ENDPOINT${suffix}`);
    const apiKey = Deno.env.get(`AI_API_KEY${suffix}`);
    const model = Deno.env.get(`AI_API_MODEL${suffix}`);
    if (endpoint && apiKey && model)
      providers.push({ endpoint, apiKey, model });
  }
  return providers;
};

export const providerEndpoint = (endpoint: string) => {
  const base = endpoint.replace(/\/+$/, "");
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
};
