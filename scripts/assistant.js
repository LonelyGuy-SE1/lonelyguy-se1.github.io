(function () {
  var ASSISTANT_API = "/api/assistant";
  var messages = [];
  var conversation = [];

  function buildContext() {
    var content = window.PORTFOLIO_CONTENT;
    if (!content) return "";
    var parts = [];
    var sections = ["updates", "articles", "papers"];
    for (var si = 0; si < sections.length; si++) {
      var key = sections[si];
      var items = content[key] || [];
      for (var ii = 0; ii < items.length; ii++) {
        var item = items[ii];
        parts.push(key + ": " + item.title + " — " + (item.summary || ""));
      }
    }
    var gallery = content.gallery || [];
    for (var gi = 0; gi < gallery.length; gi++) {
      parts.push("gallery: " + (gallery[gi].alt || gallery[gi].caption || ""));
    }
    return parts.join("\n");
  }

  function createUI() {
    var container = document.createElement("div");
    container.id = "assistant-container";
    container.innerHTML = [
      "<button id=\"assistant-toggle\" class=\"assistant-toggle\" type=\"button\" aria-label=\"open guide\" title=\"guide\">",
      "<svg width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/></svg>",
      "</button>",
      "<div id=\"assistant-panel\" class=\"assistant-panel\" hidden>",
      "<div class=\"assistant-head\">",
      "<span class=\"assistant-name\">guide</span>",
      "<button id=\"assistant-close\" class=\"assistant-close\" type=\"button\" aria-label=\"close guide\">close</button>",
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
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    conversation.push({ role: "user", content: text });
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

    fetch(ASSISTANT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: recent, context: context }),
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
