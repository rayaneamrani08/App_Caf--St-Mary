import { put, list } from "@vercel/blob";

const PATHNAME = "data/cash-history.json";
const MAX_ENTRIES = 200;

async function readHistory() {
  const { blobs } = await list({ prefix: PATHNAME });
  if (blobs.length === 0) return [];
  const latest = [...blobs].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  const res = await fetch(latest.url, { cache: "no-store" });
  if (!res.ok) return [];
  return await res.json();
}

async function writeHistory(history) {
  await put(PATHNAME, JSON.stringify(history), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const history = await readHistory();
    return res.status(200).json({ history });
  }

  if (req.method === "POST") {
    const entry = req.body;
    if (!entry || typeof entry !== "object" || !entry.id) {
      return res.status(400).json({ error: "Entrée invalide." });
    }
    const history = await readHistory();
    const next = [entry, ...history].slice(0, MAX_ENTRIES);
    await writeHistory(next);
    return res.status(200).json({ history: next });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    const history = await readHistory();
    const next = id ? history.filter(e => e.id !== id) : [];
    await writeHistory(next);
    return res.status(200).json({ history: next });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "Méthode non autorisée." });
}
