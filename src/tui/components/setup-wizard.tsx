import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

interface SetupWizardProps {
  onComplete: (config: Record<string, any>) => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedOption, setSelectedOption] = useState(0);

  const steps = [
    {
      title: 'Usage Mode',
      options: [
        { label: 'Personal — just me, single machine', value: 'personal' },
        { label: 'Team — multiple people, shared memory', value: 'team' },
        { label: 'Enterprise — large org, compliance, SSO', value: 'enterprise' },
      ],
    },
    {
      title: 'Database',
      options: [
        { label: 'SQLite — zero config, embedded', value: 'sqlite' },
        { label: 'PostgreSQL — scalable, self-hosted', value: 'postgres' },
        { label: 'Supabase — managed, full stack', value: 'supabase' },
      ],
    },
    {
      title: 'Embeddings',
      options: [
        { label: 'Ollama — local, free', value: 'ollama' },
        { label: 'OpenAI API — best quality', value: 'openai' },
        { label: 'Cohere API — free tier available', value: 'cohere' },
      ],
    },
  ];

  useInput((input) => {
    if (input === 'j' || input === 'arrowDown') {
      setSelectedOption((prev) => Math.min(prev + 1, steps[step].options.length - 1));
    } else if (input === 'k' || input === 'arrowUp') {
      setSelectedOption((prev) => Math.max(prev - 1, 0));
    } else if (input === 'enter') {
      if (step < steps.length - 1) {
        setStep(step + 1);
        setSelectedOption(0);
      } else {
        onComplete({
          mode: steps[0].options[selectedOption].value,
        });
      }
    }
  });

  const currentStep = steps[step];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">🐙 Nautalis Setup Wizard</Text>
      <Text color="gray">Step {step + 1} of {steps.length}</Text>
      <Text>&nbsp;</Text>
      <Text bold>{currentStep.title}</Text>
      <Text>&nbsp;</Text>
      {currentStep.options.map((option, index) => (
        <Text key={option.value} color={index === selectedOption ? 'cyan' : 'white'} bold={index === selectedOption}>
          {index === selectedOption ? '▸ ' : '  '}
          {option.label}
        </Text>
      ))}
      <Text>&nbsp;</Text>
      <Text color="gray">↑/↓: navigate  Enter: {step < steps.length - 1 ? 'next' : 'complete'}</Text>
    </Box>
  );
}
