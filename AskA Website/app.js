// ═══════════════════════════════════════════════════════════════════
//  VIEW TOGGLE
// ═══════════════════════════════════════════════════════════════════
function showChatView() {
    document.getElementById('chat-view').classList.remove('hidden');
    document.getElementById('form-view').classList.add('hidden');
    document.getElementById('open-form-btn').classList.remove('hidden');
    document.getElementById('chat-sidebar').style.display = 'flex';
}

function showFormView() {
    document.getElementById('chat-view').classList.add('hidden');
    document.getElementById('form-view').classList.remove('hidden');
    document.getElementById('open-form-btn').classList.add('hidden');
    document.getElementById('chat-sidebar').style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════════
//  SIDEBAR MOBILE TOGGLE
// ═══════════════════════════════════════════════════════════════════
function toggleSidebar() {
    const sidebar = document.getElementById('chat-sidebar');

    if (window.innerWidth <= 1023) {
        // Mobile behavior: slide in/out
        sidebar.classList.toggle('sidebar-open');
    } else {
        // Desktop behavior: collapse width
        sidebar.classList.toggle('collapsed');
    }
}

// ═══════════════════════════════════════════════════════════════════
//  CHAT HISTORY MANAGER
// ═══════════════════════════════════════════════════════════════════
class ChatHistoryManager {
    constructor() {
        this.sessions = [];
        this.currentSessionId = null;
        this.titleSaved = false;
    }

    async init() {
        await this._loadSessions();
        this.renderSidebar();
        if (this.sessions.length > 0) {
            this.loadSession(this.sessions[0].id);
        } else {
            await this._startNewSession();
            this._resetChatUI();
        }
    }

    clear() {
        this.sessions = [];
        this.currentSessionId = null;
        this.renderSidebar();
    }

    async _loadSessions() {
        if (!authToken) return;
        try {
            const res = await fetch('/api/history', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.ok) {
                this.sessions = await res.json();
            } else {
                this.sessions = [];
            }
        } catch {
            this.sessions = [];
        }
    }

    async _saveTitleRemotely(id, title) {
        if (!authToken) return;
        try {
            await fetch(`/api/history/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ title })
            });
        } catch (e) { console.error('Failed to save title', e); }
    }

    async _saveMessagesRemotely(id, messages) {
        if (!authToken) return;
        try {
            await fetch(`/api/history/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ messages })
            });
        } catch (e) { console.error('Failed to save messages', e); }
    }

    _getSession(id) {
        return this.sessions.find(s => s.id === id);
    }

    async _startNewSession() {
        const id = 'session_' + Date.now();
        const timestamp = new Date().toISOString();
        const session = { id, title: 'New Chat', timestamp, messages: [] };
        this.sessions.unshift(session);
        this.currentSessionId = id;
        this.titleSaved = false;

        if (authToken) {
            try {
                await fetch('/api/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                    body: JSON.stringify({ id, title: 'New Chat', timestamp, messages: [] })
                });
            } catch (e) { console.error('Failed to create session on server', e); }
        }
        return id;
    }

    formatTimestamp(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const isToday = date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();
        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }

    renderSidebar() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';

        if (this.sessions.length === 0) {
            list.innerHTML = `
                <li id="history-empty">
                    <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.556 0 8.25-3.694 8.25-8.25S16.556 3.75 12 3.75 3.75 7.444 3.75 12s3.694 8.25 8.25 8.25z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75h.008v.008H9.75V9.75zm4.5 0h.008v.008h-.008V9.75zm-2.25 3.75a2.25 2.25 0 002.25-2.25"/>
                    </svg>
                    <p>No chats yet.<br>Start a conversation!</p>
                </li>`;
            return;
        }

        this.sessions.forEach(session => {
            const li = document.createElement('li');
            li.className = 'history-item' + (session.id === this.currentSessionId ? ' active' : '');
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', session.id === this.currentSessionId);
            li.innerHTML = `
                <div class="history-item-icon">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
                    </svg>
                </div>
                <div class="history-item-text">
                    <div class="history-item-title">${this._escapeHtml(session.title)}</div>
                    <div class="history-item-time">${this.formatTimestamp(session.timestamp)}</div>
                </div>
                <button class="history-item-delete" title="Delete chat" data-id="${this._escapeHtml(session.id)}" aria-label="Delete chat">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                </button>`;
            li.addEventListener('click', (e) => {
                if (e.target.closest('.history-item-delete')) return;
                this.loadSession(session.id);
            });
            li.querySelector('.history-item-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteModal(session.id);
            });
            list.appendChild(li);
        });
    }

    async newChat() {
        await this.persistMessages();
        await this._startNewSession();
        this._resetChatUI();
        this.renderSidebar();
        const sidebar = document.getElementById('chat-sidebar');
        if (sidebar && sidebar.classList.contains('sidebar-open')) toggleSidebar();
    }

    async deleteSession(id) {
        const wasActive = id === this.currentSessionId;
        this.sessions = this.sessions.filter(s => s.id !== id);

        if (authToken) {
            try {
                await fetch(`/api/history/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
            } catch (e) { console.error('Failed to delete on server', e); }
        }

        if (wasActive) {
            await this._startNewSession();
            this._resetChatUI();
        }
        this.renderSidebar();
    }

    async saveTitle(firstMessage) {
        if (this.titleSaved) return;
        const session = this._getSession(this.currentSessionId);
        if (!session) return;
        session.title = firstMessage.length > 40
            ? firstMessage.slice(0, 40) + '…'
            : firstMessage;
        this.titleSaved = true;
        this.renderSidebar();
        await this._saveTitleRemotely(session.id, session.title);
    }

    async persistMessages() {
        const session = this._getSession(this.currentSessionId);
        if (!session) return;
        const msgEls = document.querySelectorAll('#chat-messages > div:not(#typing-indicator)');
        session.messages = Array.from(msgEls).map(el => {
            if (el.dataset.role) {
                return { role: el.dataset.role, text: el.dataset.text };
            }
            return el.outerHTML; // Fallback for old sessions that stored HTML strings
        });
        await this._saveMessagesRemotely(session.id, session.messages);
    }

    loadSession(id) {
        this.persistMessages();
        this.currentSessionId = id;
        this.titleSaved = true;
        const session = this._getSession(id);
        this._resetChatUI();
        if (session && session.messages && session.messages.length > 0) {
            const container = document.getElementById('chat-messages');
            container.innerHTML = '';
            session.messages.forEach(msg => {
                if (typeof msg === 'string') {
                    // Fallback for old HTML strings
                    const div = document.createElement('div');
                    div.innerHTML = msg;
                    container.appendChild(div.firstElementChild);
                } else if (msg && msg.role) {
                    if (msg.role === 'user') appendUserBubble(msg.text, false);
                    else if (msg.role === 'assistant') appendBotBubble(msg.text, false);
                }
            });
            container.scrollTop = container.scrollHeight;
        }
        this.renderSidebar();
        const sidebar = document.getElementById('chat-sidebar');
        if (sidebar && sidebar.classList.contains('sidebar-open')) toggleSidebar();
    }

    _resetChatUI() {
        const container = document.getElementById('chat-messages');
        const defaultMsg = "👋 Hi there! I'm your AI support assistant. How can I help you today?";
        container.innerHTML = `
            <div class="flex items-end gap-2.5 bubble-anim" data-role="assistant" data-text="${defaultMsg}">
                <div class="w-7 h-7 rounded-full bg-[#F37021] flex-shrink-0 flex items-center justify-center shadow-sm">
                    <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                    </svg>
                </div>
                <div class="max-w-[76%] rounded-2xl rounded-bl-sm px-4 py-3 bg-white border border-slate-200 text-slate-800 text-sm leading-relaxed shadow-sm">
                    <div class="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        ${marked.parse(defaultMsg)}
                    </div>
                </div>
            </div>`;
        const userInput = document.getElementById('user-input');
        if (userInput) {
            userInput.value = '';
            userInput.style.height = 'auto';
        }
    }

    _escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

// ═══════════════════════════════════════════════════════════════════
//  DELETE CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════════════════
let chatToDelete = null;

function showDeleteModal(id) {
    chatToDelete = id;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function hideDeleteModal() {
    chatToDelete = null;
    document.getElementById('delete-modal').classList.add('hidden');
}

function confirmDelete() {
    if (!chatToDelete) return;
    historyMgr.deleteSession(chatToDelete);
    hideDeleteModal();
}

// Instantiate once DOM is ready
const historyMgr = new ChatHistoryManager();

// Auth initialization
let authToken = localStorage.getItem('aska_auth_token');
let authUsername = localStorage.getItem('aska_auth_username');
let isLoginMode = true;

const authOverlay = document.getElementById('auth-overlay');
const appShell = document.getElementById('app-shell');
const sidebarToggle = document.getElementById('sidebar-toggle');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authToggleText = document.getElementById('auth-toggle-text');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');
const authSubmitBtn = document.getElementById('auth-submit-btn');

function showApp() {
    if (authOverlay) authOverlay.style.display = 'none';
    if (appShell) appShell.style.display = '';
    if (sidebarToggle) sidebarToggle.style.display = 'flex';
}

function showAuth() {
    if (authOverlay) authOverlay.style.display = 'flex';
    if (appShell) appShell.style.display = 'none';
    if (sidebarToggle) sidebarToggle.style.display = 'none';
}

async function initAuth() {
    if (authToken) {
        showApp();
        await historyMgr.init();
    } else {
        showAuth();
    }
}

function logout() {
    localStorage.removeItem('aska_auth_token');
    localStorage.removeItem('aska_auth_username');
    authToken = null;
    authUsername = null;
    historyMgr.clear();

    // Clear input fields
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';

    showAuth();
}

if (document.getElementById('logout-btn')) {
    document.getElementById('logout-btn').addEventListener('click', logout);
}

if (authToggleBtn) {
    authToggleBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        authTitle.textContent = isLoginMode ? 'Welcome Back' : 'Create Account';
        authSubtitle.textContent = isLoginMode ? 'Log in to sync your chat history' : 'Register to get started';
        authToggleText.textContent = isLoginMode ? "Don't have an account?" : "Already have an account?";
        authToggleBtn.textContent = isLoginMode ? 'Register' : 'Log In';
        authSubmitBtn.textContent = isLoginMode ? 'Log In' : 'Register';
        authError.classList.add('hidden');
        authSuccess.classList.add('hidden');
    });
}

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;

        authError.classList.add('hidden');
        authSuccess.classList.add('hidden');
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = 'Please wait...';

        try {
            const endpoint = isLoginMode ? '/api/login' : '/api/register';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Authentication failed');

            if (!isLoginMode) {
                authSuccess.textContent = 'Registration successful! Please log in.';
                authSuccess.classList.remove('hidden');
                isLoginMode = true;
                authTitle.textContent = 'Welcome Back';
                authSubtitle.textContent = 'Log in to sync your chat history';
                authToggleText.textContent = "Don't have an account?";
                authToggleBtn.textContent = 'Register';
                authSubmitBtn.textContent = 'Log In';
                document.getElementById('auth-password').value = '';
            } else {
                localStorage.setItem('aska_auth_token', data.token);
                localStorage.setItem('aska_auth_username', data.username);
                authToken = data.token;
                authUsername = data.username;
                showApp();
                await historyMgr.init();
            }
        } catch (err) {
            authError.textContent = err.message;
            authError.classList.remove('hidden');
        } finally {
            if (!isLoginMode) {
                authSubmitBtn.textContent = 'Register';
            } else {
                authSubmitBtn.textContent = 'Log In';
            }
            authSubmitBtn.disabled = false;
        }
    });
}

// Start auth flow
initAuth();

// ═══════════════════════════════════════════════════════════════════
//  CHAT — DOM REFS
// ═══════════════════════════════════════════════════════════════════
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// Auto-resize textarea
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
});

// Send on Enter (Shift+Enter = newline)
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.requestSubmit();
    }
});

function scrollToBottom() {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

function appendUserBubble(text, shouldScroll = true) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex justify-end bubble-anim';
    wrapper.dataset.role = 'user';
    wrapper.dataset.text = text;
    wrapper.innerHTML = `
<div class="max-w-[76%] rounded-2xl rounded-br-sm px-4 py-3 bg-[#F37021] text-white text-sm leading-relaxed shadow-sm shadow-orange-200">
  ${escapeHtml(text).replace(/\n/g, '<br>')}
</div>`;
    chatMessages.appendChild(wrapper);
    if (shouldScroll) scrollToBottom();
}

function appendBotBubble(text, shouldScroll = true) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-end gap-2.5 bubble-anim';
    wrapper.dataset.role = 'assistant';
    wrapper.dataset.text = text;
    wrapper.innerHTML = `
<div class="w-7 h-7 rounded-full bg-[#F37021] flex-shrink-0 flex items-center justify-center shadow-sm">
  <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
  </svg>
</div>
<div class="max-w-[76%] rounded-2xl rounded-bl-sm px-4 py-3 bg-white border border-slate-200 text-slate-800 text-sm leading-relaxed shadow-sm">
  <div class="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
    ${marked.parse(text, { breaks: true })}
  </div>
</div>`;
    chatMessages.appendChild(wrapper);
    if (shouldScroll) scrollToBottom();
}

function showTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.id = 'typing-indicator';
    wrapper.className = 'flex items-end gap-2.5 bubble-anim';
    wrapper.innerHTML = `
<div class="w-7 h-7 rounded-full bg-[#F37021] flex-shrink-0 flex items-center justify-center shadow-sm">
  <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
  </svg>
</div>
<div class="flex items-center gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3.5 bg-white border border-slate-200 shadow-sm">
  <span class="w-2 h-2 rounded-full bg-[#F37021] animate-dot1 inline-block"></span>
  <span class="w-2 h-2 rounded-full bg-[#F37021] animate-dot2 inline-block"></span>
  <span class="w-2 h-2 rounded-full bg-[#F37021] animate-dot3 inline-block"></span>
</div>`;
    chatMessages.appendChild(wrapper);
    scrollToBottom();
}

function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

function setInputLocked(locked) {
    userInput.disabled = locked;
    sendBtn.disabled = locked;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendMessage(message) {
    setInputLocked(true);
    showTypingIndicator();
    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const botText =
            data?.reply ??
            data?.output ??
            data?.[0]?.output ??
            data?.text ??
            data?.[0]?.text ??
            data?.message?.content ??
            data?.response ??
            (typeof data === 'string' ? data : JSON.stringify(data));
        removeTypingIndicator();
        appendBotBubble(botText);
        historyMgr.persistMessages();
    } catch (err) {
        removeTypingIndicator();
        appendBotBubble(`⚠️ Sorry, I couldn't reach the server. Please try again.\n\n_Error: ${err.message}_`);
        historyMgr.persistMessages();
        console.error('Chat error:', err);
    } finally {
        setInputLocked(false);
        userInput.focus();
    }
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;
    // Save first message as session title
    historyMgr.saveTitle(text);
    appendUserBubble(text);
    userInput.value = '';
    userInput.style.height = 'auto';
    sendMessage(text);
});

// ═══════════════════════════════════════════════════════════════════
//  FORM — DEPARTMENT → CATEGORY MAP
// ═══════════════════════════════════════════════════════════════════
const CATEGORY_MAP = {
    'Academic Affairs - Bachelor Degree': [
        'Academic Related', 'Appeal of Exam Result', 'Class Timetable',
        'Classroom Booking', 'Convocation', 'Graduation', 'MQA and MOHE',
        'Programme Entry Requirement', 'Programme Transfer', 'PTPTN',
        'Public Talk', 'Quality Assurance Process and Policy'
    ],
    'Academic Affairs - Foundation': [
        'Class Attendance', 'Examination',
        'Full Academic Transcript & Completion Certificate', 'Programme Information'
    ],
    'Admission': [],
    'IT': [
        'Application', 'Classroom', 'Computer', 'ECARD', 'Email',
        'Internet of Things (e.g. Door Access)', 'My Media', 'Network',
        'Office IP Deskphone', 'Office Printing & Scan Service', 'Shared Folder'
    ],
    'Library': ['Checkout Request', 'Library Book', 'Library eResource', 'Turnitin'],
    'Operation and Maintenance Office': [],
    'Procurement and Asset Management Office': ['Canteen'],
    'Student Affairs Office': [
        'Career Services', 'Counselling', 'Extra Curricular Activities',
        'Helpdesk', 'International Student Affairs'
    ]
};

const deptSelect = document.getElementById('department');
const catSelect = document.getElementById('category');

function populateCategories(dept) {
    const categories = CATEGORY_MAP[dept] ?? null;
    catSelect.innerHTML = '';
    if (!categories || categories.length === 0) {
        catSelect.disabled = true;
        catSelect.removeAttribute('required');
        const opt = document.createElement('option');
        opt.value = 'N/A'; opt.textContent = 'Not Applicable'; opt.selected = true;
        catSelect.appendChild(opt);
    } else {
        catSelect.disabled = false;
        catSelect.setAttribute('required', 'required');
        const placeholder = document.createElement('option');
        placeholder.value = ''; placeholder.disabled = true; placeholder.selected = true;
        placeholder.textContent = 'Select category…';
        catSelect.appendChild(placeholder);
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat; opt.textContent = cat;
            catSelect.appendChild(opt);
        });
    }
}

function resetCategories() {
    catSelect.disabled = true;
    catSelect.removeAttribute('required');
    catSelect.innerHTML = '<option value="" disabled selected>Select category…</option>';
}

resetCategories();

deptSelect.addEventListener('change', () => {
    const dept = deptSelect.value;
    if (dept) populateCategories(dept);
    else resetCategories();
});

// ═══════════════════════════════════════════════════════════════════
//  FORM — SUBMISSION
// ═══════════════════════════════════════════════════════════════════
const ticketForm = document.getElementById('ticket-form');
const submitBtn = document.getElementById('submit-btn');
const submitLabel = document.getElementById('submit-label');
const submitIcon = document.getElementById('submit-icon');
const submitSpinner = document.getElementById('submit-spinner');
const errorBanner = document.getElementById('error-banner');
const errorMessage = document.getElementById('error-message');
const successView = document.getElementById('success-view');
const submitAnotherBtn = document.getElementById('submit-another-btn');

function showFormSuccess() {
    ticketForm.classList.add('hidden');
    errorBanner.classList.add('hidden');
    successView.classList.remove('hidden');
    successView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetFormView() {
    ticketForm.classList.remove('hidden');
    successView.classList.add('hidden');
    errorBanner.classList.add('hidden');
}

function showFormError(message) {
    errorMessage.textContent = message || 'Something went wrong. Please try again.';
    errorBanner.classList.remove('hidden');
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setFormLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitLabel.textContent = isLoading ? 'Submitting…' : 'Submit Question';
    submitIcon.classList.toggle('hidden', isLoading);
    submitSpinner.classList.toggle('hidden', !isLoading);
}

ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!ticketForm.checkValidity()) { ticketForm.reportValidity(); return; }
    setFormLoading(true);
    errorBanner.classList.add('hidden');
    const formData = new FormData(ticketForm);
    try {
        // Submit to local backend to save in SQLite
        const localResponse = await fetch('/api/forms', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData,
        });

        if (!localResponse.ok) {
            console.warn('Failed to save form to local database', await localResponse.text());
        }

        // Submit to n8n webhook
        const response = await fetch(N8N_TICKET_WEBHOOK_URL, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        ticketForm.reset();
        resetCategories();
        showFormSuccess();
    } catch (err) {
        showFormError(`Failed to submit: ${err.message}`);
        console.error('Ticket submission error:', err);
    } finally {
        setFormLoading(false);
    }
});

submitAnotherBtn.addEventListener('click', () => {
    ticketForm.reset();
    resetCategories();
    resetFormView();
});
