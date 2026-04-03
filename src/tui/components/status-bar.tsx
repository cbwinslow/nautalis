import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  userId: string;
  totalMemories: number;
  totalEvents: number;
  activeConnectors: number;
}

export function StatusBar({ userId, totalMemories, totalEvents, activeConnectors }: StatusBarProps) {
  return (
    <Box flexDirection="row" justifyContent="space-between" paddingX={1}>
      <Text color="cyan">🐙 nautalis</Text>
      <Text color="gray">User: {userId}</Text>
      <Text color="gray">Memories: {totalMemories}</Text>
      <Text color="gray">Events: {totalEvents}</Text>
      <Text color="gray">Connectors: {activeConnectors}</Text>
    </Box>
  );
}
