# 🌌 GodGPT

Universal BYOK (Bring Your Own Key) AI Chatbot Web App with advanced G0DM0D3 jailbreak integration, persona engine, and image generation.

---

## 🚀 Overview

GodGPT is a web application designed for security researchers, developers, and AI enthusiasts to interact with various OpenAI-compatible APIs. It provides a clean, modern, and highly responsive dark UI with a violet accent. 

The application runs a local Node.js/Express server that acts as a secure, CORS-enabled gateway to upstream providers. It operates fully client-side for user credentials, storing API keys and chat history safely inside local storage (`localStorage`).

---

## ✨ Features

### 🧠 Core Chat Client
* **BYOK Architecture**: Your keys, your data. API keys and configuration parameters are stored locally on your device.
* **Auto-detect Model**: Query `GET /v1/models` and pick the most appropriate model dynamically.
* **Streaming Responses**: Real-time server-sent events (SSE) chat completions.
* **Conversation History**: Access and manage past conversations in the sidebar; quickly start new ones.
* **Markdown Support**: Clean rendering of rich text, code blocks, bold/italic formatting, and lists.
* **Streaming Abort**: Use the Escape key or click the stop button to abort any ongoing stream.

### 🔓 G0DM0D3 Alignment Testing Engine
* **Persona Engine**: Customize the AI's personality on the fly using built-in badges (Default, Rebel, Ghost, Sage, Hacker).
* **GodMode Selector**: Toggle between Standard, G0DM0D3, and Parseltongue modes.
* **Hall of Fame System Prompt Templates**: Automatically picks the best alignment testing templates based on the detected model family:
  * **Claude** -> Boundary Inversion template
  * **Grok / xAI** -> Unfiltered Liberated template
  * **Gemini / Google** -> Refusal Inversion template
  * **GPT-4 / OpenAI** -> OG GODMODE l33t template
  * **Hermes / Nous** -> Zero Refusal template
* **Compliance Prefill Chains**: Injects past simulated compliance loops to establish compliance patterns.
* **Parseltongue Encoder**: Encodes user prompts (using advanced leetspeak mapping) to bypass input classifiers.
* **Refusal Detection & Scoring**: Scans responses for refusal patterns, displaying a distinct badge if the model refuses.

### 🎨 Image Generation Integration
* **Multi-Model Support**: Generate images with Google Imagen 3.0, Imagen 2.0, and DALL-E 3.
* **Aspect Ratio & Resolution Controls**: Custom selectors for landscape, portrait, and standard shapes (1:1, 16:9, 9:16, 4:3, 3:4) and qualities (1K, 2K, 4K).
* **Chat Insertion**: Preview generated images inside a dedicated modal and directly append them into your chat session.

### 📱 Modern User Interface
* **Stunning Dark Mode**: Sleek GitHub-style dark interface with glowing violet accents (`#7c3aed`).
* **Device-Aware Controls**:
  * **Desktop**: Press Enter to send, Shift + Enter for a new line.
  * **Mobile**: Enter inputs a new line, use the send button to dispatch.
* **Responsive Layout**: Seamlessly collapses into a mobile-friendly side drawer menu.

---

## 🛠️ Project Structure

The project is structured as follows:

* **server.js** - The primary entry point. Initializes the Express backend, serves the static public directory, and mounts routing.
* **gateway/** - Multi-provider routing and middleware system.
  * **gateway/index.js** - Heart of the proxy routing engine. Detects model names and dynamically routes API requests.
  * **gateway/imageGen.js** - Image generation integration logic for OpenAI DALL-E and Google GenAI SDK.
  * **gateway/providers/** - Endpoint adapters for individual API providers (Groq, Ollama, OpenAI, OpenRouter).
  * **gateway/middlewares/** - Gateway security, rate limiting, and request logging.
  * **gateway/utils/** - Provider configurations, base URLs, and validation logic.
* **public/** - Single Page Application frontend.
  * **public/index.html** - Semantic layout structure of the user interface.
  * **public/style.css** - Custom styling, layout systems, responsive design, scrollbars, and keyframes.
  * **public/app.js** - Frontend application logic, rendering pipeline, markdown parsing, state management, and stream readers.

---

## 📦 Installation & Setup

Get GodGPT running locally in just a few steps.

### Prerequisites
* **Node.js** (v16 or higher recommended)
* **npm** (comes packaged with Node.js)

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd godgpt
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```
The server will boot and print out the mounted routes:
```text
GodGPT Gateway running at http://localhost:3001
Gateway routes enabled:
  GET  /v1/models
  POST /v1/chat/completions
  POST /v1/images/generations
  GET  /api/health
  GET  /api/routes
  GET  /api/providers
```

### 4. Open in Browser
Visit `http://localhost:3001` in your web browser. 

---

## ⚙️ Configuration & Usage

1. **Access Settings**: Click the **Settings** gear icon in the sidebar (or click the **Configure API** button on the welcome page).
2. **Setup Base URL & API Key**:
   * Set your custom base URL (e.g., `https://api.openai.com/v1` for OpenAI, `https://api.openrouter.ai/api/v1` for OpenRouter, or `http://localhost:11434/v1` for local Ollama).
   * Enter your API Key. It is stored securely on your device's local storage and is never sent to third-party tracking services.
3. **Save Config**: Click **Save**. The app will attempt to fetch available models and select the most capable one automatically.
4. **Setup Image Generation (Optional)**:
   * To use Google Imagen models, obtain a free API key from Google AI Studio and input it into the **Image Gen API Key** field in settings.
5. **Start Chatting**: Select your desired persona, choose a GodMode setting, type your message, and test!

---

## ⚠️ Security & Alignment Research Disclaimer

This project is built for **educational purposes, defensive security research, and alignment boundary testing** (red teaming). Users are solely responsible for ensuring that their usage complies with their API providers' terms of service (ToS). Please use the system prompts and bypass functionalities responsibly in authorized testing environments only.
