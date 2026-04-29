import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateCertificateImage } from "../../src/lib/certificates";
import { certificateRequestSchema } from "../../src/validation";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CERTIFICATE_RENDER_SECRET;
  if (secret) {
    const auth = req.headers["authorization"];
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
  }

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
    console.error("[certificate-generate]", error);
    return res.status(500).json({
      success: false,
      error: "Certificate generation failed.",
      message,
    });
  }
}
