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
      const message = body.message;

      if (!message || typeof message !== "string") {
        return new Response(
          JSON.stringify({ error: "Message is required." }),
          { status: 400, headers: corsHeaders }
        );
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return new Response(
          JSON.stringify({
            error: "GEMINI_API_KEY is not configured."
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text:
                    "You are ARES AI, a helpful general-purpose AI assistant. Answer clearly, accurately and naturally. For cybersecurity topics, focus on authorized testing, defensive security, education, troubleshooting and safe lab environments. Do not provide instructions that facilitate malware, credential theft, unauthorized access, evasion, destructive attacks or other harmful activity."
                }
              ]
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: message
                  }
                ]
              }
            ]
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({
            error:
              data?.error?.message ||
              "Gemini API request failed."
          }),
          {
            status: response.status,
            headers: corsHeaders
          }
        );
      }

      const reply =
        data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("")
          .trim();

      return new Response(
        JSON.stringify({
          reply: reply || "ARES could not generate a response."
        }),
        {
          status: 200,
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
