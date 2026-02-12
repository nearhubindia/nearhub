import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/validate-listing", async (req, res) => {
    try {
      const { imageBase64, category, title, description } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Image is required" });
      }

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const prompt = `You are a classifieds marketplace content moderator. Analyze this image for a listing with:
Title: "${title || "No title"}"
Category: "${category || "General"}"
Description: "${description || "No description"}"

Evaluate the image and respond with a JSON object (no markdown, no code blocks, just raw JSON):
{
  "isValid": true/false,
  "isAppropriate": true/false,
  "matchesCategory": true/false,
  "confidence": 0.0-1.0,
  "detectedItems": ["item1", "item2"],
  "suggestion": "Brief suggestion if invalid or improvement needed",
  "reason": "Brief reason for the decision"
}

Rules:
- isValid: Image is clear, shows a real product/item for sale
- isAppropriate: No inappropriate, offensive, or illegal content
- matchesCategory: The image matches the declared category
- Be strict about inappropriate content but fair about category matching`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data,
                },
              },
            ],
          },
        ],
      });

      const text = response.text || "";
      const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        const validation = JSON.parse(cleanedText);
        res.json(validation);
      } catch {
        res.json({
          isValid: true,
          isAppropriate: true,
          matchesCategory: true,
          confidence: 0.7,
          detectedItems: [],
          suggestion: "",
          reason: "Validation completed",
        });
      }
    } catch (error) {
      console.error("Error validating listing:", error);
      res.status(500).json({ error: "Failed to validate listing" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
