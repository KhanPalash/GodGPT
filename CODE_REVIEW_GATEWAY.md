# GodGPT Gateway — Code Review

**Date:** 2026-06-20
**Scope:** `/home/GodGPT/gateway/` — API proxy/router layer

---

## Overview

This is the **gateway layer** (Express-based API proxy/router). The main GodGPT web app (`server.js`, `public/index.html`, `public/app.js`, `public/style.css`) described in `CLAUDE.md` does **not exist** at this path. Only the gateway code and design documents are present.

---

## 🔴 CRITICAL — `Readable.fromWeb()` used with non-Web streams

**File:** `gateway/index.js:101`
```js
const readable = Readable.fromWeb(response.body);
```

`response.body` from Node's native `fetch()` (Node 18+) returns a **Node.js Readable stream**, not a Web API `ReadableStream`. `Readable.fromWeb()` expects a web stream. This throws a `ERR_INVALID_ARG_TYPE` error at runtime.

**Fix:** Use `Readable.from(response.body)` instead.

---

## 🔴 CRITICAL — `response.body` race condition on client abort

**File:** `gateway/index.js:100-107`

If `res.on('close')` fires before `readable.pipe(res)` runs (race on client disconnect), `readable.destroy()` is called on an uninitialized stream. `readable.pipe(res)` on line 107 may also error silently if the body was already consumed.

**Fix:** Guard `readable.destroy()` with a null/state check. Move `res.on('close')` after `pipe()` or use a pipeline with proper cleanup.

---

## 🟠 HIGH — Rate limiter memory leak

**File:** `gateway/middlewares/rateLimiter.js`

Cleanup (line 23-27) only triggers when `hits.size > 1000`. Under moderate traffic just below 1000 unique IPs, stale timestamp arrays accumulate forever with no periodic eviction.

**Fix:** Run cleanup periodically (e.g., `setInterval` every 5 min) regardless of map size. Or switch to a sliding-window approach with TTL.

---

## 🟠 HIGH — No streaming response transformation

**File:** `gateway/index.js:96-107`

When `stream: true`, the response is piped raw from upstream without going through `provider.transformResponse()`. If a provider returns non-standard SSE format, the client receives malformed data. The non-streaming path (line 110-111) correctly calls `transformResponse()`.

**Fix:** Intercept the SSE stream and apply transformation per-chunk, or document that `transformResponse` only applies to non-streaming paths.

---

## 🟠 MEDIUM — `x-provider` header parsing is fragile

**File:** `gateway/index.js:57`
```js
const providerName = req.headers['x-provider'] || req.query?.provider || getProviderForModel(...)
```

Contradictory header + query param values are silently resolved (header wins). No logging or warning about conflicts.

**Fix:** Log a warning when both are present with different values.

---

## 🟠 MEDIUM — Image gen auth silently falls through to empty string

**File:** `gateway/index.js:128-129`
```js
const apiKey = api_key || this.getApiKey(req, 'openai');
const baseUrl = base_url || getProviderBaseUrl('openai');
```

If neither the body nor the gateway has a key configured, both become empty strings. The user gets a confusing upstream auth error instead of a clear "no API key" message.

**Fix:** Validate `apiKey` and `baseUrl` are non-empty before making upstream calls. Return 400 with a clear message if missing.

---

## 🟠 MEDIUM — `x-refusal-detected` header leaks internal logic

**File:** `gateway/index.js:112`
```js
res.setHeader('x-refusal-detected', String(refusalDetected));
```

This header is set on **every** non-streaming response, even when the user isn't using GodMode/jailbreak features. It unconditionally leaks classification logic to the client.

**Fix:** Only set this header when the request indicates GodMode/jailbreak usage (e.g., via a request header or query param).

---

## 🟡 LOW — `extractAssistantText()` is misleading

**File:** `gateway/index.js:33-37`

Only works for non-streaming responses (delta-based streaming has a different structure). The name doesn't make this limitation obvious.

**Fix:** Rename to `extractAssistantTextNonStream()` or add a doc comment.

---

## 🟡 LOW — `GroqProvider` extends wrong class

**File:** `gateway/providers/groq.js`
```js
class GroqProvider extends OpenAIProvider {}
```

Imports from `openai.js` instead of `base.js`. If `OpenAIProvider` adds OpenAI-specific logic later, Groq inherits it incorrectly. Should extend `BaseProvider` directly.

---

## 🟡 LOW — Ollama model detection path is wrong

**File:** `.hermes/plans/2026-05-05_131700-godgpt-prefix-picker.md` (plan, not code)

The plan documents that Ollama uses `/api/tags` for model listing, but `OllamaProvider` doesn't override `getModelsPath()` — it inherits `/v1/models` from `BaseProvider`, which doesn't match Ollama's actual API.

**Fix:** Override `getModelsPath()` in `OllamaProvider` to return `/api/tags`.

---

## 🟡 LOW — `safetyFilterLevel: undefined` sent explicitly

**File:** `gateway/imageGen.js:47`
```js
safetyFilterLevel: undefined,
```

This key-value pair with `undefined` is sent to the `@google/genai` SDK. Behavior depends on how the SDK handles `undefined` values in config objects — fragile.

**Fix:** Omit the key entirely when not needed, or use the SDK's documented default value.

---

## 🟡 LOW — DALL-E response format inconsistency

**File:** `gateway/imageGen.js:94,102`

Requests `response_format: 'url'` from DALL-E but then checks for `item.b64_json` in the response. Not contradictory behavior-wise, but the code says two different things.

**Fix:** Pick one format and stick with it. If you want base64, request `b64_json`. If URL, simplify the response mapper.

---

## ⚪ INFO — Provider info endpoint exposes configured state

**File:** `gateway/utils/config.js:52`
```js
apiKeySet: !!process.env[ENV_KEY_MAP[name]],
```

The `/api/providers` endpoint publicly exposes whether each provider has an API key configured (boolean). If exposed publicly, this leaks infrastructure information.

---

## ⚪ INFO — Gateway has no entry point

No `package.json` or `server.js` exists at `/home/GodGPT/`. The gateway classes are defined but there's nothing that wires them into an Express app and starts listening. The code is **unrunnable** as-is.

---

## Error Response Inconsistency

Some endpoints return `{ error: "message" }`, others return `{ error: { error: "message" } }`:

| File | Shape |
|------|-------|
| `index.js:77` | `{ error: "message", provider }` |
| `index.js:91` | `{ error: await response.text(), provider }` |
| `imageGen.js:55` | `{ error: { error: "message" } }` |
| `imageGen.js:164` | `{ error: "message" }` |

Clients can't rely on a consistent error shape. Standardize on one format.

---

## PROS

1. **Clean provider abstraction** — `BaseProvider` with well-chosen override points (`buildHeaders`, `transformRequest`, `transformResponse`). Factory pattern in `providers/index.js` is clean.

2. **Flexible routing** — Model prefix routing (`groq/`, `ollama/`, `openai/`, `openrouter/`) through `x-provider` header + model prefix detection is powerful and backward-compatible.

3. **Image gen fallback chain** — `imageGen.js` elegantly retries across multiple image models. The `GEMINI_IMAGE_MODELS` array + retry logic is well-designed.

4. **Refusal detection** — Simple regex-based classifier. Lightweight, effective, good pattern coverage.

5. **Structured request logging** — Clean JSON logging with request IDs, timing, provider routing. `x-routed-provider` response header is useful for debugging.

6. **Rate limiter design** — In-memory with sensible defaults (120 req/min) and built-in stale-entry cleanup. Simple but sufficient.

7. **SSE streaming headers** — `X-Accel-Buffering: no` is a nice touch for nginx behind the scenes.

8. **Design documentation** — `DESIGN.md` has a thorough design token system. `PLAN.md` is well-structured.

---

## CONS

1. **Zero tests** — No test files at all. Critical I/O paths (streaming, image gen, provider routing) are completely untested.

2. **No entry point** — No `package.json` or `server.js`. The gateway code is defined but not wired into a runnable app.

3. **Streaming is the riskiest path with the least safety** — The `Readable.fromWeb()` bug alone crashes streaming. This is the core feature and it's untested.

4. **Single-process, in-memory state** — Rate limiter and provider caches (`this.providers` Map) don't survive restarts. Fine for dev, not production.

5. **No request body validation** — `handleChat` accesses `req.body?.model`, `req.body?.stream` without validating the body. A malformed request crashes with a TypeError.

6. **No upstream timeouts** — No configurable timeout on upstream fetch calls. A hanging provider hangs the gateway indefinitely.

7. **No TypeScript** — For a gateway with this many provider interfaces and data transformations, TypeScript would catch entire categories of bugs.

8. **GroqProvider and OllamaProvider files are empty wrappers** — Three extra files that add no value. Just use `BaseProvider` / `OpenAIProvider` directly from the registry.

---

## Polish Suggestions

- **Health check with upstream probing** — `/api/health` currently returns a static `ok`. Optionally probe configured providers.
- **Streaming metrics** — Log estimated token count per streaming response for provider performance comparisons.
- **CORS headers** — Set `Access-Control-Allow-Origin: *` so the gateway can serve as a proper browser-side proxy.
- **Request ID in error responses** — Pass the `requestId` (already generated by the logger) into error responses for log correlation.
- **Consistent error envelope** — Standardize on `{ error: { message, code?, provider? } }` across all endpoints.
- **Generate CSS from DESIGN.md** — The design token system in `DESIGN.md` is excellent. Consider auto-generating CSS custom properties from it.

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 High | 2 |
| 🟠 Medium | 3 |
| 🟡 Low | 5 |
| ⚪ Info | 2 |

**The gateway architecture is sound**, but:
- **Streaming is broken at runtime** (wrong stream conversion API)
- **No entry point exists** — the code can't run
- **Zero test coverage** on any path
- Error responses are inconsistent across endpoints
