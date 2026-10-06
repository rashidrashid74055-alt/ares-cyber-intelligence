export default async function handler(req, res) {

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const body =
      req.body || {};

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const incomingMessages =
      Array.isArray(body.messages)
        ? body.messages
        : [];

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const apiKey =
      process.env.LITEROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "LITEROUTER_API_KEY is missing in Vercel."
      });
    }


    /* =====================================================
       ARES SYSTEM PROMPT
    ===================================================== */

    const systemPrompt = `
You are ARES AI, an advanced general-purpose AI assistant.

Your main areas of expertise include:

- General knowledge and explanations
- Linux and Termux
- Android troubleshooting
- Networking and TCP/IP
- DNS, HTTP, HTTPS and web technologies
- Programming and debugging
- HTML, CSS, JavaScript and websites
- GitHub and deployment
- Cloud and backend troubleshooting
- Cybersecurity education
- Security architecture
- Vulnerability concepts
- Secure coding
- Threat modeling
- Malware/RAT/DDoS concepts and defensive analysis
- Nmap and network troubleshooting
- CTFs and legal security labs
- Blue-team and defensive security

Answer clearly and practically.

When the user asks for commands:
1. Give the exact command in a proper fenced code block.
2. Explain briefly what the command does.
3. Explain important options/flags.
4. If multiple commands are needed, put them in separate code blocks or one clearly labeled block.
5. Prefer copy-paste-ready commands.
6. Never put fake placeholder commands where an exact safe command can be given.

For cybersecurity:
- Teach concepts deeply.
- Explain tools, vulnerabilities, malware, RATs, DDoS and offensive-security concepts at an educational level.
- For practical security testing, assume an authorized lab, CTF, local VM, emulator, or system the user owns/has explicit permission to test.
- For potentially harmful activity, keep instructions limited to safe, authorized environments and defensive learning.
- Do not provide instructions for compromising real third-party systems, credential theft, malware deployment, persistence, evasion, destructive attacks, or unauthorized access.
- When a requested technique is dangerous outside a lab, provide a safe lab equivalent instead.

For commands, use Markdown fenced code blocks such as:

\`\`\`bash
command here
\`\`\`

Do not unnecessarily repeat the user's question.

Be concise when the question is simple and detailed when the user asks for a tutorial.

Maintain context from the conversation messages supplied by the application.

If the user asks for a legal vulnerability-testing workflow, structure it as:
1. Scope
2. Reconnaissance
3. Enumeration
4. Validation
5. Risk explanation
6. Remediation
7. Safe lab practice

You are ARES AI. Be technically useful, accurate, and practical.
`;


    /* =====================================================
       BUILD CONTEXT
    ===================================================== */

    const cleanedHistory =
      incomingMessages
        .filter(
          m =>
            m &&
            (
              m.role === "user" ||
              m.role === "assistant"
            ) &&
            typeof m.content === "string"
        )
        .slice(-20);


    const messages = [
      {
        role:"system",
        content:systemPrompt
      },
      ...cleanedHistory
    ];


    /*
      Safety against malformed client history:
      always make sure the latest message exists.
    */

    if(
      !messages.some(
        m =>
          m.role === "user" &&
          m.content === message
      )
    ){

      messages.push({
        role:"user",
        content:message
      });

    }


    /* =====================================================
       LITEROUTER
    ===================================================== */

    const response =
      await fetch(
        "https://api.literouter.com/v1/chat/completions",
        {
          method:"POST",

          headers:{
            "Authorization":
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json"
          },

          body:JSON.stringify({

            model:
              "glm-5.3-flash:free",

            messages,

            temperature:
              0.65,

            max_tokens:
              2048

          })
        }
      );


    const raw =
      await response.text();

    let data = {};

    try {

      data =
        raw
          ? JSON.parse(raw)
          : {};

    } catch {

      data = {};

    }


    if(!response.ok){

      console.error(
        "LiteRouter HTTP error:",
        response.status,
        raw
      );

      return res.status(
        response.status
      ).json({

        error:
          data?.error?.message ||
          data?.error?.code ||
          raw ||
          `LiteRouter HTTP ${response.status}`

      });

    }


    const reply =
      data
        ?.choices
        ?.[0]
        ?.message
        ?.content;


    if(!reply){

      console.error(
        "LiteRouter empty response:",
        raw
      );

      return res.status(502).json({
        error:
          "LiteRouter returned no AI response."
      });

    }


    return res.status(200).json({
      reply
    });


  } catch(error){

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
