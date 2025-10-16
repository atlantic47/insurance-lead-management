(function() {
  'use strict';

  // Widget configuration with defaults
  let WIDGET_CONFIG = {
    apiBaseUrl: window.CHATBOT_CONFIG?.apiUrl || 'http://localhost:3001',
    widgetId: window.CHATBOT_CONFIG?.widgetId || 'default',
    position: window.CHATBOT_CONFIG?.position || 'bottom-right',
    primaryColor: window.CHATBOT_CONFIG?.primaryColor || '#3B82F6',
    buttonText: window.CHATBOT_CONFIG?.buttonText || 'Chat with us',
    greeting: window.CHATBOT_CONFIG?.greeting || 'Hi! How can I help you today?',
    title: window.CHATBOT_CONFIG?.title || 'Chat Support',
    subtitle: window.CHATBOT_CONFIG?.subtitle || 'We usually reply within minutes',
    avatar: window.CHATBOT_CONFIG?.avatar || null,
    showQuickReplies: window.CHATBOT_CONFIG?.showQuickReplies !== false,
    quickReplies: window.CHATBOT_CONFIG?.quickReplies || [
      'Get a quote',
      'File a claim',
      'Talk to agent'
    ],
    buttonStyle: window.CHATBOT_CONFIG?.buttonStyle || 'pill', // 'pill' or 'circle'
  };

  // Widget state
  let isOpen = false;
  let conversationId = null;
  let messages = [];
  let quickRepliesShown = false;
  let userInfo = { name: null, email: null, phone: null };
  let awaitingEscalation = false;

  // Fetch widget configuration from server
  async function fetchWidgetConfig() {
    try {
      const response = await fetch(WIDGET_CONFIG.apiBaseUrl + '/ai/widget/config/' + WIDGET_CONFIG.widgetId);
      if (response.ok) {
        const serverConfig = await response.json();
        WIDGET_CONFIG = Object.assign({}, WIDGET_CONFIG, serverConfig);
      }
    } catch (error) {
      console.warn('Could not fetch widget configuration:', error);
    }
  }

  // Create widget HTML
  async function createWidget() {
    await fetchWidgetConfig();

    var widgetContainer = document.createElement('div');
    widgetContainer.id = 'insurance-chatbot-widget';
    
    var styleTag = document.createElement('style');
    styleTag.textContent = '\
      * { box-sizing: border-box; }\
      #insurance-chatbot-widget {\
        position: fixed;\
        ' + (WIDGET_CONFIG.position.includes('right') ? 'right: 20px;' : 'left: 20px;') + '\
        ' + (WIDGET_CONFIG.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;') + '\
        z-index: 999999;\
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;\
      }\
      .chatbot-trigger {\
        ' + (WIDGET_CONFIG.buttonStyle === 'pill' ? '\
          padding: 14px 24px;\
          border-radius: 30px;\
          display: inline-flex;\
          align-items: center;\
          gap: 10px;\
        ' : '\
          width: 60px;\
          height: 60px;\
          border-radius: 50%;\
          display: flex;\
          align-items: center;\
          justify-content: center;\
        ') + '\
        background: ' + WIDGET_CONFIG.primaryColor + ';\
        border: none;\
        cursor: pointer;\
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);\
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\
        color: white;\
        font-size: 15px;\
        font-weight: 600;\
      }\
      .chatbot-trigger:hover {\
        transform: translateY(-2px);\
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1);\
      }\
      .trigger-icon { width: 24px; height: 24px; fill: white; flex-shrink: 0; }\
      .trigger-text { ' + (WIDGET_CONFIG.buttonStyle === 'circle' ? 'display: none;' : '') + ' }\
      .chatbot-window {\
        position: absolute;\
        ' + (WIDGET_CONFIG.position.includes('right') ? 'right: 0;' : 'left: 0;') + '\
        ' + (WIDGET_CONFIG.position.includes('bottom') ? 'bottom: 80px;' : 'top: 80px;') + '\
        width: 380px; max-width: calc(100vw - 40px);\
        height: 550px; max-height: calc(100vh - 120px);\
        background: white; border-radius: 16px;\
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);\
        display: none; flex-direction: column; overflow: hidden;\
      }\
      .chatbot-window.open { display: flex; animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1); }\
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }\
      .chatbot-header { background: ' + WIDGET_CONFIG.primaryColor + '; color: white; padding: 20px; display: flex; align-items: center; gap: 12px; }\
      .header-avatar { width: 42px; height: 42px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }\
      .header-avatar svg { width: 24px; height: 24px; fill: white; }\
      .header-info { flex: 1; }\
      .header-title { font-size: 17px; font-weight: 700; margin: 0 0 2px 0; }\
      .header-subtitle { font-size: 13px; opacity: 0.9; margin: 0; }\
      .chatbot-close { background: rgba(255, 255, 255, 0.2); border: none; color: white; cursor: pointer; padding: 8px; border-radius: 8px; font-size: 20px; line-height: 1; transition: background 0.2s; width: 32px; height: 32px; flex-shrink: 0; }\
      .chatbot-close:hover { background: rgba(255, 255, 255, 0.3); }\
      .chatbot-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; background: #F9FAFB; }\
      .chatbot-messages::-webkit-scrollbar { width: 6px; }\
      .chatbot-messages::-webkit-scrollbar-track { background: transparent; }\
      .chatbot-messages::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }\
      .message { max-width: 80%; padding: 12px 16px; border-radius: 18px; font-size: 15px; line-height: 1.5; word-wrap: break-word; }\
      .message.user { background: ' + WIDGET_CONFIG.primaryColor + '; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }\
      .message.bot { background: white; color: #1F2937; align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }\
      .message.system { background: #FEF3C7; color: #92400E; align-self: center; border-radius: 12px; font-size: 14px; padding: 10px 14px; max-width: 90%; text-align: center; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }\
      .message.typing { background: white; color: #6B7280; align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); padding: 16px; }\
      .typing-indicator { display: flex; gap: 6px; align-items: center; }\
      .typing-dot { width: 8px; height: 8px; border-radius: 50%; background: #9CA3AF; animation: typing 1.4s infinite; }\
      .typing-dot:nth-child(2) { animation-delay: 0.2s; }\
      .typing-dot:nth-child(3) { animation-delay: 0.4s; }\
      @keyframes typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.6; } 30% { transform: translateY(-10px); opacity: 1; } }\
      .quick-replies { padding: 0 20px 12px; display: flex; flex-wrap: wrap; gap: 8px; background: #F9FAFB; }\
      .quick-reply { background: white; border: 1.5px solid ' + WIDGET_CONFIG.primaryColor + '; color: ' + WIDGET_CONFIG.primaryColor + '; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }\
      .quick-reply:hover { background: ' + WIDGET_CONFIG.primaryColor + '; color: white; }\
      .chatbot-input-wrapper { padding: 16px 20px 20px; border-top: 1px solid #E5E7EB; background: white; }\
      .chatbot-input-container { display: flex; gap: 10px; align-items: center; }\
      .chatbot-input { flex: 1; border: 1.5px solid #E5E7EB; border-radius: 24px; padding: 12px 18px; font-size: 15px; outline: none; transition: border-color 0.2s; }\
      .chatbot-input:focus { border-color: ' + WIDGET_CONFIG.primaryColor + '; }\
      .chatbot-input::placeholder { color: #9CA3AF; }\
      .chatbot-send { background: ' + WIDGET_CONFIG.primaryColor + '; border: none; border-radius: 50%; width: 42px; height: 42px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }\
      .chatbot-send:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }\
      .chatbot-send svg { width: 20px; height: 20px; fill: white; }\
      .chatbot-send:disabled { opacity: 0.5; cursor: not-allowed; }\
      .powered-by { text-align: center; padding: 12px; font-size: 12px; color: #9CA3AF; background: #F9FAFB; }\
      .powered-by a { color: ' + WIDGET_CONFIG.primaryColor + '; text-decoration: none; font-weight: 500; }\
      @media (max-width: 480px) { .chatbot-window { width: calc(100vw - 40px); height: calc(100vh - 100px); } }';
    
    widgetContainer.appendChild(styleTag);

    var triggerButton = document.createElement('button');
    triggerButton.className = 'chatbot-trigger';
    triggerButton.setAttribute('aria-label', WIDGET_CONFIG.buttonText);
    triggerButton.onclick = function() { window.toggleChatbot(); };
    triggerButton.innerHTML = '<svg class="trigger-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"/><circle cx="8.5" cy="9.5" r="1.5"/><circle cx="15.5" cy="9.5" r="1.5"/><path d="M12 15.5C10.67 15.5 9.5 14.78 9 13.75L7.5 14.5C8.33 16.17 10.08 17.25 12 17.25C13.92 17.25 15.67 16.17 16.5 14.5L15 13.75C14.5 14.78 13.33 15.5 12 15.5Z"/></svg><span class="trigger-text">' + WIDGET_CONFIG.buttonText + '</span>';
    widgetContainer.appendChild(triggerButton);

    var chatWindow = document.createElement('div');
    chatWindow.className = 'chatbot-window';
    chatWindow.id = 'chatbot-window';
    chatWindow.innerHTML = '\
      <div class="chatbot-header">\
        <div class="header-avatar"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg></div>\
        <div class="header-info">\
          <h3 class="header-title">' + WIDGET_CONFIG.title + '</h3>\
          <p class="header-subtitle">' + WIDGET_CONFIG.subtitle + '</p>\
        </div>\
        <button class="chatbot-close" onclick="window.toggleChatbot()" aria-label="Close chat">×</button>\
      </div>\
      <div class="chatbot-messages" id="chatbot-messages">\
        <div class="message bot">' + WIDGET_CONFIG.greeting + '</div>\
      </div>\
      <div class="quick-replies" id="quick-replies" style="display: none;"></div>\
      <div class="chatbot-input-wrapper">\
        <div class="chatbot-input-container">\
          <input type="text" id="chatbot-input" class="chatbot-input" placeholder="Type your message..." autocomplete="off"/>\
          <button class="chatbot-send" onclick="window.sendMessage()" id="send-button" aria-label="Send message">\
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>\
          </button>\
        </div>\
      </div>\
      <div class="powered-by">Powered by <a href="' + window.location.origin + '" target="_blank">AI Assistant</a></div>';
    
    widgetContainer.appendChild(chatWindow);
    document.body.appendChild(widgetContainer);

    var inputElement = document.getElementById('chatbot-input');
    inputElement.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') window.sendMessage();
    });

    initializeConversation();
  }

  function initializeConversation() {
    // Try to restore existing conversation from localStorage
    const storageKey = 'chatbot_conversation_' + WIDGET_CONFIG.widgetId;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const data = JSON.parse(stored);
        conversationId = data.conversationId;
        messages = data.messages || [];
        userInfo = data.userInfo || { name: null, email: null, phone: null };

        // Restore messages to UI
        var messagesContainer = document.getElementById('chatbot-messages');
        if (messagesContainer && messages.length > 0) {
          messagesContainer.innerHTML = '';
          messages.forEach(function(msg) {
            var messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + msg.role;
            messageDiv.textContent = msg.content;
            messagesContainer.appendChild(messageDiv);
          });
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        console.log('📝 Restored conversation:', conversationId);
      } catch (e) {
        console.error('Failed to restore conversation:', e);
        // If restore fails, start new conversation
        startNewConversation();
      }
    } else {
      // Start new conversation
      startNewConversation();
    }
  }

  function startNewConversation() {
    conversationId = 'widget_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    messages = [{ role: 'bot', content: WIDGET_CONFIG.greeting, timestamp: new Date() }];
    userInfo = { name: null, email: null, phone: null };
    saveConversation();
    console.log('🆕 Started new conversation:', conversationId);
  }

  function saveConversation() {
    const storageKey = 'chatbot_conversation_' + WIDGET_CONFIG.widgetId;
    const data = {
      conversationId: conversationId,
      messages: messages,
      userInfo: userInfo,
      lastUpdate: new Date().toISOString()
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  window.toggleChatbot = function() {
    var chatWindow = document.getElementById('chatbot-window');
    isOpen = !isOpen;
    if (isOpen) {
      chatWindow.classList.add('open');
      document.getElementById('chatbot-input').focus();
      if (WIDGET_CONFIG.showQuickReplies && !quickRepliesShown) {
        showQuickReplies();
        quickRepliesShown = true;
      }
    } else {
      chatWindow.classList.remove('open');
    }
  };

  function showQuickReplies() {
    var quickRepliesContainer = document.getElementById('quick-replies');
    if (!quickRepliesContainer) return;
    quickRepliesContainer.innerHTML = WIDGET_CONFIG.quickReplies.map(function(reply) {
      return '<button class="quick-reply" onclick="window.handleQuickReply(\'' + reply.replace(/'/g, "\\'") + '\')">' + reply + '</button>';
    }).join('');
    quickRepliesContainer.style.display = 'flex';
  }

  window.handleQuickReply = function(text) {
    document.getElementById('chatbot-input').value = text;
    window.sendMessage();
    document.getElementById('quick-replies').style.display = 'none';
  };

  window.sendMessage = async function() {
    var input = document.getElementById('chatbot-input');
    var messageText = input.value.trim();
    if (!messageText) return;

    addMessage('user', messageText);
    input.value = '';
    showTypingIndicator();

    try {
      var response = await fetch(WIDGET_CONFIG.apiBaseUrl + '/ai/widget/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          conversationId: conversationId,
          widgetId: WIDGET_CONFIG.widgetId,
          url: window.location.href,
          domain: window.location.hostname,
          userInfo: userInfo.name || userInfo.email || userInfo.phone ? userInfo : undefined
        })
      });

      var data = await response.json();
      removeTypingIndicator();

      var botMessage = data.response || data.message || 'Sorry, I encountered an error. Please try again.';
      addMessage('bot', botMessage);

      // Handle escalation that needs user info
      if (data.needsUserInfo && data.shouldEscalate) {
        awaitingEscalation = true;
        setTimeout(function() {
          promptForUserInfo();
        }, 1000);
      } else if (data.shouldEscalate && !data.alreadyEscalated) {
        setTimeout(function() {
          addMessage('system', '🤝 This conversation has been transferred to a human agent who will assist you shortly.');
        }, 1000);
      } else if (data.alreadyEscalated) {
        setTimeout(function() {
          addMessage('system', '👤 You are now chatting with a human agent. They will respond to you shortly.');
        }, 500);
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      removeTypingIndicator();
      addMessage('bot', 'Sorry, I\'m having trouble connecting. Please try again later or contact us directly.');
    }
  };

  function promptForUserInfo() {
    addMessage('bot', 'To better assist you, I\'d like to connect you with one of our specialists. Could you please provide your name, email, and phone number?');
    addMessage('bot', 'You can type it like: "My name is John Doe, email is john@example.com, phone is 555-1234"');
  }

  function addMessage(role, content) {
    var messagesContainer = document.getElementById('chatbot-messages');
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + role;
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    messages.push({ role: role, content: content, timestamp: new Date() });

    // Save conversation to localStorage after each message
    saveConversation();
  }

  function showTypingIndicator() {
    var messagesContainer = document.getElementById('chatbot-messages');
    var typingDiv = document.createElement('div');
    typingDiv.className = 'message typing';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    document.getElementById('send-button').disabled = true;
  }

  function removeTypingIndicator() {
    var typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) typingIndicator.remove();
    document.getElementById('send-button').disabled = false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }

  window.ChatWidget = {
    open: function() { if (!isOpen) window.toggleChatbot(); },
    close: function() { if (isOpen) window.toggleChatbot(); },
    sendMessage: function(message) {
      if (message) {
        document.getElementById('chatbot-input').value = message;
        window.sendMessage();
      }
    },
    getConversation: function() { return messages; }
  };

})();
