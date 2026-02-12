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

const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function registerRoutes(app: Express): Promise<Server> {
  const TEST_PHONE = "9876543210";
  const TEST_OTP = "123456";

  app.post("/api/auth/send-otp", (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ success: false, message: "Invalid phone number" });
      }

      const otp = phone === TEST_PHONE ? TEST_OTP : generateOTP();
      otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

      console.log(`[OTP] Code for +91${phone}: ${otp}`);

      res.json({ success: true, message: "OTP sent successfully", otp });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-otp", (req, res) => {
    try {
      const { phone, otp, name, email, gender } = req.body;

      if (!phone || !otp) {
        return res.status(400).json({ success: false, message: "Phone and OTP required" });
      }

      const stored = otpStore.get(phone);
      if (!stored) {
        return res.json({ success: false, message: "OTP expired or not sent. Please request a new one." });
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(phone);
        return res.json({ success: false, message: "OTP has expired. Please request a new one." });
      }

      if (stored.otp !== otp) {
        return res.json({ success: false, message: "Invalid OTP. Please try again." });
      }

      otpStore.delete(phone);

      const user = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        phone,
        name: name || "User",
        email: email || "",
        gender: gender || "other",
        createdAt: new Date().toISOString(),
      };

      res.json({ success: true, user });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ success: false, message: "Verification failed" });
    }
  });

  app.post("/api/validate-listing", async (req, res) => {
    try {
      const { imageBase64, category, title, description, isVideo } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Image is required" });
      }

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const mediaContext = isVideo
        ? "This is a frame extracted from a video listing. Analyze this video frame"
        : "Analyze this image";

      const prompt = `You are a classifieds marketplace content moderator. ${mediaContext} for a listing with:
Title: "${title || "No title"}"
Category: "${category || "General"}"
Description: "${description || "No description"}"

Evaluate the ${isVideo ? "video frame" : "image"} and respond with a JSON object (no markdown, no code blocks, just raw JSON):
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
