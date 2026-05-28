module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const apiUrl = process.env.ASSISTANT_API_URL || "https://openrouter.ai/api/v1/chat/completions";
  const modelsRaw = process.env.ASSISTANT_MODELS;
  const systemPrompt = process.env.ASSISTANT_SYSTEM_PROMPT;

  if (!apiKey || !modelsRaw || !systemPrompt) {
    return res.status(200).json({ reply: "loner's agent is not configured yet. come back later." });
  }

  const models = modelsRaw.split(",").map((m) => m.trim());
  const reasoning = process.env.ASSISTANT_REASONING !== "false";
  const reasoningEffort = process.env.ASSISTANT_REASONING_EFFORT || "high";
  const maxTokens = parseInt(process.env.ASSISTANT_MAX_TOKENS || "768", 10);
  const temperature = parseFloat(process.env.ASSISTANT_TEMPERATURE || "0.7");
  const referer = process.env.ASSISTANT_REFERER_URL || "https://lonelyguy.vercel.app";
  const siteTitle = process.env.ASSISTANT_SITE_TITLE || "Lonely Guy";

  const body = req.body || {};
  const messages = body.messages;
  const context = body.context;
  const currentTab = body.currentTab;
  const wantStream = body.stream === true;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages required" });
  }

  const contextParts = [];
  if (context) contextParts.push("site content:\n" + context);
  if (currentTab) contextParts.push("the user is currently on the '" + currentTab + "' tab.");

  const contextString = contextParts.join("\n\n");
  let fullSystemPrompt = systemPrompt;
  if (contextString) {
    fullSystemPrompt += "\n\nCONTEXT INFORMATION:\n" + contextString;
  }
  
  fullSystemPrompt += "\n\nCRITICAL FORMATTING INSTRUCTIONS:\n- Keep your answers concise, natural, and helpful.\n- Use standard markdown formatting.\n- DO NOT include strange artifacts, `<think>` tags, or internal reasoning in your final output.\n- For simple greetings or casual questions, reply conversationally and briefly in 1-2 sentences.";

  const openRouterMessages = [
    { role: "system", content: fullSystemPrompt }
  ].concat(messages);

  const lastUserMessage = messages.slice().reverse().find((m) => m.role === "user")?.content || "";
  const cleanMsg = lastUserMessage.trim();
  // Only trigger fast routing if the ENTIRE message is just a greeting or short conversational filler.
  const isSimpleGreeting = /^(hi|hello|hey|yo|greetings|sup|howdy|hiya|hey there|good morning|good evening|good afternoon)[\s,!?.]*$/i.test(cleanMsg) || 
                           /^(who are you|what are you|how are you|thanks|thank you|ok|okay|cool|awesome|nice)[\s,!?.]*$/i.test(cleanMsg);
  
  let currentReasoning = reasoning;
  if (isSimpleGreeting) {
    currentReasoning = false;
    if (!models.includes("google/gemini-2.5-flash")) {
      models.unshift("google/gemini-2.5-flash");
    }
  }

  async function tryModel(model) {
    const requestBody = {
      model: model,
      messages: openRouterMessages,
      max_tokens: maxTokens,
      temperature: temperature,
      stream: wantStream,
    };

    if (currentReasoning) {
      requestBody.reasoning = { effort: reasoningEffort };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 20000);

    try {
      const response = await fetch(apiUrl, {
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

  let lastError = null;

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    try {
      const response = await tryModel(model);

      if (response.ok) {
        if (wantStream) {
          return await streamResponse(response, res);
        } else {
          return await jsonResponse(response, res);
        }
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After") || response.headers.get("retry-after");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
        if (waitMs > 0 && waitMs <= 5000) {
          await new Promise((r) => setTimeout(r, waitMs));
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
  const data = await response.json();
  const reply = (data.choices?.[0]?.message?.content || "").trim();
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

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (let li = 0; li < lines.length; li++) {
        const line = lines[li].trim();
        if (!line || !line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        if (jsonStr === "[DONE]") {
          res.write("data: [DONE]\n\n");
          continue;
        }
        try {
          const chunk = JSON.parse(jsonStr);
          const token = chunk.choices?.[0]?.delta?.content || "";
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
