export default {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST requests are allowed." }),
        {
          status: 405,
          headers: corsHeaders
        }
      );
    }

    try {
      const body = await request.json();
      const message = body?.message;

      if (!message || typeof message !== "string") {
        return new Response(
          JSON.stringify({ error: "Message is required." }),
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return new Response(
          JSON.stringify({
            error: "GEMINI_API_KEY is not configured in Vercel."
          }),
          {
            status: 500,
            headers: corsHeaders
          }
        );
      }

      const systemInstruction =
        "You are ARES AI, a helpful general-purpose AI assistant. " +
        "Answer clearly, accurately and naturally. " +
        "For cybersecurity topics, focus on authorized testing, " +
        "defensive security, education, troubleshooting and safe lab environments. " +
        "Do not provide instructions that facilitate malware, credential theft, " +
        "unauthorized access, evasion, destructive attacks or other harmful activity.";

      // Try the newest model first, then fall back if it is temporarily unavailable.
      const models = [
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.6-flash"
      ];

      let lastError = "Gemini request failed.";

      for (const model of models) {
        let response;

        // Retry the same model for temporary server/rate-limit errors.
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await fetch(
              "https://generativelanguage.googleapis.com/v1beta/interactions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                  model,
                  input: message,
                  system_instruction: systemInstruction
                })
              }
            );
          } catch (networkError) {
            lastError =
              networkError?.message || "Network error while contacting Gemini.";
            break;
          }

          const data = await response.json();

          if (response.ok) {
            // Interactions API convenience output_text.
            if (
              typeof data?.output_text === "string" &&
              data.output_text.trim()
            ) {
              return new Response(
                JSON.stringify({
                  reply: data.output_text.trim()
                }),
                {
                  status: 200,
                  headers: corsHeaders
                }
              );
            }

            // REST response fallback: extract text from model_output steps.
            const textParts = [];

            const steps = Array.isArray(data?.steps)
              ? data.steps
              : Array.isArray(data?.output)
              ? data.output
              : [];

            for (const step of steps) {
              if (
                step?.type === "model_output" ||
                step?.type === "text"
              ) {
                const content = Array.isArray(step?.content)
                  ? step.content
                  : [];

                for (const item of content) {
                  if (
                    typeof item?.text === "string" &&
                    item.text.trim()
                  ) {
                    textParts.push(item.text.trim());
                  }
                }
              }
            }

            const reply = textParts.join("\n").trim();

            if (reply) {
              return new Response(
                JSON.stringify({ reply }),
                {
                  status: 200,
                  headers: corsHeaders
                }
              );
            }

            lastError = "Gemini returned no text response.";
            break;
          }

          lastError =
            data?.error?.message ||
            `Gemini returned HTTP ${response.status}.`;

          // Retry temporary errors.
          if (
            response.status === 429 ||
            response.status === 500 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504
          ) {
            if (attempt === 0) {
              await new Promise(resolve => setTimeout(resolve, 1500));
              continue;
            }

            // Move to the next model.
            break;
          }

          // Permanent error: don't keep retrying.
          break;
        }
      }

      return new Response(
        JSON.stringify({
          error:
            "ARES could not get a response from Gemini. " +
            lastError
        }),
        {
          status: 503,
          headers: corsHeaders
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error?.message || "Server error."
        }),
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }
  }
};
