# amin-GPT

![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=flat-square&logo=react&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-Backend_Proxy-777BB4?style=flat-square&logo=php&logoColor=white)
![NVIDIA NIM](https://img.shields.io/badge/NVIDIA_NIM-Inference-76B900?style=flat-square&logo=nvidia&logoColor=white)
![Gemma](https://img.shields.io/badge/Gemma_3N-google%2Fgemma--3n--e4b--it-4285F4?style=flat-square&logo=google&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active_Development-10B981?style=flat-square&logo=github&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-F59E0B?style=flat-square&logo=opensourceinitiative&logoColor=white)

> A multilingual AI chatbot powered by Google Gemma 3N via NVIDIA NIM. Built with a React frontend, PHP proxy backend, and a human-like conversational personality. Supports Arabic, English, and French with automatic language detection.

---

## Screenshot

![amin-GPT Chat Interface](./screenshots/screenshot.png)

> *The main chat interface — dark theme, auto-resizing input, and real-time AI responses.*

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Personality & System Prompt](#personality--system-prompt)
- [API Reference](#api-reference)
- [License](#license)

---

## Overview

**amin-GPT** is a full-stack conversational AI application that uses Google's Gemma 3N model, served through the NVIDIA NIM inference platform. The system is designed around a clean separation of concerns: a React single-page application handles the user interface, while a lightweight PHP script acts as a secure proxy between the browser and the NVIDIA API — keeping the API key server-side at all times.

The chatbot is configured with a custom system prompt that gives it a distinct human-like personality, instructs it to use emojis naturally, and enforces automatic language switching based on the detected language of each user message.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 (Vite) | UI, state management, chat rendering |
| Styling | CSS3 / Tailwind CSS | Dark theme, responsive layout |
| Backend | PHP 8+ | Secure API proxy, system prompt injection |
| AI Model | `google/gemma-3n-e4b-it` | Language model inference |
| Inference | NVIDIA NIM API | Hosted model endpoint |
| HTTP Client | cURL (PHP) | Server-to-API communication |
| Build Tool | Vite | Dev server and production build |

---

## Features

- **Multilingual auto-detection** — responds in Arabic, English, or French based on the user's input, with no manual switching required
- **Human-like personality** — custom system prompt enforces warm, casual, emoji-enriched responses; the model never breaks character
- **Named identity** — the chatbot knows its name is amin-GPT and introduces itself consistently
- **Multi-turn conversation** — full conversation history is maintained client-side and sent with every request for contextual replies
- **Secure API key handling** — the NVIDIA API key never reaches the browser; all requests are proxied through PHP
- **Auto-resizing textarea** — the input field grows with the content and resets on send
- **Typing indicator** — animated three-dot loader displayed while awaiting the model's response
- **Quick action prompts** — predefined prompt buttons in three languages for fast interaction
- **Error handling** — API and network errors are caught and displayed gracefully in the chat

---

## Architecture

```
Browser (React SPA)
        |
        |  POST /chat.php
        |  { messages: [...] }
        v
   PHP Backend (chat.php)
        |
        |  Injects system prompt at index 0
        |  Forwards full history to NVIDIA
        |
        |  POST https://integrate.api.nvidia.com/v1/chat/completions
        v
   NVIDIA NIM API
        |
        |  google/gemma-3n-e4b-it
        v
   PHP parses response
        |
        |  { reply: "..." }
        v
   React renders message bubble
```

The PHP file is a stateless proxy — it receives the conversation history from the client, prepends the hardcoded system prompt, forwards the full payload to NVIDIA, and returns only the model's reply text.

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PHP 8.0+ with the `curl` extension enabled
- A local server running PHP (XAMPP, Laragon, or `php -S`)
- An NVIDIA NIM API key

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/your-username/amin-gpt.git
cd amin-gpt
```

**2. Install frontend dependencies**

```bash
npm install
```

**3. Configure the API key**

Open `chat.php` and replace the placeholder with your NVIDIA NIM API key:

```php
$API_KEY = 'your-nvidia-nim-api-key-here';
```

**4. Start the PHP backend**

```bash
php -S localhost:8000
```

Or place the project folder inside `htdocs` (XAMPP) and start Apache.

**5. Start the React dev server**

```bash
npm run dev
```

**6. Open the app**

Navigate to `http://localhost:5173` in your browser.

---

## Project Structure

```
amin-gpt/
|
├── public/
|   └── favicon.ico
|
├── screenshots/
|   └── screenshot.png          # UI screenshot for README
|
├── src/
|   ├── components/
|   |   ├── ChatWindow.jsx       # Scrollable message list
|   |   ├── MessageBubble.jsx    # Individual user / AI message
|   |   ├── TypingIndicator.jsx  # Animated three-dot loader
|   |   ├── InputBox.jsx         # Auto-resize textarea + toolbar
|   |   └── QuickActions.jsx     # Predefined prompt buttons
|   |
|   ├── hooks/
|   |   └── useAutoResize.js     # Textarea height adjustment hook
|   |
|   ├── App.jsx                  # Root component, conversation state
|   ├── main.jsx                 # React entry point
|   └── index.css                # Global dark theme variables
|
├── chat.php                     # PHP proxy — API key lives here only
├── index.html                   # Vite HTML template
├── vite.config.js               # Vite configuration + proxy setup
├── package.json
└── README.md
```

---

## Configuration

### Vite Proxy (Development)

To avoid CORS issues during development, configure Vite to proxy `/chat.php` to the PHP server:

```js
// vite.config.js
export default {
  server: {
    proxy: {
      '/chat.php': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
}
```

### Model Parameters

The following parameters are set in `chat.php` and can be adjusted:

| Parameter | Value | Notes |
|---|---|---|
| `model` | `google/gemma-3n-e4b-it` | Instruction-tuned Gemma 3N variant |
| `max_tokens` | `1024` | Maximum reply length |
| `temperature` | `0.70` | Higher value = more natural, less repetitive |
| `top_p` | `0.90` | Nucleus sampling threshold |
| `stream` | `false` | Streaming disabled for simplicity |

---

## Personality & System Prompt

The chatbot's behavior is entirely defined by a system prompt hardcoded in `chat.php`. It is injected as the first message (`role: system`) in every API request and is never exposed to the client.

**Core directives in the system prompt:**

- The model identifies itself as **amin-GPT** at all times
- It responds in the same language as the user — Arabic, English, or French — without any code-side detection logic
- It maintains a warm, casual, human-like tone in every response
- It uses emojis naturally, without excess
- It never references being an AI or lacking emotions

```php
$SYSTEM_PROMPT = "You are amin-GPT, a friendly, smart, and human-like AI assistant.
...";

$messages = array_merge(
    [['role' => 'system', 'content' => $SYSTEM_PROMPT]],
    $data['messages']
);
```

---

## API Reference

### POST `/chat.php`

Accepts the current conversation history and returns the model's next reply.

**Request**

```json
{
  "messages": [
    { "role": "user", "content": "Hello, who are you?" }
  ]
}
```

**Response — success**

```json
{
  "reply": "Hey! I'm amin-GPT, your intelligent multilingual assistant!"
}
```

**Response — error**

```json
{
  "error": "API error 429"
}
```

**HTTP Status Codes**

| Code | Meaning |
|---|---|
| `200` | Success |
| `400` | Missing or malformed `messages` field |
| `405` | Non-POST request received |
| `500` | cURL failure or server error |

---

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

---

<div align="center">
  Built by <strong>Amin</strong> — Université 8 Mai 1945, Guelma · Département d'Informatique
</div>
