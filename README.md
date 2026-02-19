# AI Agent Ecosystem

Multi-model AI agent system with a 5-layer escalation hierarchy, automatic retry with exponential backoff, and cascading fallback chaining across Claude, GLM, and DeepSeek.

## Architecture

### 5-Layer Escalation Hierarchy

| Layer | Model | Role | Use Cases |
|-------|-------|------|-----------|
| L5 | Claude Opus | Editor | Life advice, strategic decisions, final blog polish |
| L4 | Claude Sonnet | Writer | Blog drafts, complex documents, email replies |
| L3 | GLM-4 | Secretary | Google Calendar, Gmail, schedule management |
| L2 | DeepSeek V3 | Gatekeeper | Daily chat, classification, log summarization |
| L1 | Claude Code | Engineer | File ops, system config, debugging |

The `ModelRouter` analyzes message complexity and emotional context to automatically select the appropriate layer. Routing decisions are logged to `logs/model-router.log`.

### Failsafe: Retry & Fallback

Every API call is wrapped with `withRetry()` (exponential backoff: 0 → 1 → 2 → 4 seconds, up to 3 retries). If all retries are exhausted, the handler automatically falls back to the next layer down:

```
Claude Opus → Claude Sonnet → GLM → DeepSeek → throw
```

Fallbacks are logged with `fallback_triggered: true` and the error reason. DeepSeek is the final tier and will throw if it also fails.

**Retryable errors:** Anthropic 429/529, Axios 429/503, ECONNRESET, ETIMEDOUT, ECONNREFUSED.

## Project Structure

```
src/
├── core/
│   └── model-router.js          # Complexity analysis, model selection, escalation
├── models/
│   ├── claude-opus.js           # L5: high-complexity tasks
│   ├── claude-sonnet.js         # L4: writing tasks
│   ├── glm-handler.js           # L3: business/secretary tasks
│   ├── deepseek-handler.js      # L2: lightweight tasks
│   └── claude-code.js           # L1: engineering tasks
├── utils/
│   └── api-retry.js             # withRetry(), isRetryableError(), FALLBACK_CHAIN
├── emotion/
│   └── emotional-context-engine.js
└── integrations/
    ├── discord-bridge.js
    ├── obsidian-api.js
    ├── notion-integration.js
    └── ...
```

## Getting Started

### 1. Install

```bash
git clone https://github.com/kunekune/ai-agent-ecosystem
cd ai-agent-ecosystem
npm install
```

### 2. Configure

```bash
cp config/api-keys.example.json config/api-keys.json
cp .env.example .env
# Fill in your API keys
```

Required keys:
- `ANTHROPIC_API_KEY` — Claude Opus / Sonnet
- `DEEPSEEK_API_KEY` — DeepSeek V3
- `GLM_API_KEY` — GLM-4
- `DISCORD_TOKEN` — Discord bot

### 3. Run

```bash
npm start          # production
npm run dev        # with file watching
DEBUG=* npm start  # verbose logs
```

## Logs

| File | Contents |
|------|----------|
| `logs/model-router.log` | Routing decisions, escalations, fallbacks |
| `logs/claude-opus.log` | L5 task results |
| `logs/claude-sonnet.log` | L4 task results |
| `logs/glm-handler.log` | L3 task results |
| `logs/deepseek-handler.log` | L2 task results |

## License

MIT
