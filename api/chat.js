export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.LITEROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "LITEROUTER_API_KEY is missing in Vercel."
      });
    }

    const response = await fetch(
      "https://api.literouter.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-v4-flash-0731:free",
          messages: [
            {
              role: "system",
              content:
                "You are ARES AI, a helpful general-purpose AI assistant. Give clear, useful answers. For cybersecurity, focus on authorized testing, defensive security, education, Linux, networking, and safe labs."
            },
            {
              role: "user",
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 2048
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("LiteRouter error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          "LiteRouter request failed."
      });
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      console.error("Unexpected LiteRouter response:", data);

      return res.status(502).json({
        error: "LiteRouter returned no text response."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("ARES backend error:", error);

    return res.status(500).json({
      error: "ARES backend temporarily unavailable."
    });
  }
}
