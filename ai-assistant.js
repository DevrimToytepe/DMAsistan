export function initAIAssistant() {
    // Sadece bir kez yükle
    if (document.getElementById('dma-ai-wrapper')) return;

    // Stil Ekleme
    const style = document.createElement('style');
    style.textContent = `
        #dma-ai-wrapper {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 999999;
            font-family: 'Inter', sans-serif;
        }

        #dma-ai-btn {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7C3AED, #F43F75);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
            border: none;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
        }

        #dma-ai-btn:hover {
            transform: scale(1.08) translateY(-4px);
        }

        #dma-ai-btn .ping {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: rgba(244, 63, 117, 0.5);
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
            z-index: -1;
        }

        @keyframes ping {
            75%, 100% {
                transform: scale(1.5);
                opacity: 0;
            }
        }

        #dma-ai-window {
            position: absolute;
            bottom: 76px;
            right: 0;
            width: 380px;
            height: 520px;
            background: var(--bg-2, #0F1428);
            backdrop-filter: blur(12px);
            border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform-origin: bottom right;
            transform: scale(0.9);
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        #dma-ai-window.open {
            transform: scale(1);
            opacity: 1;
            pointer-events: all;
        }

        .ai-header {
            padding: 16px;
            background: rgba(124, 58, 237, 0.1);
            border-bottom: 1px solid rgba(124, 58, 237, 0.2);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .ai-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7C3AED, #F43F75);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 0 10px rgba(244, 63, 117, 0.4);
        }

        .ai-title {
            color: white;
            font-family: 'Sora', sans-serif;
            font-weight: 700;
            font-size: 1rem;
            flex: 1;
        }

        .ai-status {
            font-size: 0.72rem;
            color: #22c55e;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .ai-status::before {
            content: '';
            width: 6px;
            height: 6px;
            background: #22c55e;
            border-radius: 50%;
            box-shadow: 0 0 6px #22c55e;
        }

        .ai-close {
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            cursor: pointer;
            font-size: 1.2rem;
            transition: color 0.2s;
        }

        .ai-close:hover {
            color: #f43f5e;
        }

        .ai-body {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .ai-body::-webkit-scrollbar {
            width: 4px;
        }

        .ai-body::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }

        .msg-wrap {
            display: flex;
            flex-direction: column;
            max-width: 85%;
        }

        .msg-wrap.bot {
            align-self: flex-start;
        }

        .msg-wrap.user {
            align-self: flex-end;
        }

        .msg-bubble {
            padding: 12px 14px;
            border-radius: 12px;
            font-size: 0.88rem;
            line-height: 1.5;
            color: white;
        }

        .msg-wrap.bot .msg-bubble {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-top-left-radius: 4px;
        }

        .msg-wrap.user .msg-bubble {
            background: var(--gradient);
            border-top-right-radius: 4px;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
        }

        .msg-time {
            font-size: 0.65rem;
            color: rgba(255, 255, 255, 0.4);
            margin-top: 4px;
            align-self: flex-end;
        }

        .ai-suggestions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
        }

        .ai-sugg-btn {
            background: rgba(124, 58, 237, 0.1);
            border: 1px solid rgba(124, 58, 237, 0.3);
            color: #c4b5fd;
            padding: 6px 12px;
            border-radius: 100px;
            font-size: 0.75rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .ai-sugg-btn:hover {
            background: rgba(124, 58, 237, 0.3);
            color: white;
        }

        .ai-footer {
            padding: 16px;
            border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
            background: var(--bg, #0A0E1A);
            display: flex;
            flex-direction: column;
            gap: 8px;
            border-bottom-left-radius: 16px;
            border-bottom-right-radius: 16px;
        }

        .ai-limit-bar {
            display: flex;
            justify-content: space-between;
            font-size: 0.7rem;
            color: rgba(255, 255, 255, 0.4);
        }

        .ai-input-wrap {
            display: flex;
            gap: 8px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 4px;
            transition: border-color 0.3s;
        }

        .ai-input-wrap:focus-within {
            border-color: #7C3AED;
        }

        #dma-ai-input {
            flex: 1;
            background: transparent;
            border: none;
            color: white;
            padding: 8px 12px;
            font-family: inherit;
            font-size: 0.85rem;
            outline: none;
        }

        #dma-ai-input::placeholder {
            color: rgba(255, 255, 255, 0.3);
        }

        #dma-ai-send {
            background: #7C3AED;
            color: white;
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.2s;
        }

        #dma-ai-send:hover {
            background: #F43F75;
        }
            
        .ai-typing {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
        }

        .ai-typing span {
            width: 6px;
            height: 6px;
            background: rgba(255, 255, 255, 0.4);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
        }

        .ai-typing span:nth-child(1) { animation-delay: -0.32s; }
        .ai-typing span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        .limit-reached {
            background: rgba(244, 63, 117, 0.1);
            border: 1px solid rgba(244, 63, 117, 0.3);
            border-radius: 8px;
            padding: 12px;
            text-align: center;
            color: #fca5a5;
            font-size: 0.82rem;
            margin-top: 10px;
        }

        @media(max-width: 480px) {
            #dma-ai-window {
                width: calc(100vw - 40px);
                height: 60vh;
                right: -4px;
                bottom: 64px;
            }
        }
    `;
    document.head.appendChild(style);

    // HTML Yapısını Ekleme
    const wrapper = document.createElement('div');
    wrapper.id = 'dma-ai-wrapper';

    wrapper.innerHTML = `
        <button id="dma-ai-btn">
            💬
            <div class="ping"></div>
        </button>
        
        <div id="dma-ai-window">
            <div class="ai-header">
                <div class="ai-avatar">🤖</div>
                <div style="flex:1">
                    <div class="ai-title">DMAsistan Rehber AI</div>
                    <div class="ai-status">Çevrimiçi</div>
                </div>
                <button class="ai-close">✖</button>
            </div>
            
            <div class="ai-body" id="dma-ai-chat-body">
                <!-- Welcome Message -->
            </div>
            
            <div class="ai-footer">
                <div class="ai-limit-bar">
                    <span id="ai-limit-text">...</span>
                </div>
                <div class="ai-input-wrap">
                    <input type="text" id="dma-ai-input" placeholder="Bana bir şey sorun..." autocomplete="off" />
                    <button id="dma-ai-send">➤</button>
                </div>
                <div id="ai-limit-warning" style="display:none;" class="limit-reached"></div>
            </div>
        </div>
    `;

    document.body.appendChild(wrapper);

    // Etkileşimler
    const btn = document.getElementById('dma-ai-btn');
    const win = document.getElementById('dma-ai-window');
    const closeBtn = document.querySelector('.ai-close');
    const input = document.getElementById('dma-ai-input');
    const sendBtn = document.getElementById('dma-ai-send');
    const chatBody = document.getElementById('dma-ai-chat-body');
    const limitWarning = document.getElementById('ai-limit-warning');
    const inputWrap = document.querySelector('.ai-input-wrap');

    let currentLimit = { total: 0, used: 0 };
    let hasReachedLimit = false;

    // Supabase Import (window._supabase if available)
    const supabase = window._supabase || null;

    btn.addEventListener('click', () => {
        win.classList.toggle('open');
        if (win.classList.contains('open')) {
            setTimeout(() => input.focus(), 300);
            if (chatBody.children.length === 0) {
                initChat();
            }
        }
    });

    closeBtn.addEventListener('click', () => {
        win.classList.remove('open');
    });

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    async function initChat() {
        // Hoşgeldin MESAJI
        appendMessage('bot', `Merhaba! Ben DMAsistan AI. Şu an <b>${getPageName()}</b> sayfasındasınız. Size nasıl yardımcı olabilirim?`);

        // Öneriler
        const suggestionsBox = document.createElement('div');
        suggestionsBox.className = 'ai-suggestions';

        const suggestions = getSuggestionsForPage();
        suggestions.forEach(text => {
            const btn = document.createElement('button');
            btn.className = 'ai-sugg-btn';
            btn.textContent = text;
            btn.onclick = () => {
                input.value = text;
                handleSend();
            };
            suggestionsBox.appendChild(btn);
        });
        chatBody.appendChild(suggestionsBox);

        // Kullanım Limiti Çekme
        if (supabase) {
            await fetchUsage();
            await loadHistory();
        }
    }

    function getPageName() {
        const path = window.location.pathname;
        if (path.includes('dashboard')) return 'Dashboard (Gösterge Paneli)';
        if (path.includes('integrations')) return 'Entegrasyonlar';
        if (path.includes('billing')) return 'Faturalama ve Abonelik';
        if (path.includes('automation') || path.includes('settings')) return 'Ayarlar';
        return 'Sistem';
    }

    function getSuggestionsForPage() {
        const path = window.location.pathname;
        if (path.includes('dashboard')) {
            return ["Raporları nasıl incelerim?", "Yeni asistan ekle", "Dakikalarım nerede?"];
        }
        if (path.includes('integrations')) {
            return ["Instagram nasıl bağlanır?", "Vapi nedir?", "Bağlantıda sorun yaşıyorum"];
        }
        if (path.includes('billing')) {
            return ["Paketimi nasıl yükseltirim?", "İyzico ile güvende miyim?", "Dakika satın al"];
        }
        return ["Instagram nasıl bağlanır?", "Paketimi nasıl yükseltirim?", "AI ayarlarını nasıl yaparım?"];
    }

    async function handleSend() {
        if (hasReachedLimit) return;

        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        appendMessage('user', text);
        chatBody.scrollTop = chatBody.scrollHeight;

        // "Typing" göstergesi
        const typingId = 'typing-' + Date.now();
        appendTyping(typingId);

        if (!supabase) {
            setTimeout(() => {
                removeTyping(typingId);
                appendMessage('bot', "⚠️ Sisteme giriş yapmadığınız için AI API ile bağlantı kurulamıyor.");
            }, 1000);
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Oturum yok");

            const currentPage = getPageName();

            // AI İsteği Gönderimi
            const { data, error } = await supabase.functions.invoke('chat-assistant', {
                body: { message: text, page: currentPage, user_id: session.user.id }
            });

            removeTyping(typingId);

            if (error || data?.error) {
                if (data?.error === 'rate_limit') {
                    handleLimitReached();
                } else {
                    appendMessage('bot', "❌ Bir hata oluştu: " + (data?.error || error.message));
                }
                return;
            }

            // Başarılı
            appendMessage('bot', data.response);

            // Limit Güncelleme
            if (data.usage) {
                currentLimit = data.usage;
                updateLimitUI();
            }

            chatBody.scrollTop = chatBody.scrollHeight;
        } catch (err) {
            removeTyping(typingId);
            appendMessage('bot', "❌ Bağlantı hatası lütfen tekrar deneyin.");
        }
    }

    function appendMessage(sender, htmlContent) {
        const wrap = document.createElement('div');
        wrap.className = `msg-wrap ${sender}`;

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = htmlContent;

        const time = document.createElement('div');
        time.className = 'msg-time';
        const d = new Date();
        time.textContent = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

        wrap.appendChild(bubble);
        wrap.appendChild(time);

        const suggBox = chatBody.querySelector('.ai-suggestions');
        if (suggBox) {
            chatBody.insertBefore(wrap, suggBox);
        } else {
            chatBody.appendChild(wrap);
        }

        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function appendTyping(id) {
        const wrap = document.createElement('div');
        wrap.className = 'msg-wrap bot';
        wrap.id = id;
        wrap.innerHTML = `<div class="msg-bubble ai-typing"><span></span><span></span><span></span></div>`;
        const suggBox = chatBody.querySelector('.ai-suggestions');
        if (suggBox) chatBody.insertBefore(wrap, suggBox);
        else chatBody.appendChild(wrap);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function removeTyping(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    async function fetchUsage() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Edge Function'dan Limiti Çek
        const { data } = await supabase.functions.invoke('chat-assistant', {
            body: { check_limit: true, user_id: session.user.id }
        });

        if (data?.usage) {
            currentLimit = data.usage;
            updateLimitUI();
        }
    }

    async function loadHistory() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data } = await supabase.from('ai_chat_logs')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (data && data.length > 0) {
            // Geçmiş mesajları sondan başa ekle (eski başa, yeni sona)
            const suggBox = chatBody.querySelector('.ai-suggestions');
            data.reverse().forEach(log => {
                const wrap = document.createElement('div');
                wrap.className = `msg-wrap ${log.role === 'user' ? 'user' : 'bot'}`;
                wrap.innerHTML = `<div class="msg-bubble">${log.content}</div>`;
                chatBody.insertBefore(wrap, suggBox || chatBody.firstChild);
            });
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    }

    function updateLimitUI() {
        const limitText = document.getElementById('ai-limit-text');
        limitText.textContent = `${currentLimit.used} / ${currentLimit.total} mesaj`;

        if (currentLimit.used >= currentLimit.total) {
            handleLimitReached();
        }
    }

    function handleLimitReached() {
        hasReachedLimit = true;
        inputWrap.style.display = 'none';
        limitWarning.style.display = 'block';
        limitWarning.innerHTML = `
            Bugünlük mesaj limitinize ulaştınız.<br>
            Limiti artırmak için planınızı yükseltin.<br>
            <button onclick="location.href='billing.html'" style="margin-top:8px; background:var(--gradient); border:none; color:white; padding:6px 12px; border-radius:6px; cursor:pointer;">Planı Yükselt ⚡</button>
        `;
    }
}

// Sayfa yüklendiğinde otomatik çalıştır
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAIAssistant);
} else {
    initAIAssistant();
}
