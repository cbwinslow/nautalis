import React from 'react';
import { Box, Text } from 'ink';
import type { Memory } from '../../types/memory.js';

interface TimelineProps {
  memories: Memory[];
}

export function Timeline({ memories }: TimelineProps) {
  return (
    <Box flexDirection="column">
      {memories.map((memory) => {
        const icon =
          memory.classification.memoryType === 'decision'
            ? '💡'
            : memory.classification.memoryType === 'lesson'
              ? '📚'
              : memory.classification.memoryType === 'episodic'
                ? '📝'
                : '•';

        return (
          <Box key={memory.id} flexDirection="column" paddingX={1} paddingY={0}>
            <Text color="gray">{memory.createdAt.toLocaleString()}</Text>
            <Text>
              {icon} {memory.content.summary}
            </Text>
            <Text color="gray">
              {memory.agentIdentity.agentName} ·{' '}
              {memory.classification.topics.join(', ') || 'general'}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
