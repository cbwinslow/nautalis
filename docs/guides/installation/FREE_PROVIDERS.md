# Using Free LLM Models with Nautalis

This guide shows how to configure Nautalis with free inference providers.

## Prerequisites

- OpenRouter account (free) — https://openrouter.ai
- API key: `OPENROUTER_API_KEY` (set in environment or `.env`)
- Optional: API keys for OpenCode Zen, KiloCode Gateway, or OpenClaude if using those

---

## Option 1: OpenRouter Free Models (Recommended)

OpenRouter offers many free models with a single API key. Rate limits: ~20 req/min, 200 req/day.

### Minimal Configuration

`.nautalisrc.json`:

```json
{
  "providers": {
    "openrouter-free": {
      "type": "openai",
      "baseUrl": "https://openrouter.ai/api/v1",
      "model": "openrouter/free",
      "apiKeyEnv": "OPENROUTER_API_KEY"
    }
  },
  "embeddings": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "ollama": { "url": "http://localhost:11434" }
  },
  "llm": {
    "provider": "openrouter-free"
  }
}
```

Set environment:
```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

### Specific Free Models

If you prefer a particular model, choose from:

- `qwen/qwen3-coder:free` — Best for coding
- `meta-llama/llama-3.3-70b-instruct:free` — Strong all-around
- `google/gemma-3-27b-it:free` — Google's instruct model
- `nvidia/nemotron-3-super-120b-a12b:free` — High quality
- `stepfun/step-3.5-flash:free` — Fast response

Example for Qwen3 Coder:

```toml
[providers.qwen3-coder]
type = "openai"
baseUrl = "https://openrouter.ai/api/v1"
model = "qwen/qwen3-coder:free"
apiKeyEnv = "OPENROUTER_API_KEY"

[llm]
provider = "qwen3-coder"
```

---

## Option 2: OpenCode Zen (GPT-4o-mini)

OpenCode Zen provides a free GPT-4o-mini endpoint.

```toml
[providers.opencode-zen]
type = "openai"
baseUrl = "https://api.opencode.dev/zen/v1"
model = "gpt-4o-mini"
apiKeyEnv = "OPENCODE_API_KEY"

[embeddings]
provider = "ollama"
[embeddings.ollama]
url = "http://localhost:11434"

[llm]
provider = "opencode-zen"
```

Set `OPENCODE_API_KEY` if required.

---

## Option 3: KiloCode Gateway (Claude Haiku)

```toml
[providers.kilocode-gateway]
type = "openai"
baseUrl = "https://gateway.kilocode.dev/v1"
model = "claude-3-haiku"
apiKeyEnv = "KILOCODE_API_KEY"

[llm]
provider = "kilocode-gateway"
```

Set `KILOCODE_API_KEY` if required.

---

## Option 4: OpenClaude (Anthropic-compatible)

```toml
[providers.openclaude]
type = "anthropic"
baseUrl = "https://api.openclaude.ai/v1"
model = "claude-3-haiku"
# apiKeyEnv = "ANTHROPIC_API_KEY"  # or OpenClaude-specific key

[llm]
provider = "openclaude"
```

May accept standard Anthropic API keys.

---

## Free Embeddings

- **Ollama** (local) — `nomic-embed-text` (768-dim). Run `ollama pull nomic-embed-text`.
- **OpenRouter** — `openai/text-embedding-3-small` (rate-limited free). Configure:

```toml
[providers.openrouter-embed]
type = "openai"
baseUrl = "https://openrouter.ai/api/v1"
model = "openai/text-embedding-3-small"
apiKeyEnv = "OPENROUTER_API_KEY"

[embeddings]
provider = "openrouter-embed"
```

---

## Quick Start with OpenRouter Free

1. Get API key from https://openrouter.ai
2. Set env var: `export OPENROUTER_API_KEY="your-key"`
3. Ensure Ollama running for embeddings: `ollama serve`
4. Create `.nautalisrc.json` with the `openrouter-free` provider above.
5. Run `nautalis init`, `nautalis daemon start`, `nautalis ingest --async`
6. Test: `nautalis search "your query"` and `nautalis ask "question?"`

---

## Notes

- Free models have rate limits; suitable for development, demos, or low-volume personal use.
- For production, consider adding credits to OpenRouter account or using dedicated paid models.
- Embeddings are separate from LLM; you can mix free LLM with free embeddings if both providers offer them.
- All provider examples are already in `config/default.toml`; copy them to your actual config.

Enjoy zero-cost AI aggregation with Nautalis!
