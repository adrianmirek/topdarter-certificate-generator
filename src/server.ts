import express from "express";
import { generateCertificateImage } from "./lib/certificates";
import { certificateRequestSchema } from "./validation";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "certificate-render-vercel" });
});

app.post("/api/certificates/generate", async (req, res) => {
  const parsed = certificateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid request payload.",
      details: parsed.error.flatten(),
    });
  }

  try {
    const imageArrayBuffer = await generateCertificateImage(parsed.data);
    const imageBuffer = Buffer.from(imageArrayBuffer);
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(imageBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown generation error";
    console.error("[local-certificate-generate]", error);
    return res.status(500).json({
      success: false,
      error: "Certificate generation failed.",
      message,
    });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Certificate render service running on http://localhost:${port}`);
});
