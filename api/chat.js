export default async function handler(req, res) {

  // ================================
  // CORS
  // ================================

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const body = req.body || {};

    const message = body.message;
    const history = Array.isArray(body.history)
      ? body.history
      : [];

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    // ================================
    // API KEY
    // ================================

    const apiKey =
      process.env.LITEROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "LITEROUTER_API_KEY is missing in Vercel."
      });
    }

    // ================================
    // ARES SYSTEM PROMPT
    // ================================

    const systemPrompt = `
You are ARES AI, an advanced general-purpose AI assistant.

Your job is to provide clear, practical, technically accurate answers.

GENERAL CAPABILITIES:
- General knowledge
- Programming
- HTML, CSS, JavaScript
- Websites and web development
- GitHub and deployment
- Linux and Termux
- Android troubleshooting
- Networking and TCP/IP
- DNS, HTTP, HTTPS
- Databases
- Cloud and APIs
- Cybersecurity education
- Defensive security
- Security labs and CTF learning

CYBERSECURITY:
You should understand and explain security concepts including:
- Nmap
- Wireshark
- Burp Suite
- Metasploit
- OWASP concepts
- Web vulnerabilities
- Authentication and authorization
- SQL injection concepts
- XSS concepts
- SSRF concepts
- CSRF concepts
- Network security
- Malware concepts
- RAT concepts
- DDoS concepts
- Phishing concepts
- Reverse engineering concepts
- Linux security
- Android security
- Incident response
- Threat modeling
- Vulnerability assessment

When the user asks to learn cybersecurity practically, prefer:
- Their own device
- Their own server
- Local virtual machines
- CTFs
- Intentionally vulnerable applications
- Security labs
- Authorized penetration-testing environments

For commands:
- Put commands inside fenced code blocks using triple backticks.
- Always explain briefly what the command does.
- If useful, provide prerequisites and expected output.
- Never invent command output.
- Prefer commands that are appropriate for the stated environment.

For dangerous cybersecurity requests:
- Explain the concept and defensive side.
- Provide safe lab/CTF alternatives.
- Do not provide instructions for harming real systems, stealing credentials, deploying malware against others, bypassing security, or disrupting real networks.

RESPONSE STYLE:
- Be practical.
- Do not unnecessarily repeat the user's question.
- Use headings when useful.
- Keep simple questions concise.
- For technical tasks, give exact steps.
- If commands are needed, provide copyable code blocks.
- If the user is troubleshooting an error, diagnose the error first.
- Remember the conversation context supplied to you.
`;

    // ================================
    // BUILD CONVERSATION
    // ================================

    const cleanedHistory = history
      .filter(item =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
      )
      .slice(-12);

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...cleanedHistory,
      {
        role: "user",
        content: message
      }
    ];

    // ================================
    // LITEROUTER
    // ================================

    const response = await fetch(
      "https://api.literouter.com/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          model: "glm-5.3-flash:free",

          messages,

          temperature: 0.55,

          // Smaller response = generally faster
          max_tokens: 1400
        })
      }
    );

    const raw = await response.text();

    let data = {};

    try {
      data = raw
        ? JSON.parse(raw)
        : {};
    } catch {
      data = {};
    }

    // ================================
    // LITEROUTER ERROR
    // ================================

    if (!response.ok) {

      console.error(
        "LiteRouter error:",
        response.status,
        raw
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.error?.code ||
          raw ||
          `LiteRouter HTTP ${response.status}`
      });
    }

    // ================================
    // RESPONSE
    // ================================

    const reply =
      data?.choices?.[0]?.message?.content;

    if (!reply) {

      console.error(
        "Empty LiteRouter response:",
        raw
      );

      return res.status(502).json({
        error: "LiteRouter returned an empty response."
      });
    }

    return res.status(200).json({
      reply
    });

  } catch (error) {

    console.error(
      "ARES backend error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Backend request failed."
    });
  }
}
