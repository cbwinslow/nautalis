/**
 * Ollama LLM client for decision extraction.
 * Uses the chat API to analyze text and extract structured decisions.
 */

export interface LLMDecision {
  decision: string;
  reasoning: string;
  alternatives: string[];
  confidence: number; // 0-1
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export class OllamaLLM {
  baseUrl: string;
  model: string;

  constructor(options: { baseUrl?: string; model?: string }) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model || 'qwen2.5:3b';
  }

  async extractDecisions(text: string): Promise<LLMDecision[]> {
    const prompt = `Analyze the following conversation or output from an AI agent and extract any decisions that were made.

Input:
${text}

Extract decisions as a JSON array with objects containing:
- "decision": the specific decision made (short phrase)
- "reasoning": why this decision was made (brief explanation)
- "alternatives": other options considered (array of strings)
- "confidence": 0.0-1.0 how confident you are this was a decision
- "impact": "low", "medium", "high", or "critical"

If no decisions are found, return an empty array [].

Respond ONLY with valid JSON, no additional text.`;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a precise decision extraction assistant. Always output valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          options: {
            temperature: 0.1, // Low temperature for consistent output
            num_predict: 500,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.message?.content || '';

      // Try to extract JSON from the response (might be wrapped in code blocks)
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[.*\]/s);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

      const decisions = JSON.parse(jsonStr) as LLMDecision[];
      return Array.isArray(decisions) ? decisions : [];
    } catch (error) {
      // Log but don't throw - allow fallback to regex
      console.warn(`LLM decision extraction failed: ${error}`);
      return [];
    }
  }
}
