(function () {
  var ASSISTANT_API = "/api/assistant";
  var STORAGE_KEY = "lonelyguy_chat";
  var MAX_HISTORY = 30;
  var conversation = [];

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) conversation = JSON.parse(saved);
  } catch (e) {}

  function buildContext() {
    var content = window.PORTFOLIO_CONTENT;
    if (!content) return "";
    var parts = [];

    var sections = ["updates", "articles", "papers"];
    for (var si = 0; si < sections.length; si++) {
      var key = sections[si];
      var items = content[key] || [];
      parts.push("== " + key.toUpperCase() + " (" + items.length + " items) ==");
      for (var ii = 0; ii < items.length; ii++) {
        var item = items[ii];
        parts.push("  - " + item.id + ": " + item.title + " (" + item.dateLabel + ") - " + (item.summary || ""));
      }
    }

    var gallery = content.gallery || [];
    parts.push("== GALLERY (" + gallery.length + " images) ==");
    for (var gi = 0; gi < gallery.length; gi++) {
      parts.push("  - " + (gallery[gi].alt || gallery[gi].caption || ""));
    }

    var projects = content.projects || [];
    if (projects.length) {
      parts.push("== PROJECTS (" + projects.length + " repos) ==");
      for (var pi = 0; pi < projects.length; pi++) {
        parts.push("  - " + projects[pi].title);
      }
    }

    return parts.join("\n");
  }

  function saveConversation() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation.slice(-MAX_HISTORY)));
    } catch (e) {}
  }

  function createUI() {
    var container = document.createElement("div");
    container.id = "assistant-container";
    container.innerHTML = [
      "<button id=\"assistant-toggle\" class=\"assistant-toggle\" type=\"button\" aria-label=\"ask loner's agent\" title=\"loner's agent\">",
      "<svg width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/></svg>",
      "</button>",
      "<div id=\"assistant-panel\" class=\"assistant-panel\" hidden>",
      "<div class=\"assistant-head\">",
      "<span class=\"assistant-name\">loner's agent</span>",
      "<button id=\"assistant-close\" class=\"assistant-close\" type=\"button\" aria-label=\"close\">close</button>",
      "</div>",
      "<div class=\"assistant-body\" id=\"assistant-body\">",
      "<div class=\"assistant-msg assistant-msg--bot\">hey! ask me anything about the site or the work here :)</div>",
      "</div>",
      "<form id=\"assistant-form\" class=\"assistant-form\">",
      "<input id=\"assistant-input\" class=\"assistant-input\" type=\"text\" placeholder=\"ask something...\" autocomplete=\"off\">",
      "<button class=\"assistant-send\" type=\"submit\" aria-label=\"send\">send</button>",
      "</form>",
      "</div>",
    ].join("");
    document.body.appendChild(container);

    var toggle = document.getElementById("assistant-toggle");
    var panel = document.getElementById("assistant-panel");
    var closeBtn = document.getElementById("assistant-close");
    var form = document.getElementById("assistant-form");
    var input = document.getElementById("assistant-input");
    var body = document.getElementById("assistant-body");

    restoreHistory(body);

    toggle.addEventListener("click", function () {
      var isOpen = !panel.hidden;
      panel.hidden = isOpen;
      toggle.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) setTimeout(function () { input.focus(); }, 100);
    });

    closeBtn.addEventListener("click", function () {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      input.value = "";
      addMessage(text, "user");
      sendMessage(text);
    });
  }

  function restoreHistory(body) {
    var restored = 0;
    for (var i = 0; i < conversation.length; i++) {
      if (conversation[i].role === "assistant") {
        renderBotMessage(body, conversation[i].content);
        restored++;
      } else {
        var div = document.createElement("div");
        div.className = "assistant-msg assistant-msg--user";
        div.textContent = conversation[i].content;
        body.appendChild(div);
      }
    }
    if (restored > 0) body.scrollTop = body.scrollHeight;
  }

  function addMessage(text, role) {
    var body = document.getElementById("assistant-body");
    var div = document.createElement("div");
    div.className = "assistant-msg assistant-msg--" + role;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    if (role === "user") {
      conversation.push({ role: "user", content: text });
      saveConversation();
    }
  }

  function renderBotMessage(body, text) {
    var div = document.createElement("div");
    div.className = "assistant-msg assistant-msg--bot";
    var navRegex = /[\u2192\?]\s*([\w-]+)(?::([\w-]+))?/g;
    var match;
    var lastIndex = 0;
    var actions = [];

    while ((match = navRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        div.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      actions.push({ type: match[1], id: match[2] || null });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      div.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    if (actions.length) {
      var actionDiv = document.createElement("div");
      actionDiv.className = "assistant-actions";
      for (var ai = 0; ai < actions.length; ai++) {
        (function (action) {
          var btn = document.createElement("button");
          btn.className = "assistant-action-btn";
          btn.type = "button";
          btn.textContent = action.id ? "\u2192 " + action.type + ": " + action.id : "\u2192 " + action.type;
          btn.addEventListener("click", function () {
            if (typeof window.assistantNavigate === "function") {
              window.assistantNavigate(action.type, action.id);
            }
          });
          actionDiv.appendChild(btn);
        })(actions[ai]);
      }
      div.appendChild(actionDiv);
    }

    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  function showTyping(body) {
    var div = document.createElement("div");
    div.className = "assistant-msg assistant-msg--bot assistant-msg--typing";
    div.textContent = "thinking";
    div.id = "assistant-typing";
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;

    var dots = 0;
    div._interval = setInterval(function () {
      dots = (dots + 1) % 4;
      div.textContent = "thinking" + ".".repeat(dots);
    }, 400);
  }

  function hideTyping() {
    var el = document.getElementById("assistant-typing");
    if (el) {
      clearInterval(el._interval);
      el.remove();
    }
  }

  function addBotMessage(text) {
    var body = document.getElementById("assistant-body");
    var node = renderBotMessage(body, text);
    conversation.push({ role: "assistant", content: text });
    saveConversation();
  }

  function sendMessage(text) {
    var body = document.getElementById("assistant-body");
    showTyping(body);
    var context = buildContext();
    var recent = conversation.slice(-10);
    var currentTab = window.currentTab || "home";

    fetch(ASSISTANT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: recent, context: context, currentTab: currentTab, stream: true }),
    }).then(async function (response) {
      if (!response.ok) {
        hideTyping();
        addBotMessage("couldnt reach the agent. try again?");
        return;
      }

      var contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("text/event-stream")) {
        return handleStream(response);
      }

      hideTyping();
      var data = await response.json();
      addBotMessage(data.reply || "couldnt get an answer. try again?");
    }).catch(function () {
      hideTyping();
      addBotMessage("something went wrong. try again?");
    });
  }

  async function handleStream(response) {
    var body = document.getElementById("assistant-body");
    hideTyping();

    var msgDiv = document.createElement("div");
    msgDiv.className = "assistant-msg assistant-msg--bot";
    body.appendChild(msgDiv);

    var fullText = "";
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var navActions = [];
    var textNode = document.createTextNode("");
    msgDiv.appendChild(textNode);

    try {
      while (true) {
        var result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });

        var lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (var li = 0; li < lines.length; li++) {
          var line = lines[li].trim();
          if (!line || !line.startsWith("data: ")) continue;
          var jsonStr = line.slice(6);
          if (jsonStr === "[DONE]") continue;
          try {
            var chunk = JSON.parse(jsonStr);
            var token = chunk.token || "";
            if (token) {
              fullText += token;
              textNode.nodeValue = fullText;
              body.scrollTop = body.scrollHeight;
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error("Stream read error:", err);
    }

    var navRegex = /[\u2192\?]\s*([\w-]+)(?::([\w-]+))?/g;
    var match;
    while ((match = navRegex.exec(fullText)) !== null) {
      navActions.push({ type: match[1], id: match[2] || null });
    }

    if (navActions.length) {
      var actionDiv = document.createElement("div");
      actionDiv.className = "assistant-actions";
      for (var ai = 0; ai < navActions.length; ai++) {
        (function (action) {
          var btn = document.createElement("button");
          btn.className = "assistant-action-btn";
          btn.type = "button";
          btn.textContent = action.id ? "\u2192 " + action.type + ": " + action.id : "\u2192 " + action.type;
          btn.addEventListener("click", function () {
            if (typeof window.assistantNavigate === "function") {
              window.assistantNavigate(action.type, action.id);
            }
          });
          actionDiv.appendChild(btn);
        })(navActions[ai]);
      }
      msgDiv.appendChild(actionDiv);
    }

    conversation.push({ role: "assistant", content: fullText });
    saveConversation();
    body.scrollTop = body.scrollHeight;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createUI);
  } else {
    createUI();
  }
})();
