
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST."
    });
  }

  const apiKey = process.env.LITEROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "LITEROUTER_API_KEY is missing in Vercel."
    });
  }

  try {
    const body = req.body || {};
    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    if (message.length > 12000) {
      return res.status(413).json({
        error: "Message is too long."
      });
    }

    const SYSTEM_PROMPT = `You are ARES AI, a practical general-purpose AI assistant focused on cybersecurity education, Linux, Termux, Android, networking, programming, web development, GitHub, Vercel, troubleshooting, CTFs and defensive security.

Answer directly and concisely. Give clear steps and copyable code when useful. Match the user's language. Never claim to have performed actions you did not perform.

Support defensive security, authorized testing, CTFs and harmless lab simulations. Do not help with unauthorized access, credential theft, real-world DDoS, harmful malware deployment, stealth, persistence or evasion. Offer safe defensive alternatives.

Do not invent commands, facts or capabilities.`;

    const history = Array.isArray(body.history)
      ? body.history
          .slice(-6)
          .filter(
            (m) =>
              m &&
              ["user", "assistant"].includes(m.role) &&
              typeof m.content === "string" &&
              m.content.trim()
          )
          .map((m) => ({
            role: m.role,
            content: m.content.slice(0, 4000)
          }))
      : [];

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      25000
    );

    let response;
    let raw;

    try {
      response = await fetch(
        "https://api.literouter.com/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "glm-5.3-flash:free",
            messages: [
              {
                role: "system",
                content: SYSTEM_PROMPT
              },
              ...history,
              {
                role: "user",
                content: message
              }
            ],
            temperature: 0.5,
            max_tokens: 900,
            stream: false
          })
        }
      );

      raw = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      console.error(
        "LiteRouter error:",
        response.status,
        raw.slice(0, 1000)
      );

      return res.status(502).json({
        error:
          data?.error?.message ||
          `AI provider returned HTTP ${response.status}.`
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({
        error: "AI provider returned an empty reply. Try again."
      });
    }

    return res.status(200).json({
      reply: reply.trim()
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({
        error: "AI response timed out. Please try again."
      });
    }

    console.error("ARES backend error:", error);

    return res.status(500).json({
      error: "ARES backend failed. Please try again."
    });
  }
}
