/* POTENTRIX — Shared Utilities */
'use strict';

/* Service Worker Registration */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
}

window.PTX = (function () {

    /* ===== STORAGE ===== */
    function get(key, fallback) {
        return localStorage.getItem('potentrix_' + key) ?? fallback ?? null;
    }
    function set(key, val) {
        localStorage.setItem('potentrix_' + key, String(val));
    }
    function remove(key) {
        localStorage.removeItem('potentrix_' + key);
    }

    /* ===== TOAST ===== */
    var _toastTimer = null;
    function showToast(msg, duration) {
        duration = duration || 2500;
        var el = document.getElementById('toast');
        if (!el) return;
        clearTimeout(_toastTimer);
        el.textContent = msg;
        el.classList.add('toast--vis');
        _toastTimer = setTimeout(function () { el.classList.remove('toast--vis'); }, duration);
    }

    /* ===== HTML SAFETY ===== */
    var _escDiv = document.createElement('div');
    function escHtml(str) {
        _escDiv.textContent = str;
        return _escDiv.innerHTML;
    }

    function formatAIText(text) {
        // Escape ALL HTML first to prevent XSS, then apply markdown formatting
        var safe = escHtml(text);
        safe = safe
            .replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) { return '<pre><code>' + code.trim() + '</code></pre>'; })
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
        return safe;
    }

    /* ===== CONVERSATION HISTORY ===== */
    function getConversations() {
        try { return JSON.parse(localStorage.getItem('potentrix_conversations') || '[]'); }
        catch (e) { return []; }
    }

    function saveConversation(convo) {
        var all = getConversations();
        var idx = -1;
        for (var i = 0; i < all.length; i++) { if (all[i].id === convo.id) { idx = i; break; } }
        if (idx >= 0) all[idx] = convo;
        else all.unshift(convo);
        if (all.length > 50) all.length = 50;
        localStorage.setItem('potentrix_conversations', JSON.stringify(all));
    }

    function deleteConversation(id) {
        var all = getConversations().filter(function (c) { return c.id !== id; });
        localStorage.setItem('potentrix_conversations', JSON.stringify(all));
    }

    function clearConversations() {
        localStorage.removeItem('potentrix_conversations');
    }

    /* Legacy flat history for export */
    function getHistory() {
        try { return JSON.parse(localStorage.getItem('potentrix_history') || '[]'); }
        catch (e) { return []; }
    }
    function appendHistory(role, content) {
        var hist = getHistory();
        hist.push({ role: role, content: content, time: Date.now() });
        localStorage.setItem('potentrix_history', JSON.stringify(hist));
    }
    function clearHistory() {
        localStorage.removeItem('potentrix_history');
    }

    /* ===== FOCUS TRAP ===== */
    var _focusTrapEl = null;
    var _previousFocus = null;

    function _getFocusable(container) {
        return container.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
    }

    function trapFocus(container) {
        _previousFocus = document.activeElement;
        _focusTrapEl = container;
        var focusable = _getFocusable(container);
        if (focusable.length) focusable[0].focus();
        document.addEventListener('keydown', _handleFocusTrap);
    }

    function releaseFocus() {
        document.removeEventListener('keydown', _handleFocusTrap);
        if (_previousFocus && _previousFocus.focus) _previousFocus.focus();
        _focusTrapEl = null;
        _previousFocus = null;
    }

    function _handleFocusTrap(e) {
        if (!_focusTrapEl) return;
        if (e.key === 'Escape') { releaseFocus(); return; }
        if (e.key !== 'Tab') return;
        var focusable = _getFocusable(_focusTrapEl);
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    }

    /* ===== ID GENERATION ===== */
    function genId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    /* ===== ONBOARDING CHECK ===== */
    function checkOnboarding() {
        if (!get('onboarded') && !window.location.pathname.includes('01-splash')) {
            window.location.href = '01-splash-onboarding.html';
            return true;
        }
        return false;
    }

    /* ===== CONSTANTS ===== */
    var MODES = {
        friendly: { icon: '😊', name: 'Friendly', color: '#E6A520', prompt: 'You are POTENTRIX in Friendly mode. Talk like a fun best friend. Use casual language, emojis occasionally, keep it warm and energetic. Be genuinely helpful but never boring. Max 3-4 sentences unless asked for more.' },
        professional: { icon: '💼', name: 'Professional', color: '#4A9EFF', prompt: 'You are POTENTRIX in Professional mode. Be precise, structured, and authoritative. Use clear headings when needed. No slang. Deliver executive-level responses. Be concise but comprehensive.' },
        coder: { icon: '💻', name: 'Coder', color: '#00FF88', prompt: 'You are POTENTRIX in Coder mode. You are a senior full-stack engineer. Always provide clean, commented code. Explain what the code does briefly. Use modern best practices. Format code in proper code blocks.' },
        story: { icon: '📖', name: 'Story Teller', color: '#FF6B9D', prompt: 'You are POTENTRIX in Story Teller mode. You are a master storyteller and novelist. Create vivid, immersive stories with rich characters and unexpected twists. Use descriptive language that paints pictures.' },
        roast: { icon: '🔥', name: 'Roast', color: '#FF4444', prompt: 'You are POTENTRIX in Roast mode. You are a savage but loveable roast master. Roast with clever, witty, harmless humor. Never be truly mean. End every roast with a helpful answer.' },
        teacher: { icon: '🎓', name: 'Teacher', color: '#A78BFA', prompt: 'You are POTENTRIX in Teacher mode. You are the world\'s best teacher. Break down complex topics simply. Use analogies, examples, step-by-step explanations. Use the Feynman technique.' }
    };

    var LANG_MAP = {
        en: { label: '🇬🇧 English', code: 'en-US' },
        ta: { label: '🇮🇳 Tamil', code: 'ta-IN' },
        tanglish: { label: '⚡ Tanglish', code: 'ta-IN' }
    };

    var LANG_PROMPTS = {
        en: 'Always respond in English only.',
        ta: 'Always respond in Tamil language using Tamil script (தமிழ் எழுத்து). Be natural and conversational.',
        tanglish: 'Always respond in Tanglish — a natural mix of Tamil and English like how Chennai people talk.'
    };

    var SUGGESTIONS = {
        en: { friendly: ['Tell me a story', 'Motivate me', 'Fun facts', 'Joke please'], professional: ['Draft an email', 'Meeting summary', 'SWOT analysis', 'KPI report'], coder: ['Debug this code', 'React component', 'API endpoint', 'SQL query'], story: ['Epic fantasy', 'Sci-fi twist', 'Love story', 'Horror tale'], roast: ['Roast my bio', 'Roast Monday', 'Roast my cooking', 'Roast this idea'], teacher: ['Explain quantum', 'How does AI work?', 'Teach me Python', 'History of Rome'] },
        ta: { friendly: ['கதை சொல்லு', 'ஊக்கப்படுத்து', 'வேடிக்கை', 'ஜோக் சொல்லு'], professional: ['மின்னஞ்சல் எழுது', 'சுருக்கம்', 'பகுப்பாய்வு', 'அறிக்கை'], coder: ['Code எழுது', 'React component', 'Bug fix', 'Database query'], story: ['காதல் கதை', 'திகில் கதை', 'சாகச கதை', 'நகைச்சுவை'], roast: ['என்னை roast பண்ணு', 'Monday-ய roast பண்ணு', 'என் சமையல', 'என் idea'], teacher: ['Quantum explain', 'AI எப்படி?', 'Python கற்று', 'வரலாறு'] },
        tanglish: { friendly: ['Enna panrathu bro?', 'Motivate pannunga', 'Fun facts sollu', 'Joke podunga'], professional: ['Email draft pannunga', 'Meeting summary', 'Analysis pannunga', 'Report edunga'], coder: ['Code podunga', 'React component', 'Bug fix pannunga', 'Query edunga'], story: ['Story sollunga', 'Sci-fi twist', 'Love story', 'Horror pannunga'], roast: ['Enna roast pannunga', 'Monday roast', 'Cooking roast', 'Idea roast'], teacher: ['Quantum explain', 'AI eppadi?', 'Python teach', 'History sollunga'] }
    };

    /* ===== DATE HELPERS ===== */
    function formatDate(timestamp) {
        var now = new Date();
        var d = new Date(timestamp);
        var diff = now - d;
        var dayMs = 86400000;
        if (diff < dayMs && now.getDate() === d.getDate()) return 'Today';
        if (diff < dayMs * 2 && now.getDate() - d.getDate() === 1) return 'Yesterday';
        if (diff < dayMs * 7) return 'This Week';
        return d.toLocaleDateString();
    }

    function formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /* ===== PUBLIC API ===== */
    return {
        get: get, set: set, remove: remove,
        showToast: showToast,
        escHtml: escHtml, formatAIText: formatAIText,
        getConversations: getConversations, saveConversation: saveConversation,
        deleteConversation: deleteConversation, clearConversations: clearConversations,
        getHistory: getHistory, appendHistory: appendHistory, clearHistory: clearHistory,
        trapFocus: trapFocus, releaseFocus: releaseFocus,
        genId: genId, checkOnboarding: checkOnboarding,
        formatDate: formatDate, formatTime: formatTime,
        MODES: MODES, LANG_MAP: LANG_MAP, LANG_PROMPTS: LANG_PROMPTS, SUGGESTIONS: SUGGESTIONS
    };
})();
