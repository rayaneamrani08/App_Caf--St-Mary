import { useState, useCallback } from "react";

// All values in CENTS to avoid floating point issues
// Ordered smallest → biggest (petite monnaie prioritaire pour le float)
const DENOMINATIONS = [
  { label: "Pièce 5¢",    value: 5,    type: "piece",   emoji: "⚪" },
  { label: "Pièce 10¢",   value: 10,   type: "piece",   emoji: "⚪" },
  { label: "Pièce 25¢",   value: 25,   type: "piece",   emoji: "⚪" },
  { label: "Pièce 1$",    value: 100,  type: "piece",   emoji: "🟡" },
  { label: "Pièce 2$",    value: 200,  type: "piece",   emoji: "🟡" },
  { label: "Rouleau 5¢",  value: 200,  type: "rouleau", emoji: "🪙", coinValue: 5,   rouleauQty: 40 },
  { label: "Rouleau 10¢", value: 500,  type: "rouleau", emoji: "🪙", coinValue: 10,  rouleauQty: 50 },
  { label: "Rouleau 25¢", value: 1000, type: "rouleau", emoji: "🪙", coinValue: 25,  rouleauQty: 40 },
  { label: "Rouleau 1$",  value: 2500, type: "rouleau", emoji: "🪙", coinValue: 100, rouleauQty: 25 },
  { label: "Rouleau 2$",  value: 5000, type: "rouleau", emoji: "🪙", coinValue: 200, rouleauQty: 25 },
  { label: "Billet 5$",   value: 500,  type: "billet",  emoji: "💵" },
  { label: "Billet 10$",  value: 1000, type: "billet",  emoji: "💵" },
  { label: "Billet 20$",  value: 2000, type: "billet",  emoji: "💵" },
  { label: "Billet 50$",  value: 5000, type: "billet",  emoji: "💵" },
];

const FLOAT_TARGET = 30000; // 300.00$

function fmt(cents) {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

// Fill float to exactly FLOAT_TARGET, smallest denominations first.
// If small change falls short, take ONE bill (smallest available) that covers the gap,
// then give back the overshoot as depot using largest-first change-making.
function computeFloat(quantities) {
  const floatAlloc = {};
  const depotAlloc = {};

  // Init everything to depot
  for (const d of DENOMINATIONS) {
    floatAlloc[d.label] = 0;
    depotAlloc[d.label] = quantities[d.label] || 0;
  }

  let remaining = FLOAT_TARGET;

  // Step 1: greedily take small change (pieces + rouleaux + billet 5$) — all non-big billets
  for (const d of DENOMINATIONS) {
    if (remaining <= 0) break;
    const available = depotAlloc[d.label];
    const use = Math.min(available, Math.floor(remaining / d.value));
    floatAlloc[d.label] += use;
    depotAlloc[d.label] -= use;
    remaining -= use * d.value;
  }

  if (remaining === 0) return { floatAlloc, depotAlloc };

  // Step 2: still short — find smallest available bill that covers the gap
  for (const d of DENOMINATIONS) {
    if (remaining <= 0) break;
    if (depotAlloc[d.label] === 0) continue;
    if (d.value < remaining) continue; // too small, would've been caught above
    // This bill covers the remaining gap (possibly with overshoot)
    floatAlloc[d.label] += 1;
    depotAlloc[d.label] -= 1;
    remaining -= d.value;
    break; // only take one bill
  }

  // Step 3: remaining is now negative (overshoot) → give back |remaining| from float to depot
  // Use largest-first to minimize number of pieces moved back
  if (remaining < 0) {
    let overshoot = -remaining;
    for (const d of [...DENOMINATIONS].reverse()) {
      if (overshoot <= 0) break;
      const canGiveBack = Math.min(floatAlloc[d.label], Math.floor(overshoot / d.value));
      floatAlloc[d.label] -= canGiveBack;
      depotAlloc[d.label] += canGiveBack;
      overshoot -= canGiveBack * d.value;
    }
  }

  return { floatAlloc, depotAlloc };
}

function AllocTable({ alloc, title, accentColor, borderColor, bg }) {
  const rows = DENOMINATIONS.filter(d => (alloc[d.label] || 0) > 0);
  const total = rows.reduce((s, d) => s + (alloc[d.label] || 0) * d.value, 0);

  return (
    <div style={{ background: bg, border: `1.5px solid ${borderColor}`, borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${borderColor}` }}>
        <span style={{ fontSize: 12, letterSpacing: 1.5, color: accentColor, textTransform: "uppercase", fontWeight: 700 }}>{title}</span>
        <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 900, fontSize: 17, color: accentColor }}>{fmt(total)}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "10px 14px", color: "#334433", fontSize: 13 }}>Rien à mettre ici</div>
      ) : rows.map(d => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", padding: "7px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 8 }}>
          <span style={{ fontSize: 16, width: 22 }}>{d.emoji}</span>
          <span style={{ flex: 1, fontSize: 13, color: "#a8c4a0" }}>{d.label}</span>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#556655" }}>×{alloc[d.label]}</span>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: 700, color: "#e8f5e9", minWidth: 64, textAlign: "right" }}>
            {fmt((alloc[d.label] || 0) * d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DenomRow({ denom, qty, onChange }) {
  const handleInput = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d+$/.test(v)) onChange(v === "" ? "" : parseInt(v, 10));
  };
  const subtotal = (qty || 0) * denom.value;

  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #1e2a1e", gap: 10 }}>
      <span style={{ fontSize: 18, width: 26, textAlign: "center" }}>{denom.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "#a8c4a0", fontWeight: 600 }}>{denom.label}</div>
        {denom.rouleauQty && (
          <div style={{ fontSize: 10, color: "#445544", marginTop: 1 }}>
            {denom.rouleauQty} × {denom.coinValue < 100 ? denom.coinValue + "¢" : (denom.coinValue / 100) + "$"} = {fmt(denom.value)}
          </div>
        )}
      </div>
      <input
        inputMode="numeric" pattern="[0-9]*"
        value={qty === "" || qty == null ? "" : qty}
        onChange={handleInput} placeholder="0"
        style={{ width: 56, textAlign: "center", background: "#111d11", border: "1.5px solid #2e4a2e", borderRadius: 8, color: "#e8f5e9", fontSize: 17, fontFamily: "'Courier New', monospace", fontWeight: 700, padding: "6px 4px", outline: "none" }}
      />
      <div style={{ width: 72, textAlign: "right", fontSize: 13, color: subtotal > 0 ? "#66bb6a" : "#334433", fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
        {subtotal > 0 ? fmt(subtotal) : "—"}
      </div>
    </div>
  );
}

function Section({ title, keys, quantities, onChange }) {
  const total = keys.reduce((acc, d) => acc + (quantities[d.label] || 0) * d.value, 0);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "#0d1a0d", borderTop: "2px solid #2e4a2e", borderBottom: "1px solid #1e2a1e" }}>
        <span style={{ fontSize: 11, letterSpacing: 2, color: "#66bb6a", textTransform: "uppercase", fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 14, color: "#a5d6a7", fontFamily: "'Courier New', monospace", fontWeight: 700 }}>{fmt(total)}</span>
      </div>
      {keys.map(d => <DenomRow key={d.label} denom={d} qty={quantities[d.label]} onChange={v => onChange(d.label, v)} />)}
    </div>
  );
}

export default function App() {
  const [quantities, setQuantities] = useState({});
  const [result, setResult] = useState(null);

  const handleChange = useCallback((label, val) => {
    setQuantities(q => ({ ...q, [label]: val }));
    setResult(null);
  }, []);

  const totalCents = DENOMINATIONS.reduce((acc, d) => acc + (quantities[d.label] || 0) * d.value, 0);
  const canCalculate = totalCents >= FLOAT_TARGET;

  // Display sections biggest→smallest for readability
  const billets  = [...DENOMINATIONS.filter(d => d.type === "billet")].reverse();
  const rouleaux = [...DENOMINATIONS.filter(d => d.type === "rouleau")].reverse();
  const pieces   = [...DENOMINATIONS.filter(d => d.type === "piece")].reverse();

  const reset = () => { setQuantities({}); setResult(null); };

  const calculate = () => {
    if (!canCalculate) {
      setResult({ error: true, message: `Total insuffisant. Il manque ${fmt(FLOAT_TARGET - totalCents)} pour atteindre 300,00 $.` });
      return;
    }
    setResult(computeFloat(quantities));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a120a", color: "#e8f5e9", fontFamily: "'Segoe UI', sans-serif", maxWidth: 480, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg, #1b2f1b 0%, #0f1f0f 100%)", padding: "18px 16px 12px", borderBottom: "2px solid #2e4a2e", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#4caf50", textTransform: "uppercase" }}>Café · St. Mary</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Compteur de Caisse</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#445544", letterSpacing: 1, marginBottom: 2, textTransform: "uppercase" }}>Total compté</div>
            <div style={{ fontSize: 19, fontFamily: "'Courier New', monospace", fontWeight: 900, color: canCalculate ? "#69f0ae" : totalCents > 0 ? "#ffb74d" : "#2e4a2e", background: "#0d1a0d", border: "1.5px solid #2e4a2e", borderRadius: 10, padding: "3px 10px" }}>
              {fmt(totalCents)}
            </div>
          </div>
        </div>
        <div style={{ padding: "5px 12px", background: "#0d1a0d", borderRadius: 8, border: "1px solid #1e3a1e", fontSize: 11, color: "#556655", textAlign: "center" }}>
          Float cible fixe : <span style={{ color: "#66bb6a", fontWeight: 700 }}>300,00 $</span> · petite monnaie priorisée
        </div>
      </div>

      {/* ── Result ── */}
      {result && (
        <div style={{ padding: "14px 14px 0" }}>
          {result.error ? (
            <div style={{ background: "#2a1515", border: "1.5px solid #c62828", borderRadius: 12, padding: "12px 14px", color: "#ef9a9a", fontSize: 13, fontWeight: 600 }}>
              ⚠️ {result.message}
            </div>
          ) : (
            <>
              <AllocTable alloc={result.floatAlloc} title="🏦 Float — garder en caisse" accentColor="#69f0ae" borderColor="#2e7d32" bg="#0c1f0c" />
              <AllocTable alloc={result.depotAlloc} title="📦 Dépôt — mettre dans l'enveloppe" accentColor="#64b5f6" borderColor="#1565c0" bg="#0c1525" />
            </>
          )}
        </div>
      )}

      {/* ── Input sections ── */}
      <div style={{ paddingBottom: 110 }}>
        <Section title="Billets"           keys={billets}  quantities={quantities} onChange={handleChange} />
        <Section title="Rouleaux"          keys={rouleaux} quantities={quantities} onChange={handleChange} />
        <Section title="Pièces détachées"  keys={pieces}   quantities={quantities} onChange={handleChange} />
      </div>

      {/* ── Bottom bar ── */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0d1a0d", borderTop: "2px solid #2e4a2e", padding: "12px 16px 28px" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={reset} style={{ flex: 1, padding: "13px 0", background: "transparent", border: "1.5px solid #2e4a2e", borderRadius: 10, color: "#556655", fontWeight: 700, fontSize: 14, cursor: "pointer", letterSpacing: 1 }}>
            RESET
          </button>
          <button
            onClick={calculate}
            style={{
              flex: 3, padding: "13px 0", border: "none", borderRadius: 10,
              background: canCalculate ? "linear-gradient(135deg, #2e7d32, #1b5e20)" : "#151f15",
              color: canCalculate ? "#e8f5e9" : "#334433",
              fontWeight: 800, fontSize: 15, cursor: "pointer", letterSpacing: 1,
              boxShadow: canCalculate ? "0 2px 12px rgba(76,175,80,0.25)" : "none",
              transition: "all 0.2s",
            }}>
            CALCULER FLOAT + DÉPÔT
          </button>
        </div>
      </div>
    </div>
  );
}
