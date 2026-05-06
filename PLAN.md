# Universal Chatbot Web App

**Goal:** Single-page web app — configurable chatbot. User sets base URL + API key, app auto-detects the model and starts chatting.

---

## 1. Tech Stack

- **Frontend:** Single HTML file (vanilla JS, no framework needed)
- **Backend:** Python + FastAPI (lightweight, clean)
- **Chat API:** OpenAI-compatible `/v1/chat/completions` endpoint
- **Model Detection:** `GET /v1/models` → parse model list
- **Storage:** Browser `localStorage` for config persistence
- **Port:** Run locally on `http://localhost:8000`

---

## 2. Files to Create

```
chatbot-webapp/
├── app.py              # FastAPI server
├── index.html          # Single-page chat UI
├── static/
│   └── style.css       # Clean chat UI styles
└── requirements.txt    # fastapi, uvicorn, httpx
```

---

## 3. UI Layout

```
┌─────────────────────────────────┐
│  🤖 Universal Chatbot           │
│  [Status: Connected → gpt-4o]  │
├─────────────────────────────────┤
│                                 │
│  [Messages appear here]          │
│                                 │
├─────────────────────────────────┤
│  [⚙ Config] [🗑 Clear]         │
│  ┌─────────────────────────┐    │
│  │ Type your message...    │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘

Settings Modal:
  - Base URL: _______________
  - API Key:  _______________
  - [Detect Model] → shows detected model
  - [Save & Connect]
```

---

## 4. Config Modal Behavior

1. User enters `base_url` + `api_key`
2. App calls `GET {base_url}/v1/models` with `Authorization: Bearer {api_key}`
3. Parses response → shows model list dropdown (or auto-selects first)
4. User picks model or lets it auto-select
5. Config saved to `localStorage`
6. On reload, restores config and reconnects automatically

---

## 5. Chat Behavior

- **Send:** `POST {base_url}/v1/chat/completions`
  ```json
  {
    "model": "<detected_model>",
    "messages": [{"role": "user", "content": "..."}]
  }
  ```
- **Stream:** Default ON (SSE), fallback to non-stream on failure
- **Empty input:** Ignore, no-op
- **API error:** Show inline error toast
- **Disconnect state:** Grayed out input, prompt to configure

---

## 6. Model Auto-Detection Logic

```
GET /v1/models
→ 200: parse "data[].id", populate dropdown
→ 401: "Invalid API key"
→ 403: "Access forbidden"
→ timeout/unreachable: "Cannot reach server"
```

Known model ID normalization:
- `gpt-4o`, `gpt-4-turbo`, `claude-3-5-sonnet` → just pass as-is
- If only one model → auto-select it

---

## 7. Step-by-Step Implementation Plan

### Step 1 — `app.py` (FastAPI backend)
- `GET /` → serve `index.html`
- `GET /v1/models` → proxy to user's configured API (CORS headers)
- `POST /v1/chat/completions` → proxy streaming chat
- Actually, for a truly universal app: **don't proxy**. Let the frontend call the API directly (via browser). Only proxy if CORS blocks it.
- **Decision:** Start with direct browser calls (CORS-friendly APIs like OpenAI, OpenRouter). Add proxy fallback if needed.

### Step 2 — `index.html` (Chat UI)
- Config modal (base_url, api_key, model dropdown)
- Message history (user right, bot left)
- Stream response rendering (chunk by chunk)
- localStorage save/load

### Step 3 — `static/style.css`
- Dark theme, clean chat bubbles
- Mobile-responsive

### Step 4 — Testing
- Test with OpenRouter API (free tier)
- Test with custom base URL
- Verify stream + non-stream fallback

---

## 8. Risks & Open Questions

| Risk | Mitigation |
|------|-----------|
| CORS blocks direct API calls | Add FastAPI proxy endpoint `/proxy/chat` |
| Model list endpoint varies by provider | Fallback: try `/models` (Anthropic) if `/v1/models` fails |
| Streaming failure on some providers | Catch error → retry with `stream: false` |
| API key stored in localStorage | Warn user; consider session-only storage |

**Open:** Should we add conversation history persistence (save to file/DB)? → Keep simple for now, session-only.

---

## 9. Verification Steps

1. `uvicorn app:app --reload --host 0.0.0.0 --port 8000`
2. Open browser → `http://localhost:8000`
3. Enter base URL + API key → click Detect Model
4. Model appears → Send a message → Response streams in
5. Reload page → Config auto-restored
