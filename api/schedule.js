import { put, del, list } from "@vercel/blob";

const PATHNAME = "schedule/horaire";
const MAX_BYTES = 5 * 1024 * 1024;

async function readBuffer(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { blobs } = await list({ prefix: PATHNAME });
    if (blobs.length === 0) return res.status(200).json({ url: null });
    const latest = [...blobs].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    return res.status(200).json({ url: latest.url, uploadedAt: latest.uploadedAt });
  }

  if (req.method === "PUT") {
    const contentType = req.headers["content-type"] || "image/png";
    if (!contentType.startsWith("image/")) {
      return res.status(400).json({ error: "Le fichier doit être une image." });
    }

    const buffer = await readBuffer(req);
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: "Corps de requête invalide." });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: "Image trop volumineuse (5 Mo maximum)." });
    }

    const blob = await put(PATHNAME, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return res.status(200).json({ url: blob.url, uploadedAt: new Date().toISOString() });
  }

  if (req.method === "DELETE") {
    const { blobs } = await list({ prefix: PATHNAME });
    await Promise.all(blobs.map(b => del(b.url)));
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Méthode non autorisée." });
}
