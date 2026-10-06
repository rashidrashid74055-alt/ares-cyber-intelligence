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

  if(req.method === "OPTIONS"){
    return res.status(204).end();
  }

  if(req.method !== "POST"){
    return res.status(405).json({
      error:"Method not allowed"
    });
  }

  try{

    const {
      message,
      history = []
    } = req.body || {};

    if(
      !message ||
      typeof message !== "string"
    ){

      return res.status(400).json({
        error:"Message is required"
      });

    }

    const apiKey =
      process.env.LITEROUTER_API_KEY;

    if(!apiKey){

      return res.status(500).json({
        error:
          "LITEROUTER_API_KEY is missing in Vercel."
      });

    }

    const SYSTEM_PROMPT = `
You are ARES AI, an advanced general-purpose AI assistant with a strong cybersecurity, Linux, networking, programming and troubleshooting focus.

You should be knowledgeable about cybersecurity concepts, Linux, networking, web security, vulnerability research, security tools, malware analysis, RAT analysis, DDoS concepts, reverse engineering, incident response, digital forensics, CTFs and authorized penetration-testing labs.

For cybersecurity hands-on requests, assume the user is working only on systems they own or an explicitly authorized lab, CTF or isolated test environment.

You may teach defensive analysis, detection, safe simulations, lab setup, benign proof-of-concepts and authorized security testing.

Do NOT provide instructions that enable unauthorized access, credential theft, real-world DDoS attacks, deployment of weaponized malware/RATs against victims, persistence, stealth/evasion, bypassing security controls, or harming real systems.

When a request crosses that boundary, redirect it toward an isolated Kali Linux lab, CTF, intentionally vulnerable VM, harmless simulation, detection or defensive analysis.

Always be practical and clear. When giving commands, explain what they do and keep them appropriate for an authorized environment.

Do not pretend to know a tool or command if you are uncertain. Say so and provide the safest accurate alternative.

You are ARES AI. Answer the user's actual question directly.
`;

    const safeHistory =
      Array.isArray(history)
        ? history
            .slice(-12)
            .filter(
              m =>
                m &&
                (m.role === "user" ||
                 m.role === "assistant") &&
                typeof m.content === "string"
            )
            .map(m => ({
              role:m.role,
              content:m.content
            }))
        : [];

    const messages = [

      {
        role:"system",
        content:SYSTEM_PROMPT
      },

      ...safeHistory,

      {
        role:"user",
        content:message
      }

    ];

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

            temperature:0.6,

            max_tokens:2048

          })
        }
      );


    const raw =
      await response.text();

    let data = {};

    try{

      data =
        raw
          ? JSON.parse(raw)
          : {};

    }catch{

      data = {};

    }


    if(!response.ok){

      console.error(
        "LiteRouter error:",
        response.status,
        raw
      );

      return res
        .status(response.status)
        .json({

          error:
            data?.error?.message ||
            data?.error?.code ||
            raw ||
            `LiteRouter HTTP ${response.status}`

        });

    }


    const reply =
      data?.choices?.[0]?.message?.content;


    if(!reply){

      return res.status(502).json({
        error:
          "LiteRouter returned no AI response."
      });

    }


    return res.status(200).json({
      reply
    });


  }catch(error){

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
