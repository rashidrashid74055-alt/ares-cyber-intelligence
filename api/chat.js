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

      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "OPENAI_API_KEY is not configured." }),
          { status: 500, headers: corsHeaders }
        );
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-5",
          input: [
            {
              role: "system",
              content:
                "You are ARES AI, a helpful general-purpose AI assistant. Answer clearly and accurately. For cybersecurity topics, focus on authorized testing, defensive security, learning, troubleshooting, and safe lab environments. Do not provide instructions that facilitate malware, credential theft, unauthorized access, evasion, destructive attacks, or other harmful activity."
            },
            {
              role: "user",
              content: message
            }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({
            error: data?.error?.message || "OpenAI API request failed."
          }),
          { status: response.status, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          reply: data.output_text || "I couldn't generate a response."
        }),
        { status: 200, headers: corsHeaders }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Server error."
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  }
};
