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
        { status: 405, headers: corsHeaders }
      );
    }

    try {
      const body = await request.json();
      const message = body?.message;

      if (!message || typeof message !== "string") {
        return new Response(
          JSON.stringify({ error: "Message is required." }),
          { status: 400, headers: corsHeaders }
        );
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "GEMINI_API_KEY is missing." }),
          { status: 500, headers: corsHeaders }
        );
      }

      const systemInstruction =
        "You are ARES AI, a fast helpful general-purpose assistant. " +
        "Answer directly and concisely unless the user asks for detail. " +
        "For cybersecurity, help with authorized testing, defensive security, " +
        "education, troubleshooting and safe labs. Do not facilitate malware, " +
        "credential theft, unauthorized access, evasion or destructive attacks.";

      const maxAttempts = 3;
      let lastError = "Temporary Gemini service error.";

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
              },
              body: JSON.stringify({
                model: "gemini-3.8-flash",
                input: message,
                system_instruction: systemInstruction,
                generation_config: {
                  thinking_level: "low",
                  temperature: 0.3
                }
              })
            }
          );

          const data = await response.json();

          if (response.ok) {
            const reply =
              data?.output_text ||
              data?.steps
                ?.filter(s => s.type === "model_output")
                ?.flatMap(s => s.content || [])
                ?.filter(c => typeof c.text === "string")
                ?.map(c => c.text)
                ?.join("\n")
                ?.trim();

            if (reply) {
              return new Response(
                JSON.stringify({ reply }),
                {
                  status: 200,
                  headers: corsHeaders
                }
              );
            }

            lastError = "Gemini returned an empty response.";
            break;
          }

          lastError =
            data?.error?.message ||
            `Gemini HTTP ${response.status}`;

          // Retry only temporary errors.
          const retryable =
            response.status === 408 ||
            response.status === 429 ||
            response.status === 500 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504;

          if (!retryable) break;

          // Short exponential backoff: 0.8s, 1.6s, 3.2s
          if (attempt < maxAttempts - 1) {
            await new Promise(resolve =>
              setTimeout(resolve, 800 * Math.pow(2, attempt))
            );
          }
        } catch (err) {
          lastError = err?.message || "Network error.";

          if (attempt < maxAttempts - 1) {
            await new Promise(resolve =>
              setTimeout(resolve, 800 * Math.pow(2, attempt))
            );
          }
        }
      }

      return new Response(
        JSON.stringify({
          error:
            "ARES temporarily unavailable. Please try again in a moment."
        }),
        {
          status: 503,
          headers: corsHeaders
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "ARES server error."
        }),
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }
  }
};
