/* ========================================
   GodGPT — App Logic
   ======================================== */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- State ---
let config = { baseUrl: '', apiKey: '', model: '' };
let conversations = [];          // [{ id, title, messages, createdAt, updatedAt }]
let activeConvId = null;
let isLoading = false;
let abortController = null;

// --- DOM ---
const sidebar         = $('#sidebar');
const sidebarToggle   = $('#sidebarToggle');
const sidebarBackdrop = $('#sidebarBackdrop');
const newChatBtn      = $('#newChatBtn');
const searchConversations = $('#searchConversations');
const conversationsList = $('#conversationsList');
const chatArea        = $('#chatArea');
const messagesEl      = $('#messages');
const welcomeScreen   = $('#welcomeScreen');
const chatTitleEl     = $('#chatTitle').querySelector('span');
const messageInput    = $('#messageInput');
const sendBtn         = $('#sendBtn');
const charCount       = $('#charCount');
const modelLabel      = $('#modelLabel');
const statusBadge     = $('#statusBadge');
const statusDot       = $('#statusDot');
const statusText      = $('#statusText');
const welcomeConfigBtn= $('#welcomeConfigBtn');
const configModal     = $('#configModal');
const modalCloseBtn   = $('#modalCloseBtn');
const baseUrlInput    = $('#baseUrlInput');
const apiKeyInput     = $('#apiKeyInput');
const detectInfo      = $('#detectInfo');
const detectInfoText  = $('#detectInfoText');
const saveConfigBtn   = $('#saveConfigBtn');
const clearConfigBtn  = $('#clearConfigBtn');
const toggleApiKeyBtn = $('#toggleApiKey');
const detectLoading   = $('#detectLoading');
const toastContainer  = $('#toastContainer');
const sidebarSettingsBtn = $('#sidebarSettingsBtn');

// ==========================================
// INIT
// ==========================================
function init() {
  loadAll();
  renderConversations();
  applyConfigToUI();
  renderMessages();
  setupEventListeners();
}

// ==========================================
// PERSISTENCE
// ==========================================
function loadAll() {
  try {
    const cfg = localStorage.getItem('godgpt_config');
    if (cfg) config = JSON.parse(cfg);
    const convs = localStorage.getItem('godgpt_conversations');
    if (convs) conversations = JSON.parse(convs);
    const active = localStorage.getItem('godgpt_active_conv');
    if (active) activeConvId = active;
  } catch (e) {}
}

function saveConfig() {
  try { localStorage.setItem('godgpt_config', JSON.stringify(config)); } catch (e) {}
}

function saveConversations() {
  try { localStorage.setItem('godgpt_conversations', JSON.stringify(conversations)); } catch (e) {}
}

function saveActiveConv() {
  try {
    if (activeConvId) localStorage.setItem('godgpt_active_conv', activeConvId);
    else localStorage.removeItem('godgpt_active_conv');
  } catch (e) {}
}

// ==========================================
// CONVERSATION MANAGEMENT
// ==========================================
function getActiveConv() {
  return conversations.find(c => c.id === activeConvId) || null;
}

function createConversation() {
  const conv = {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: 'New Conversation',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  conversations.unshift(conv);
  activeConvId = conv.id;
  saveConversations();
  saveActiveConv();
  renderConversations();
  renderMessages();
  return conv;
}

function switchConversation(id) {
  activeConvId = id;
  saveActiveConv();
  renderConversations();
  renderMessages();
  closeSidebar();
}

function deleteConversation(id, e) {
  e.stopPropagation();
  conversations = conversations.filter(c => c.id !== id);
  if (activeConvId === id) {
    activeConvId = conversations[0]?.id || null;
  }
  saveConversations();
  saveActiveConv();
  renderConversations();
  renderMessages();
}

function updateConvTitle(convId, firstMessage) {
  const conv = conversations.find(c => c.id === convId);
  if (!conv) return;
  const words = firstMessage.trim().split(/\s+/).slice(0, 4).join(' ');
  conv.title = words + (firstMessage.trim().split(/\s+/).length > 4 ? '...' : '');
  conv.updatedAt = Date.now();
  saveConversations();
  renderConversations();
}

// ==========================================
// RENDER
// ==========================================
function renderConversations(filter = '') {
  const filtered = filter
    ? conversations.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()))
    : conversations;

  if (filtered.length === 0) {
    conversationsList.innerHTML = `
      <div class="empty-convs">
        ${filter ? 'No results found' : 'No conversations yet.<br>Start chatting to see them here.'}
      </div>`;
    return;
  }

  conversationsList.innerHTML = filtered.map(conv => {
    const date = formatDate(conv.updatedAt);
    const isActive = conv.id === activeConvId;
    return `
      <div class="conv-item ${isActive ? 'active' : ''}" data-id="${conv.id}">
        <div class="conv-item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <div class="conv-item-content">
          <div class="conv-item-title">${escapeHtml(conv.title)}</div>
          <div class="conv-item-date">${date}</div>
        </div>
        <button class="conv-item-delete" data-delete="${conv.id}" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Click handlers
  $$('.conv-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.conv-item-delete')) return;
      switchConversation(el.dataset.id);
    });
  });

  $$('.conv-item-delete').forEach(el => {
    el.addEventListener('click', (e) => deleteConversation(el.dataset.delete, e));
  });
}

function renderMessages() {
  const conv = getActiveConv();
  const msgs = conv?.messages || [];

  chatTitleEl.textContent = conv ? conv.title : 'New Conversation';

  if (msgs.length === 0) {
    welcomeScreen.style.display = 'flex';
    messagesEl.innerHTML = '';
    return;
  }

  welcomeScreen.style.display = 'none';
  messagesEl.innerHTML = msgs.map((msg, i) => buildMessageHTML(msg, i)).join('');
  attachCodeCopyHandlers();
  scrollToBottom();
}

function buildMessageHTML(msg, index) {
  const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const content = msg.role === 'user' ? escapeHtml(msg.content) : renderMarkdown(msg.content);

  return `
    <div class="message ${msg.role}" data-index="${index}">
      ${msg.role === 'bot' ? `
        <div class="message-avatar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7L12 12L22 7L12 2Z"></path>
            <path d="M2 17L12 22L22 17"></path>
            <path d="M2 12L12 17L22 12"></path>
          </svg>
        </div>` : ''}
      <div class="message-bubble">${content}</div>
      <div class="message-meta">${time}</div>
    </div>
  `;
}

// ==========================================
// MARKDOWN
// ==========================================
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const c = code.trim();
    return `<pre><code class="lang-${lang}">${c}</code><button class="copy-code-btn" data-code="${escapeAttr(c)}">Copy</button></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function attachCodeCopyHandlers() {
  $$('.copy-code-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code');
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    });
  });
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ==========================================
// STATUS & UI
// ==========================================
function applyConfigToUI() {
  baseUrlInput.value = config.baseUrl || '';
  apiKeyInput.value = config.apiKey || '';

  if (config.baseUrl && config.apiKey && config.model) {
    setConnected(config.model);
    modelLabel.textContent = config.model;
  } else {
    setDisconnected();
    modelLabel.textContent = '';
  }
}

function setConnected(model) {
  statusDot.className = 'status-dot connected';
  statusText.textContent = model;
}

function setDisconnected() {
  statusDot.className = 'status-dot disconnected';
  statusText.textContent = 'Disconnected';
}

function setConnecting() {
  statusDot.className = 'status-dot connecting';
  statusText.textContent = 'Connecting...';
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
  // Send
  sendBtn.addEventListener('click', () => isLoading ? stopGeneration() : sendMessage());

  // Input
  messageInput.addEventListener('input', onInputChange);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  sidebarToggle.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent document click from closing it this click
    sidebar.classList.toggle('open');
    sidebarBackdrop.classList.toggle('open');
  });

  // Close sidebar on backdrop click
  sidebarBackdrop.addEventListener('click', closeSidebar);

  // Close sidebar on inside click (e.g. clicking empty area)
  sidebar.addEventListener('click', (e) => {
    if (e.target === sidebar) closeSidebar();
  });

  // Close sidebar on outside click (desktop)
  document.addEventListener('click', (e) => {
    if (!sidebar.classList.contains('open')) return;
    // Don't close if clicking the toggle button
    if (e.target === sidebarToggle || sidebarToggle.contains(e.target)) return;
    // Don't close if clicking inside sidebar (desktop)
    if (sidebar.contains(e.target)) return;
    closeSidebar();
  });

  // New chat
  newChatBtn.addEventListener('click', () => {
    createConversation();
    messageInput.focus();
  });

  // Search
  searchConversations.addEventListener('input', (e) => renderConversations(e.target.value));

  // Config modal
  welcomeConfigBtn.addEventListener('click', openModal);
  sidebarSettingsBtn.addEventListener('click', openModal);
  modalCloseBtn.addEventListener('click', closeModal);
  configModal.addEventListener('click', (e) => { if (e.target === configModal) closeModal(); });

  // Detect / Save
  saveConfigBtn.addEventListener('click', connectAndSave);
  clearConfigBtn.addEventListener('click', clearConfig);
  toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (configModal.classList.contains('open')) closeModal();
      if (sidebar.classList.contains('open')) closeSidebar();
    }
  });
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('open');
}

function onInputChange() {
  const val = messageInput.value.trim();
  sendBtn.disabled = !val;
  charCount.textContent = val.length > 0 ? `${val.length}` : '';

  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + 'px';
}

// ==========================================
// MODAL
// ==========================================
function openModal() {
  configModal.classList.add('open');
  baseUrlInput.focus();
}

function closeModal() {
  configModal.classList.remove('open');
}

function toggleApiKeyVisibility() {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
}

// ==========================================
// CONNECT & SAVE
// ==========================================
async function connectAndSave() {
  const baseUrl = baseUrlInput.value.trim().replace(/\/$/, '');
  const apiKey = apiKeyInput.value.trim();

  if (!baseUrl) { showToast('Base URL is required', 'warning'); baseUrlInput.focus(); return; }
  if (!apiKey) { showToast('API Key is required', 'warning'); apiKeyInput.focus(); return; }

  setConnecting();
  closeModal();

  // Detect models
  const model = await autoDetectAndPickModel(baseUrl, apiKey);

  if (!model) {
    setDisconnected();
    showToast('Could not detect any model. Check URL & API key.', 'error');
    return;
  }

  config = { baseUrl, apiKey, model };
  saveConfig();
  applyConfigToUI();
  showToast(`Connected! Using ${model}`, 'success');
}

async function autoDetectAndPickModel(baseUrl, apiKey) {
  detectLoading.classList.add('active');
  detectInfoText.textContent = 'Detecting available models...';

  const endpoints = [
    `${baseUrl}/v1/models`,
    `${baseUrl}/models`,
  ];

  let allModels = [];
  let lastError = '';

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          allModels = data.data.map(m => m.id);
        } else if (data.models) {
          allModels = Array.isArray(data.models)
            ? data.models.map(m => m.id || m.name)
            : Object.keys(data.models);
        }
        break;
      } else {
        lastError = `${res.status} ${res.statusText}`;
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  detectLoading.classList.remove('active');

  if (allModels.length === 0) {
    detectInfoText.textContent = `Detection failed: ${lastError}`;
    return null;
  }

  // Random pick
  const picked = allModels[Math.floor(Math.random() * allModels.length)];
  detectInfoText.textContent = `✓ Found ${allModels.length} model(s) — randomly selected: ${picked}`;
  return picked;
}

function clearConfig() {
  config = { baseUrl: '', apiKey: '', model: '' };
  saveConfig();
  baseUrlInput.value = '';
  apiKeyInput.value = '';
  detectInfoText.textContent = 'Click Connect to auto-detect and randomly select a model';
  applyConfigToUI();
  showToast('Config cleared', 'warning');
}

// ==========================================
// SEND MESSAGE
// ==========================================
async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || isLoading) return;

  if (!config.model) {
    showToast('Configure your API first', 'warning');
    openModal();
    return;
  }

  // Create conversation if none active
  if (!activeConvId) createConversation();

  const conv = getActiveConv();

  // Add user message
  conv.messages.push({ role: 'user', content, timestamp: Date.now() });
  conv.updatedAt = Date.now();
  if (conv.messages.length === 1) updateConvTitle(conv.id, content);
  saveConversations();
  renderConversations();
  renderMessages();

  // Clear input
  messageInput.value = '';
  onInputChange();

  await streamBotResponse(content);
}

function stopGeneration() {
  if (abortController) {
    abortController.abort();
  }
}

async function streamBotResponse(content) {
  isLoading = true;
  sendBtn.classList.add('streaming');
  const sendIcon = sendBtn.querySelector('.send-icon');
  const stopIcon = sendBtn.querySelector('.stop-icon');
  if (sendIcon) sendIcon.style.display = 'none';
  if (stopIcon) stopIcon.style.display = 'block';

  const conv = getActiveConv();
  const msgIndex = conv.messages.length;

  // Typing indicator
  const typingEl = document.createElement('div');
  typingEl.className = 'message bot';
  typingEl.innerHTML = `
    <div class="message-avatar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7L12 12L22 7L12 2Z"></path>
        <path d="M2 17L12 22L22 17"></path>
        <path d="M2 12L12 17L22 12"></path>
      </svg>
    </div>
    <div class="message-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  messagesEl.appendChild(typingEl);
  scrollToBottom();

  // Bot message placeholder
  conv.messages.push({ role: 'assistant', content: '', timestamp: Date.now() });
  let fullResponse = '';

  try {
    abortController = new AbortController();
    const apiMessages = conv.messages.slice(-50, -1).map(m => ({ role: m.role, content: m.content }));

    const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [...apiMessages, { role: 'user', content }],
        stream: true
      }),
      signal: abortController.signal
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${res.status} ${res.statusText}`);
    }

    typingEl.remove();

    // Create streaming bubble
    const streamId = `stream-${Date.now()}`;
    const streamEl = document.createElement('div');
    streamEl.className = 'message bot';
    streamEl.innerHTML = `
      <div class="message-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7L12 12L22 7L12 2Z"></path>
          <path d="M2 17L12 22L22 17"></path>
          <path d="M2 12L12 17L22 12"></path>
        </svg>
      </div>
      <div class="message-bubble" id="bubble-${streamId}"></div>
      <div class="message-meta">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
    messagesEl.appendChild(streamEl);
    const bubbleEl = document.getElementById(`bubble-${streamId}`);
    let streamHasCode = false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              bubbleEl.innerHTML = renderMarkdown(fullResponse);
              // Only re-attach copy handlers when code blocks first appear (avoid per-token re-render)
              if (bubbleEl.querySelector('.copy-code-btn') && !streamHasCode) {
                attachCodeCopyHandlers();
                streamHasCode = true;
              }
              scrollToBottom();
            }
          } catch (e) {}
        }
      }
    }

    // Finalize
    conv.messages[msgIndex].content = fullResponse;
    conv.updatedAt = Date.now();
    saveConversations();

  } catch (e) {
    typingEl.remove();

    if (e.name === 'AbortError') {
      // Save partial
      if (fullResponse) {
        conv.messages[msgIndex].content = fullResponse;
        conv.updatedAt = Date.now();
        saveConversations();
        renderConversations();
        renderMessages();
      }
      showToast('Response stopped', 'warning');
    } else {
      showToast(e.message || 'Something went wrong', 'error');
      // Remove empty bot message
      if (conv.messages[msgIndex]?.content === '') {
        conv.messages.splice(msgIndex, 1);
        saveConversations();
        renderConversations();
        renderMessages();
      }
    }
  } finally {
    isLoading = false;
    sendBtn.classList.remove('streaming');
    if (sendIcon) sendIcon.style.display = 'block';
    if (stopIcon) stopIcon.style.display = 'none';
    sendBtn.disabled = !messageInput.value.trim();
    abortController = null;
  }
}

// ==========================================
// TOAST
// ==========================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px) scale(0.95)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// UTILS
// ==========================================
function formatDate(ts) {
  const now = Date.now();
  const diff = now - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);

  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ==========================================
// START
// ==========================================
init();
