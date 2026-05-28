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
  var model = models[Math.floor(Math.random() * models.length)];
  var reasoning = process.env.ASSISTANT_REASONING !== "false";
  var reasoningEffort = process.env.ASSISTANT_REASONING_EFFORT || "high";
  var maxTokens = parseInt(process.env.ASSISTANT_MAX_TOKENS || "512", 10);
  var temperature = parseFloat(process.env.ASSISTANT_TEMPERATURE || "0.7");
  var referer = process.env.ASSISTANT_REFERER_URL || "https://lonelyguy.vercel.app";
  var siteTitle = process.env.ASSISTANT_SITE_TITLE || "Lonely Guy";

  var body = req.body || {};
  var messages = body.messages;
  var context = body.context;
  var currentTab = body.currentTab;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages required" });
  }

  var contextParts = [];
  if (context) contextParts.push("site content:\n" + context);
  if (currentTab) contextParts.push("the user is currently on the '" + currentTab + "' tab.");

  var requestBody = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextParts.join("\n\n") || "no additional context" },
    ].concat(messages),
    max_tokens: maxTokens,
    temperature: temperature,
  };

  if (reasoning) {
    requestBody.reasoning = { effort: reasoningEffort };
  }

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
    });

    if (!response.ok) {
      var errText = await response.text();
      console.error("OpenRouter error:", response.status, errText);
      return res.status(200).json({ reply: "hmm, couldnt reach the knowledge base. try again?" });
    }

    var data = await response.json();
    var reply = (data.choices?.[0]?.message?.content || "").trim();

    if (!reply) {
      return res.status(200).json({ reply: "drew a blank there. try asking differently?" });
    }

    return res.status(200).json({ reply: reply });
  } catch (err) {
    console.error("Assistant error:", err);
    return res.status(200).json({ reply: "something glitched. try again in a bit." });
  }
};