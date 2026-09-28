export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });

  try {
    const { image } = req.body || {};
    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "A base64 image data URL is required" });
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        meal_name: { type: "string" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              portion: { type: "string" },
              kcal: { type: "number" },
              carbs_g: { type: "number" },
              protein_g: { type: "number" },
              fat_g: { type: "number" },
              fibre_g: { type: "number" }
            },
            required: ["name","portion","kcal","carbs_g","protein_g","fat_g","fibre_g"]
          }
        },
        total: {
          type: "object",
          additionalProperties: false,
          properties: {
            kcal: { type: "number" },
            carbs_g: { type: "number" },
            protein_g: { type: "number" },
            fat_g: { type: "number" },
            fibre_g: { type: "number" }
          },
          required: ["kcal","carbs_g","protein_g","fat_g","fibre_g"]
        },
        notes: { type: "string" }
      },
      required: ["meal_name","confidence","items","total","notes"]
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Analyze this meal photo for a personal food log. Identify visible foods and estimate realistic portions, calories, carbohydrate, protein, fat and fibre. Use Malaysian/Southeast Asian food names when appropriate. Treat all nutrition values as estimates, not laboratory measurements. If portion size or hidden oil/sauce is uncertain, reflect that in confidence and notes. Return the requested structured data only."
            },
            { type: "input_image", image_url: image, detail: "high" }
          ]
        }],
        text: {
          format: {
            type: "json_schema",
            name: "meal_analysis",
            strict: true,
            schema
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || "OpenAI request failed" });

    const outputText = (data.output || [])
      .flatMap(x => x.content || [])
      .find(x => x.type === "output_text")?.text;

    if (!outputText) return res.status(502).json({ error: "No structured analysis returned" });
    return res.status(200).json(JSON.parse(outputText));
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Meal analysis failed" });
  }
}
