module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  var apiKey = process.env.OPENROUTER_API_KEY;
  var apiUrl = process.env.ASSISTANT_API_URL || "https://openrouter.ai/api/v1/chat/completions";
  var modelsRaw = process.env.ASSISTANT_MODELS;
  var systemPrompt = process.env.ASSISTANT_SYSTEM_PROMPT;

  if (!apiKey || !modelsRaw || !systemPrompt) {
    return res.status(200).json({ reply: "loner's agent is not configured yet. come back later." });
  }

  var models = modelsRaw.split(",").map(function (m) { return m.trim(); });
  var reasoning = process.env.ASSISTANT_REASONING !== "false";
  var reasoningEffort = process.env.ASSISTANT_REASONING_EFFORT || "high";
  var maxTokens = parseInt(process.env.ASSISTANT_MAX_TOKENS || "768", 10);
  var temperature = parseFloat(process.env.ASSISTANT_TEMPERATURE || "0.7");
  var referer = process.env.ASSISTANT_REFERER_URL || "https://lonelyguy.vercel.app";
  var siteTitle = process.env.ASSISTANT_SITE_TITLE || "Lonely Guy";

  var body = req.body || {};
  var messages = body.messages;
  var context = body.context;
  var currentTab = body.currentTab;
  var wantStream = body.stream === true;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages required" });
  }

  var contextParts = [];
  if (context) contextParts.push("site content:\n" + context);
  if (currentTab) contextParts.push("the user is currently on the '" + currentTab + "' tab.");

  var openRouterMessages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: contextParts.join("\n\n") || "no additional context" },
  ].concat(messages);

  async function tryModel(model) {
    var requestBody = {
      model: model,
      messages: openRouterMessages,
      max_tokens: maxTokens,
      temperature: temperature,
      stream: wantStream,
    };

    if (reasoning) {
      requestBody.reasoning = { effort: reasoningEffort };
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 20000);

    try {
      var response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
          "HTTP-Referer": referer,
          "X-Title": siteTitle,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  var lastError = null;

  for (var mi = 0; mi < models.length; mi++) {
    var model = models[mi];
    try {
      var response = await tryModel(model);

      if (response.ok) {
        if (wantStream) {
          return await streamResponse(response, res);
        } else {
          return await jsonResponse(response, res);
        }
      }

      if (response.status === 429) {
        var retryAfter = response.headers.get("Retry-After") || response.headers.get("retry-after");
        var waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
        if (waitMs > 0 && waitMs <= 5000) {
          await new Promise(function (r) { setTimeout(r, waitMs); });
        }
        lastError = model + " rate limited";
        continue;
      }

      lastError = model + " returned " + response.status;
      continue;
    } catch (err) {
      lastError = model + " error: " + (err.message || err);
      continue;
    }
  }

  console.error("All models failed:", lastError);
  return res.status(200).json({ reply: "the knowledge base is swamped right now. try again in a bit?" });
};

async function jsonResponse(response, res) {
  var data = await response.json();
  var reply = (data.choices?.[0]?.message?.content || "").trim();
  if (!reply) {
    return res.status(200).json({ reply: "drew a blank there. try asking differently?" });
  }
  return res.status(200).json({ reply: reply });
}

async function streamResponse(response, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  var reader = response.body.getReader();
  var decoder = new TextDecoder();
  var buffer = "";

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
        if (jsonStr === "[DONE]") {
          res.write("data: [DONE]\n\n");
          continue;
        }
        try {
          var chunk = JSON.parse(jsonStr);
          var token = chunk.choices?.[0]?.delta?.content || "";
          if (token) {
            res.write("data: " + JSON.stringify({ token: token }) + "\n\n");
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error("Stream error:", err);
  }

  if (!res.writableEnded) {
    res.write("data: [DONE]\n\n");
    res.end();
  }
}
