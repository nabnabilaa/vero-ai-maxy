/**
 * Vero AI Embeddable Chat Widget
 * 
 * Usage: Add this to any website:
 * <script src="https://yourdomain.com/widget.js" data-agent-id="YOUR_AGENT_ID"></script>
 * 
 * Options (via data attributes):
 *   data-agent-id    — (required) Agent ID
 *   data-position    — "right" | "left" (default: "right")
 *   data-color       — Primary color (default: "#4F46E5")
 *   data-title       — Chat window title (default: "Chat with us")
 */
(function () {
    'use strict';

    // Find our script tag to read config
    var scripts = document.getElementsByTagName('script');
    var currentScript = scripts[scripts.length - 1];
    var agentId = currentScript.getAttribute('data-agent-id');
    var position = currentScript.getAttribute('data-position') || 'right';
    var color = currentScript.getAttribute('data-color') || '#4F46E5';
    var title = currentScript.getAttribute('data-title') || 'Chat with us';

    if (!agentId) {
        console.error('[Vero Widget] data-agent-id is required');
        return;
    }

    // Determine base URL from script src
    var scriptSrc = currentScript.src;
    var baseUrl = scriptSrc.substring(0, scriptSrc.lastIndexOf('/'));

    // Inject styles
    var style = document.createElement('style');
    style.textContent = [
        '#vero-chat-widget-btn{',
        '  position:fixed;bottom:20px;' + position + ':20px;z-index:99999;',
        '  width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;',
        '  background:' + color + ';color:white;',
        '  box-shadow:0 4px 20px rgba(0,0,0,0.2);',
        '  display:flex;align-items:center;justify-content:center;',
        '  transition:transform 0.3s,box-shadow 0.3s;',
        '  font-size:24px;',
        '}',
        '#vero-chat-widget-btn:hover{transform:scale(1.1);box-shadow:0 6px 24px rgba(0,0,0,0.3);}',
        '#vero-chat-widget-btn.vero-open{transform:rotate(45deg);}',
        '#vero-chat-widget-frame{',
        '  position:fixed;bottom:90px;' + position + ':20px;z-index:99998;',
        '  width:400px;height:600px;max-height:80vh;max-width:calc(100vw - 40px);',
        '  border:none;border-radius:16px;',
        '  box-shadow:0 10px 40px rgba(0,0,0,0.15);',
        '  opacity:0;transform:translateY(20px) scale(0.95);',
        '  transition:opacity 0.3s,transform 0.3s;pointer-events:none;',
        '  background:white;',
        '}',
        '#vero-chat-widget-frame.vero-visible{',
        '  opacity:1;transform:translateY(0) scale(1);pointer-events:auto;',
        '}',
        '@media (max-width:480px){',
        '  #vero-chat-widget-frame{width:100vw;height:100vh;max-height:100vh;',
        '    bottom:0;right:0;left:0;border-radius:0;}',
        '  #vero-chat-widget-btn.vero-open{display:none;}',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // Create button
    var btn = document.createElement('button');
    btn.id = 'vero-chat-widget-btn';
    btn.innerHTML = '💬';
    btn.setAttribute('aria-label', title);
    btn.setAttribute('title', title);
    document.body.appendChild(btn);

    // Create iframe (load lazily on first open)
    var iframe = document.createElement('iframe');
    iframe.id = 'vero-chat-widget-frame';
    iframe.setAttribute('allow', 'microphone; geolocation');
    iframe.setAttribute('title', title);
    document.body.appendChild(iframe);

    var isOpen = false;
    var isLoaded = false;

    btn.addEventListener('click', function () {
        isOpen = !isOpen;

        if (!isLoaded) {
            iframe.src = baseUrl + '/bot/' + agentId;
            isLoaded = true;
        }

        if (isOpen) {
            iframe.classList.add('vero-visible');
            btn.classList.add('vero-open');
            btn.innerHTML = '✕';
        } else {
            iframe.classList.remove('vero-visible');
            btn.classList.remove('vero-open');
            btn.innerHTML = '💬';
        }
    });
})();
