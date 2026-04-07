import type { NautalisConfig } from '../types/config.js';
import { EmbeddingService } from '../memory/embed.js';

/**
 * Factory to create an embedding service based on configuration.
 * Supports: ollama, openai, cohere, custom (any REST endpoint)
 */
export function createEmbeddingService(config: NautalisConfig): EmbeddingService {
  const { provider, model } = config.embeddings;

   switch (provider) {
     case 'ollama':
       return new EmbeddingService({
         baseUrl: config.embeddings.ollama?.url || 'http://localhost:11434',
         model,
       });

     case 'openai': {
       const openaiKey = process.env[config.embeddings.openai?.apiKeyEnv || 'OPENAI_API_KEY'];
       if (!openaiKey) {
         throw new Error(`OpenAI API key not found in env var: ${config.embeddings.openai?.apiKeyEnv || 'OPENAI_API_KEY'}`);
       }
       return new EmbeddingService({
         baseUrl: 'https://api.openai.com/v1',
         model: config.embeddings.openai?.model || model,
         apiKey: openaiKey,
         headers: {
           'Authorization': `Bearer ${openaiKey}`,
         },
         endpointPath: '/embeddings',
         requestTransform: (body) => ({
           model: body.model,
           input: body.prompt,
         }),
         responseTransform: (data) => ({
           embedding: data.data?.[0]?.embedding || data.embedding,
         }),
       });
     }

     case 'cohere': {
       const cohereKey = process.env[config.embeddings.cohere?.apiKeyEnv || 'COHERE_API_KEY'];
       if (!cohereKey) {
         throw new Error(`Cohere API key not found in env var: ${config.embeddings.cohere?.apiKeyEnv || 'COHERE_API_KEY'}`);
       }
       return new EmbeddingService({
         baseUrl: 'https://api.cohere.ai/v1',
         model: config.embeddings.cohere?.model || model,
         apiKey: cohereKey,
         headers: {
           'Authorization': `Bearer ${cohereKey}`,
         },
         endpointPath: '/embed',
         requestTransform: (body) => ({
           model: body.model,
           texts: [body.prompt],
           truncate: 'END',
         }),
         responseTransform: (data) => ({
           embedding: data.embeddings?.[0] || data.embedding,
         }),
       });
     }

     case 'custom': {
       if (!config.embeddings.custom?.baseUrl) {
         throw new Error('Custom embedding provider requires baseUrl in config.embeddings.custom.baseUrl');
       }
       const customKey = config.embeddings.custom.apiKeyEnv
         ? process.env[config.embeddings.custom.apiKeyEnv]
         : undefined;
       return new EmbeddingService({
         baseUrl: config.embeddings.custom.baseUrl,
         model: config.embeddings.custom.model || model,
         apiKey: customKey,
         headers: config.embeddings.custom.headers,
       });
     }

     default:
       throw new Error(`Unsupported embedding provider: ${provider}`);
   }
}
