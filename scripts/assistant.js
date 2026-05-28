(function () {
  var ASSISTANT_API = "/api/assistant";
  var conversation = [];

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

  function addMessage(text, role) {
    var body = document.getElementById("assistant-body");
    var div = document.createElement("div");
    div.className = "assistant-msg assistant-msg--" + role;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    if (role === "user") {
      conversation.push({ role: "user", content: text });
    }
  }

  function addBotMessage(text) {
    var body = document.getElementById("assistant-body");
    var div = document.createElement("div");
    div.className = "assistant-msg assistant-msg--bot";
    var navRegex = /\u2192\s*([\w-]+)(?::([\w-]+))?/g;
    var match;
    var lastIndex = 0;
    var actions = [];

    while ((match = navRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        var textPart = document.createTextNode(text.slice(lastIndex, match.index));
        div.appendChild(textPart);
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
    conversation.push({ role: "assistant", content: text });
  }

  function showTyping() {
    var body = document.getElementById("assistant-body");
    var div = document.createElement("div");
    div.className = "assistant-msg assistant-msg--bot assistant-msg--typing";
    div.textContent = ".";
    div.id = "assistant-typing";
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById("assistant-typing");
    if (el) el.remove();
  }

  function sendMessage(text) {
    showTyping();
    var context = buildContext();
    var recent = conversation.slice(-10);
    var currentTab = window.currentTab || "home";

    fetch(ASSISTANT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: recent, context: context, currentTab: currentTab }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        var reply = data.reply || "couldnt get an answer. try again?";
        addBotMessage(reply);
      })
      .catch(function () {
        hideTyping();
        addBotMessage("something went wrong. try again?");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createUI);
  } else {
    createUI();
  }
})();