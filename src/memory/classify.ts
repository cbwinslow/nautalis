import type { MemoryClassification, MemoryType, SensitivityLevel } from '../types/memory.js';
import type { NautalisEvent } from '../types/event.js';

export class MemoryClassifier {
  classify(event: NautalisEvent): MemoryClassification {
    return {
      memoryType: this.detectMemoryType(event),
      blockLabel: this.generateBlockLabel(event),
      topics: this.extractTopics(event),
      confidence: this.calculateConfidence(event),
      importance: this.calculateImportance(event),
      sensitivity: this.detectSensitivity(event),
    };
  }
  
  private detectMemoryType(event: NautalisEvent): MemoryType {
    switch (event.type) {
      case 'decision':
        return 'decision';
      case 'error':
        return 'lesson';
      case 'tool_use':
        return 'episodic';
      case 'conversation':
        return 'semantic';
      default:
        return 'episodic';
    }
  }
  
  private generateBlockLabel(event: NautalisEvent): string {
    const topics = this.extractTopics(event);
    return topics.length > 0 ? topics[0] : 'general';
  }
  
  private extractTopics(event: NautalisEvent): string[] {
    const topics = new Set<string>();
    
    // Extract from tool name
    if (event.toolName) {
      const toolTopics = this.getTopicsFromToolName(event.toolName);
      toolTopics.forEach(t => topics.add(t));
    }
    
    // Extract from files
    for (const file of event.filesInvolved) {
      const fileTopics = this.getTopicsFromFile(file);
      fileTopics.forEach(t => topics.add(t));
    }
    
    // Extract from extracted topics
    for (const topic of event.extracted.topics) {
      topics.add(topic);
    }
    
    return Array.from(topics);
  }
  
  private getTopicsFromToolName(toolName: string): string[] {
    const topics: string[] = [];
    
    if (toolName.toLowerCase().includes('edit') || toolName.toLowerCase().includes('write')) {
      topics.push('code_modification');
    }
    if (toolName.toLowerCase().includes('read')) {
      topics.push('code_reading');
    }
    if (toolName.toLowerCase().includes('bash') || toolName.toLowerCase().includes('command')) {
      topics.push('command_execution');
    }
    
    return topics;
  }
  
  private getTopicsFromFile(filePath: string): string[] {
    const topics: string[] = [];
    const lower = filePath.toLowerCase();
    
    if (lower.includes('auth') || lower.includes('login') || lower.includes('session')) {
      topics.push('authentication');
    }
    if (lower.includes('test') || lower.includes('spec')) {
      topics.push('testing');
    }
    if (lower.includes('config') || lower.includes('settings')) {
      topics.push('configuration');
    }
    if (lower.includes('db') || lower.includes('database') || lower.includes('migration')) {
      topics.push('database');
    }
    if (lower.includes('api') || lower.includes('route') || lower.includes('endpoint')) {
      topics.push('api');
    }
    if (lower.includes('ui') || lower.includes('component') || lower.includes('view')) {
      topics.push('ui');
    }
    
    return topics;
  }
  
  private calculateConfidence(_event: NautalisEvent): number {
    // TODO: Use LLM to calculate confidence
    return 0.7;
  }
  
  private calculateImportance(event: NautalisEvent): number {
    let score = 0.3; // Base score
    
    // Decisions are important
    if (event.type === 'decision') score += 0.3;
    
    // Errors are important
    if (event.type === 'error') score += 0.2;
    
    // Multiple files involved = more important
    if (event.filesInvolved.length > 1) score += 0.1;
    
    // Commands with errors are important
    if (event.toolOutput?.exitCode && event.toolOutput.exitCode !== 0) score += 0.2;
    
    return Math.min(score, 1.0);
  }
  
  private detectSensitivity(event: NautalisEvent): SensitivityLevel {
    // Check for sensitive patterns
    const sensitivePatterns = ['.env', 'secret', 'password', 'token', 'key', 'credential', 'api_key'];
    
    for (const file of event.filesInvolved) {
      for (const pattern of sensitivePatterns) {
        if (file.toLowerCase().includes(pattern)) {
          return 'confidential';
        }
      }
    }
    
    if (event.toolInput?.command?.includes('secret') || event.toolInput?.command?.includes('password')) {
      return 'confidential';
    }
    
    return 'internal';
  }
}
