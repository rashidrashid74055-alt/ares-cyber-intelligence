export default async function handler(req, res) {
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
    const { prompt, width = 1024, height = 1024 } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Prompt is required"
      });
    }

    const apiKey = process.env.LITEROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "LITEROUTER_API_KEY is missing in Vercel."
      });
    }

    const response = await fetch(
      "https://image.literouter.com/generate",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "sdxl-turbo",
          prompt,
          width,
          height
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: errorText || "Image generation failed."
      });
    }

    const imageBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") ||
      "image/jpeg"
    );

    return res.status(200).send(imageBuffer);

  } catch (error) {
    console.error("Image generation error:", error);

    return res.status(500).json({
      error: error.message || "Image generation failed."
    });
  }
}
