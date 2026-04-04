import type { NautalisEvent } from '../types/event.js';
import { logMessage } from '../telemetry/api.js';
import { OllamaLLM, type LLMDecision } from './ollama-llm.js';

export interface ExtractedDecision {
  topic: string;
  decision: string;
  reasoning: string;
  alternatives: string[];
  confidence: number;
  filesInvolved: string[];
}

export class DecisionExtractor {
  private llm?: OllamaLLM;

  constructor(llm?: OllamaLLM) {
    this.llm = llm;
  }

  async extract(event: NautalisEvent): Promise<ExtractedDecision[]> {
    // Gather text from event
    const texts: string[] = [];
    if (event.toolOutput?.stdout) {
      texts.push(event.toolOutput.stdout);
    }
    if (event.raw && typeof event.raw === 'object' && 'message' in event.raw) {
      const message = (event.raw as any).message;
      if (message?.content && typeof message.content === 'string') {
        texts.push(message.content);
      }
    }

    if (texts.length === 0) {
      return [];
    }

    const allDecisions: ExtractedDecision[] = [];

    for (const text of texts) {
      let decisions: LLMDecision[] = [];

      // Try LLM extraction first if available
      if (this.llm) {
        try {
          const llmResults = await this.llm.extractDecisions(text);
          if (llmResults.length > 0) {
            decisions = llmResults;
          }
        } catch (error) {
          logMessage('warn', `LLM extraction failed, falling back to regex: ${error}`);
        }
      }

      // Fallback to regex if no LLM decisions
      if (decisions.length === 0) {
        decisions = this.extractWithRegex(text);
      }

      // Convert to ExtractedDecision with event metadata
      for (const d of decisions) {
        allDecisions.push({
          topic: this.inferTopic(event),
          decision: d.decision,
          reasoning: d.reasoning || '',
          alternatives: d.alternatives || [],
          confidence: d.confidence,
          filesInvolved: event.filesInvolved,
        });
      }
    }

    return allDecisions;
  }

  private extractWithRegex(text: string): LLMDecision[] {
    const decisions: LLMDecision[] = [];

    const decisionPatterns = [
      /decided to (.+?)\./gi,
      /chose (.+?) over (.+?)\./gi,
      /using (.+?) (?:for|because|instead of)/gi,
      /going with (.+?)\./gi,
    ];

    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        decisions.push({
          decision: match[0],
          reasoning: '',
          alternatives: match[2] ? [match[2]] : [],
          confidence: 0.6,
          impact: 'medium',
        });
      }
    }

    return decisions;
  }

  private inferTopic(event: NautalisEvent): string {
    if (event.filesInvolved.length > 0) {
      const file = event.filesInvolved[0];
      const parts = file.split('/');
      return parts.length > 1 ? parts[parts.length - 2] : parts[0];
    }
    return event.toolName || 'general';
  }
}
