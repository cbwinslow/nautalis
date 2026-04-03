import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { Memory } from '../../types/memory.js';

interface MemoryListProps {
  memories: Memory[];
  onSelect?: (memory: Memory) => void;
}

export function MemoryList({ memories, onSelect }: MemoryListProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  useInput((input) => {
    if (input === 'j' || input === 'arrowDown') {
      setSelectedIndex((prev) => Math.min(prev + 1, memories.length - 1));
    } else if (input === 'k' || input === 'arrowUp') {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (input === 'enter' && onSelect) {
      onSelect(memories[selectedIndex]);
    }
  });

  if (memories.length === 0) {
    return <Text color="yellow">No memories found</Text>;
  }

  return (
    <Box flexDirection="column">
      {memories.map((memory, index) => (
        <Box key={memory.id} flexDirection="column" paddingX={1}>
          <Text color={index === selectedIndex ? 'cyan' : 'white'} bold={index === selectedIndex}>
            {index === selectedIndex ? '▸ ' : '  '}
            {memory.content.summary}
          </Text>
          {index === selectedIndex && (
            <Text color="gray" wrap="wrap">
              Type: {memory.classification.memoryType} | Agent: {memory.agentIdentity.toolName} | Topics: {memory.classification.topics.join(', ')}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
