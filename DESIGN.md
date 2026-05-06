---
version: alpha
name: GodGPT
description: Universal AI chatbot — minimal, dark, distraction-free chat interface with a sleek config panel.
colors:
  background: "#0D1117"
  surface: "#161B22"
  surface-elevated: "#21262D"
  border: "#30363D"
  text-primary: "#E6EDF3"
  text-secondary: "#8B949E"
  text-muted: "#484F58"
  accent: "#7C3AED"
  accent-hover: "#6D28D9"
  accent-glow: "rgba(124, 58, 237, 0.25)"
  user-bubble: "#7C3AED"
  bot-bubble: "#21262D"
  error: "#F85149"
  success: "#3FB950"
  warning: "#D29922"
typography:
  fontFamily: Inter, system-ui, sans-serif
  h1:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.2
  body-md:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
  code:
    fontFamily: JetBrains Mono, Fira Code, monospace
    fontSize: 0.875rem
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  chat-container:
    backgroundColor: "{colors.background}"
    width: 100%
    height: 100vh
  message-user:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  message-bot:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  input-field-focus:
    border: "1px solid {colors.accent}"
    boxShadow: "0 0 0 3px {colors.accent-glow}"
  send-button:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  send-button-hover:
    backgroundColor: "{colors.accent-hover}"
  config-button:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-secondary}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  modal-overlay:
    backgroundColor: "rgba(0, 0, 0, 0.7)"
    backdropFilter: blur(4px)
  modal-card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    padding: 24px
  status-badge:
    backgroundColor: "{colors.surface-elevated}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
---

## Overview

GodGPT is a universal AI chat interface — one clean page that connects to any OpenAI-compatible API. No sign-ups, no clutter. Drop in a base URL and API key, auto-detect the model, start talking. Built for power users who live in the terminal but want a proper visual chat experience.

## Colors

- **Background (#0D1117):** Deep GitHub-dark — easy on the eyes for long sessions.
- **Surface (#161B22):** Elevated chat area, slightly lighter than background.
- **Accent (#7C3AED):** Vivid violet — brand color, used for user messages, send button, and active states.
- **Text Primary (#E6EDF3):** High contrast, readable.
- **Text Secondary (#8B949E):** Metadata, timestamps, labels.
- **Bot Bubble (#21262D):** Distinct from background with a subtle border.

## Typography

Inter across the board. JetBrains Mono for code blocks. Clean hierarchy: header labels, message body, timestamps.

## Layout

- **Header bar:** App name + connection status badge + settings gear icon. Fixed at top.
- **Message area:** Scrollable, flex-grow, user messages right-aligned, bot messages left-aligned with avatar dot.
- **Input bar:** Full-width textarea at bottom, fixed. Send button right side. Auto-resize textarea.
- **Config modal:** Centered overlay with backdrop blur. Two inputs (base URL, API key), model dropdown (auto-populated), Save button.

## Components

### Status Badge
Shows real-time connection state:
- 🟢 Connected → "Model Name"
- 🔴 Disconnected
- 🟡 Connecting...

### Message Bubbles
- User: violet background, white text, right side
- Bot: dark surface with border, light text, left side with subtle avatar indicator
- Code blocks: monospace font, dark background, copy button
- Timestamps below each message

### Config Modal
- Closes on Escape or overlay click
- Base URL field (placeholder: `https://api.openai.com/v1`)
- API Key field (password type, show/hide toggle)
- "Detect Model" button → calls `GET /v1/models`, populates dropdown
- Model dropdown → auto-selects if only one model
- "Save & Connect" button → saves to localStorage, closes modal, updates status

### Input Bar
- Textarea: 1-line min, 5-line max, auto-resize
- Enter to send, Shift+Enter for newline
- Send button disabled when input empty
- Loading state: animated dot indicator while awaiting response

## Do's and Don'ts

- Do: Keep the UI dark and focused — no sidebars, no distractions.
- Do: Show streaming tokens as they arrive.
- Don't: Expose API key in UI after save (mask it in status).
- Don't: Allow sending empty messages.
- Do: Persist config across reloads via localStorage.
- Do: Gracefully handle CORS — show clear error if API blocks direct calls.
