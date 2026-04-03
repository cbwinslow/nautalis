import type { NautalisEvent } from '../types/event.js';
import { logMessage } from '../telemetry/api.js';

export interface ExtractedDecision {
  topic: string;
  decision: string;
  reasoning: string;
  alternatives: string[];
  confidence: number;
  filesInvolved: string[];
}

export class DecisionExtractor {
  extract(event: NautalisEvent): ExtractedDecision[] {
    const decisions: ExtractedDecision[] = [];
    
    // Look for decision patterns in tool output
    if (event.toolOutput?.stdout) {
      const extracted = this.extractFromText(event.toolOutput.stdout, event);
      decisions.push(...extracted);
    }
    
    // Look for decision patterns in conversation
    if (event.raw && typeof event.raw === 'object' && 'message' in event.raw) {
      const message = (event.raw as any).message;
      if (message?.content && typeof message.content === 'string') {
        const extracted = this.extractFromText(message.content, event);
        decisions.push(...extracted);
      }
    }
    
    return decisions;
  }
  
  private extractFromText(text: string, event: NautalisEvent): ExtractedDecision[] {
    const decisions: ExtractedDecision[] = [];
    
    // Simple pattern-based extraction
    // TODO: Replace with LLM-based extraction
    
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
          topic: this.inferTopic(event),
          decision: match[0],
          reasoning: '',
          alternatives: match[2] ? [match[2]] : [],
          confidence: 0.6,
          filesInvolved: event.filesInvolved,
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
