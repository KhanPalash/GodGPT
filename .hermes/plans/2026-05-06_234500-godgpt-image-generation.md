# GodGPT — Image Generation Feature Plan

## Goal
Add image generation to GodGPT using **Gemini native image gen** as primary, with **DALL-E 3/2** as fallback. Users provide their own API keys.

---

## 1. Backend Changes (`server.js`)

### New Endpoint: `POST /v1/images/generations`

**Request body:**
```json
{
  "model": "dall-e-3 | dall-e-2 | gemini-imagen-3 | gemini-imagen-3-fast",
  "prompt": "...",
  "n": 1,
  "size": "1024x1024 | 512x512 | 1792x1024"
}
```

**Response (normalized to OpenAI format):**
```json
{
  "created": 1234567890,
  "data": [
    { "url": "https://..." }  // or b64_json if Gemini base64
  ]
}
```

### Model → Provider Routing

| Model ID | Provider | Endpoint | Auth |
|---|---|---|---|
| `dall-e-3` | OpenAI | `https://api.openai.com/v1/images/generations` | Bearer |
| `dall-e-2` | OpenAI | `https://api.openai.com/v1/images/generations` | Bearer |
| `gemini-imagen-3` | Google AI | `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate:predict` | API key |
| `gemini-imagen-3-fast` | Google AI | `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict` | API key |

**Note:** Gemini Imagen uses Google's Vertex AI / AI Studio endpoint, not OpenAI-compatible. Route separately.

### Fallback Logic

When primary model fails (rate limit, quota, content policy), automatically try next in chain:

```
dall-e-3 → dall-e-2 → gemini-imagen-3 → gemini-imagen-3-fast → error
```

Backend tracks fallback attempts via `X-Fallback-Attempt` header or internal state.

### Config Keys (sent via headers from frontend)

Frontend sends these headers:
- `x-img-api-key` — user's image gen API key (separate from chat API key)
- `x-img-provider` — `openai | google` (detected from model prefix)

---

## 2. Frontend Changes

### 2a. Generate Button (input area)
- **Location:** Left of 📎 attach button in input bar
- **Icon:** 🎨 (palette emoji) or sparkles icon
- **Action:** Opens image generation modal
- **State:** Enabled only when API key + base URL configured

### 2b. Generation Modal
- **Prompt textarea** — multi-line, required
- **Model dropdown:**
  - `dall-e-3` (default, highest quality)
  - `dall-e-2` (faster, fallback)
  - `gemini-imagen-3` (Google, primary)
  - `gemini-imagen-3-fast` (fast Google)
- **Size dropdown:**
  - `1024x1024` (square, default)
  - `1792x1024` (landscape)
  - `1024x1792` (portrait)
- **Style dropdown (DALL-E only):**
  - `vivid` / `natural`
- **Generate button** → triggers API call
- **Preview area** — shows generated image(s) with "Insert to Chat" button

### 2c. Generated Image in Chat
- Appears as **AI assistant message** (not user message)
- Shows the image prominently, with prompt text below
- User can click image → opens in new tab
- Images stored as `{url, prompt, model, size}` in conversation

### 2d. Config Panel Update
- Add section "Image Generation API"
- Fields:
  - Image API Base URL (default: `https://api.openai.com/v1`)
  - Image API Key
  - Preferred image model

---

## 3. File Changes

### `public/index.html`
- Add generate button in `.input-wrapper` (left of attach)
- Add image gen modal (`#img-gen-modal`) after config modal

### `public/style.css`
- `.btn-generate` — palette icon button styles
- `#img-gen-modal` — modal styles
- `.img-gen-preview` — generated image preview area
- `.img-result-card` — image result with prompt + model badge

### `public/app.js`
- `generateImage()` — calls `POST /v1/images/generations`
- `handleImgGenFallback()` — fallback chain logic
- `renderImgGenResult()` — display in modal + insert to chat
- `insertImgToChat()` — append AI message with image to conversation
- State: `imgGenBaseUrl`, `imgGenApiKey`, `imgGenModel`
- `openImgGenModal()` / `closeImgGenModal()`
- Update `openModal()` to include image gen section
- Update `saveConfig()` to persist image gen settings

### `server.js`
- Add `IMAGE_ROUTES` map
- Add `POST /v1/images/generations` handler
- Add `fallbackChain()` helper
- `normalizeImageResponse()` — normalize different provider formats to OpenAI format

---

## 4. API Normalization

### OpenAI (DALL-E)
```json
// Request
{ "model": "dall-e-3", "prompt": "...", "n": 1, "size": "1024x1024", "style": "vivid" }
// Response
{ "created": ..., "data": [{ "url": "..." }] }
```

### Google Imagen
```json
// Request (mapped from our format)
{
  "model": "imagen-3",
  "prompt": "...",
  "imageSize": { "width": 1024, "height": 1024 }
}
// Response (normalize to OpenAI format)
{ "created": ..., "data": [{ "url": "data:image/png;base64,..." }] }
```

---

## 5. Error Handling

| Error | Action |
|---|---|
| No API key | Show error in modal, link to settings |
| Rate limit (429) | Auto-fallback to next model |
| Content policy (400) | Show error, suggest different prompt |
| Quota exceeded | Show error, suggest API key refresh |
| Network error | Retry once, then show error |

---

## 6. States & UX

### Generate Button
- **Default:** Violet accent, 🎨 icon
- **Disabled:** Grayed out if no image API key
- **Loading:** Pulsing animation while generating

### Modal States
- **Empty:** Prompt field + generate button
- **Loading:** Spinner + "Generating..." text
- **Result:** Image preview + "Insert to Chat" button
- **Error:** Red error message + retry option

### Chat Message (generated image)
- Image takes full width of bubble
- Prompt text below image
- Model badge in message meta (e.g., "DALL-E 3")
