# Plan: Prefix Picker replaces Model Picker

## Goal
Remove the model picker dropdown. Replace with a **prefix picker** that controls how the backend auto-routes requests.

## Current Flow
- Header has dropdown with 7 hardcoded model options (Haiku, Sonnet, Opus, Gemini, Groq Llama, Groq Qwen)
- User picks a model → `state.model` set → sendMessage sends model name → backend routes
- Problem: rigid, not flexible, causes routing bugs when model doesn't match expected options

## Proposed UI
**Prefix picker (dropdown)** in header, replacing model picker:
- `9router` → default routing via 9router (no prefix, backend routes by model name)
- `groq/` → direct to Groq API
- `ollama/` → direct to Ollama local

**Model name input (text field)** below prefix picker:
- Placeholder: "e.g. llama-3.3-70b-versatile"
- Auto-detect populates this based on selected prefix
- Manual entry also allowed

## Auto-Detect Prompts per Provider

### 9router (default) — `/v1/models`
Call backend proxy → returns OpenAI-format model list → pick most capable model.

```
GET /v1/models
Headers: x-api-key: <key>

Response: { data: [{ id: "Haiku" }, { id: "Opus" }, ...] }
Pick: sorted by id.length descending, exclude embedding/ada/babbage/curie models.
```

### Groq — `https://api.groq.com/openai/v1/models`
```
GET https://api.groq.com/openai/v1/models
Headers: Authorization: Bearer <key>

Response: { data: [{ id: "llama-3.3-70b-versatile" }, { id: "qwen/qwen3-32b" }, ...] }
Pick: first non-embedding, non-tool model.
```

### Ollama — `http://localhost:11434/api/tags`
```
GET http://localhost:11434/api/tags

Response: { models: [{ name: "llama3:latest" }, { name: "mistral:latest" }, ...] }
Pick: first model, strip `:latest` suffix.
```

## Changes

### 1. `public/index.html`
- Replace `<select id="model-select">` with:
  - `<select id="prefix-select">` with options: 9router, groq/, ollama/
  - `<input id="model-name-input">` text field for model name
- Add CSS for the new input styling

### 2. `public/app.js`
- Replace `modelSelect` DOM ref with `prefixSelect` + `modelNameInput`
- `init()`: load saved prefix from localStorage, set prefixSelect value
- `bindEvents()`: prefixSelect change → clear model name → if has API key → auto-detect for that prefix
- `modelSelect` event handler → `modelNameInput` input handler (direct entry)
- `autoDetectModel()`: detect prefix from `prefixSelect`, call correct `/v1/models` endpoint:
  - `groq/` → `https://api.groq.com/openai/v1/models`
  - `ollama/` → `http://localhost:11434/api/tags` (Ollama list API)
  - `9router` / default → `/v1/models` (backend proxy)
- `sendMessage()`: prepend prefix to model name if prefix is not "9router"

### 3. `public/style.css`
- Add styling for `model-name-input` text field (same visual weight as dropdown)
- Align prefix picker + model input inline in header

## Files to Change
- `public/index.html` — UI structure
- `public/app.js` — logic, auto-detect per-provider, sendMessage prefix prepend
- `public/style.css` — new input styling

## Validation
- Prefix = 9router, model = "Haiku" → backend routes to 9router ✅
- Prefix = groq/, model = "llama-3.3-70b-versatile" → backend routes to Groq ✅
- Prefix = ollama/, model = "llama3" → backend routes to Ollama ✅
- Manual model entry works without auto-detect ✅
