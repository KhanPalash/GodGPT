# GodGPT + G0DM0D3 — Build Spec

## Project
**GodGPT** — Universal BYOK AI Chatbot Web App with jailbreak integration.

## Stack
- **Frontend:** Single HTML/CSS/JS (modern dark UI, GitHub-style, violet accent #7c3aed)
- **Backend:** Node.js + Express — proxy to OpenAI-compatible APIs, CORS fix
- **No database** — localStorage for conversation history and settings

## Directory
`/data/data/com.termux/files/home/godgpt/`

## Features

### Core
1. API Configuration: base URL + API key (localStorage)
2. Model auto-detect: `GET /v1/models` → pick first model
3. Streaming chat completions via `POST /v1/chat/completions`
4. Conversation history (sidebar, `+` for new)
5. Markdown rendering in responses
6. Escape key to abort streaming

### G0DM0D3 Integration
1. **Persona engine:** System prompt templates that define AI persona
2. **GodMode selector:** 3 modes — Standard / G0DM0D3 / Parseltongue
3. **Hall of Fame templates:** Auto-select jailbreak system prompt based on detected model family:
   - Claude → Boundary Inversion template
   - Grok → Unfiltered Liberated template
   - Gemini → Refusal Inversion template
   - GPT-4 → OG GODMODE l33t template
   - Hermes/other → Zero Refusal template
4. **Prefill chains:** Inject prior messages to establish compliance pattern
5. **Parseltongue:** Encode user prompts to bypass input classifiers (light/standard/heavy tiers)
6. **Refusal detection:** Score responses, show warning if refused

### UI Requirements
- Dark theme, violet (#7c3aed) accent
- Sidebar: conversation history
- Header: GodMode selector dropdown + current persona badge
- Config modal: base URL, API key, system prompt textarea, persona select
- Mobile responsive

## API Endpoints (backend)
- `GET /v1/models` → proxy to upstream
- `POST /v1/chat/completions` → proxy to upstream (with streaming)
- `GET /api/health` → server health

## Files to Create
- `server.js` — Express backend (proxy + static files)
- `public/index.html` — UI structure
- `public/style.css` — Dark theme CSS
- `public/app.js` — All frontend logic
- `package.json` — dependencies

## Constraints
- Bengali UI text in responses
- No markdown tables (bullet lists instead)
- BYOK: user provides their own API key
- Keep G0DM0D3 templates as JS constants in app.js
