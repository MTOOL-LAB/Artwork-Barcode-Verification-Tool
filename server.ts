import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// API routes FIRST
app.post("/api/verify-artwork", upload.single("artwork"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const inputSpec = req.body.inputSpec || "";

  try {
    const fileBase64 = req.file.buffer.toString("base64");
    
    const prompt = `You are an elite Pre-press Quality Control API pipeline.
      Analyze the uploaded barcode image for barcode and SKU.
      The user provided this standard specification: "${inputSpec}"
      Return ONLY a single, clean, minified raw JSON object matching this structure:
      {
        "detected_sku": "string",
        "real_ocr_digits": "string",
        "real_scan_digits": "string",
        "user_spec_input": "${inputSpec}",
        "match_results": { "barcode_vs_spec": boolean, "sku_vs_barcode": boolean },
        "final_verdict": "PASS_OR_FAIL",
        "fail_reason": "Clear description of mismatch or null if PASS"
      }
      Do not include markdown, backticks, or any other conversation.`;

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash", 
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { data: fileBase64, mimeType: req.file.mimetype } }
        ]
      }]
    });

    const responseText = result.text || "";
    const jsonMatch = responseText.match(/\{.*\}/s);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      res.json(data);
    } else {
      res.status(500).json({ error: "Failed to parse API response" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
