import { useState, useCallback } from "react";

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

const FLOAT_TARGET = 30000;

// Colors
const C = {
  bg:         "#faf7f4",
  bgCard:     "#ffffff",
  bgSection:  "#f3ede8",
  brown:      "#6b4226",
  brownLight: "#a0673a",
  brownPale:  "#e8d9cc",
  brownMid:   "#c4956a",
  text:       "#2c1a0e",
  textMuted:  "#9c7a5e",
  textLight:  "#c4a882",
  gold:       "#c8922a",
  goldLight:  "#f0c060",
  blue:       "#3b6ea5",
  blueLight:  "#d6e6f8",
  red:        "#c0392b",
  redLight:   "#fde8e6",
  border:     "#e0cfc0",
  shadow:     "rgba(107,66,38,0.10)",
};

function fmt(cents) {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

function computeFloat(quantities) {
  const floatAlloc = {};
  const depotAlloc = {};
  for (const d of DENOMINATIONS) {
    floatAlloc[d.label] = 0;
    depotAlloc[d.label] = quantities[d.label] || 0;
  }
  let remaining = FLOAT_TARGET;
  for (const d of DENOMINATIONS) {
    if (remaining <= 0) break;
    const available = depotAlloc[d.label];
    const use = Math.min(available, Math.floor(remaining / d.value));
    floatAlloc[d.label] += use;
    depotAlloc[d.label] -= use;
    remaining -= use * d.value;
  }
  if (remaining === 0) return { floatAlloc, depotAlloc };
  for (const d of DENOMINATIONS) {
    if (remaining <= 0) break;
    if (depotAlloc[d.label] === 0) continue;
    if (d.value < remaining) continue;
    floatAlloc[d.label] += 1;
    depotAlloc[d.label] -= 1;
    remaining -= d.value;
    break;
  }
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

function AllocTable({ alloc, title, accent, bg, borderColor }) {
  const rows = DENOMINATIONS.filter(d => (alloc[d.label] || 0) > 0);
  const total = rows.reduce((s, d) => s + (alloc[d.label] || 0) * d.value, 0);

  return (
    <div style={{ background: bg, border: `1.5px solid ${borderColor}`, borderRadius: 16, marginBottom: 12, overflow: "hidden", boxShadow: `0 2px 8px ${C.shadow}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${borderColor}` }}>
        <span style={{ fontSize: 12, letterSpacing: 1.5, color: accent, textTransform: "uppercase", fontWeight: 800 }}>{title}</span>
        <span style={{ fontFamily: "'Georgia', serif", fontWeight: 700, fontSize: 18, color: accent }}>{fmt(total)}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "12px 16px", color: C.textLight, fontSize: 13 }}>Rien</div>
      ) : rows.map(d => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", padding: "9px 16px", borderBottom: `1px solid ${borderColor}`, gap: 10 }}>
          <span style={{ fontSize: 17, width: 24 }}>{d.emoji}</span>
          <span style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 500 }}>{d.label}</span>
          <span style={{ fontSize: 12, color: C.textLight, marginRight: 4 }}>×{alloc[d.label]}</span>
          <span style={{ fontFamily: "'Georgia', serif", fontSize: 14, fontWeight: 700, color: C.text, minWidth: 70, textAlign: "right" }}>
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
    <div style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${C.border}`, gap: 10, background: C.bgCard }}>
      <span style={{ fontSize: 19, width: 26, textAlign: "center" }}>{denom.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{denom.label}</div>
        {denom.rouleauQty && (
          <div style={{ fontSize: 10, color: C.textLight, marginTop: 1 }}>
            {denom.rouleauQty} × {denom.coinValue < 100 ? denom.coinValue + "¢" : (denom.coinValue / 100) + "$"} = {fmt(denom.value)}
          </div>
        )}
      </div>
      <input
        inputMode="numeric" pattern="[0-9]*"
        value={qty === "" || qty == null ? "" : qty}
        onChange={handleInput} placeholder="0"
        style={{
          width: 58, textAlign: "center",
          background: C.bgSection,
          border: `1.5px solid ${C.brownPale}`,
          borderRadius: 10,
          color: C.brown,
          fontSize: 17,
          fontFamily: "'Georgia', serif",
          fontWeight: 700,
          padding: "7px 4px",
          outline: "none",
        }}
      />
      <div style={{ width: 74, textAlign: "right", fontSize: 13, color: subtotal > 0 ? C.brownLight : C.border, fontFamily: "'Georgia', serif", fontWeight: 700 }}>
        {subtotal > 0 ? fmt(subtotal) : "—"}
      </div>
    </div>
  );
}

function Section({ title, keys, quantities, onChange }) {
  const total = keys.reduce((acc, d) => acc + (quantities[d.label] || 0) * d.value, 0);
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px", background: C.bgSection, borderTop: `1px solid ${C.brownPale}`, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 11, letterSpacing: 2, color: C.brownLight, textTransform: "uppercase", fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 14, color: C.brown, fontFamily: "'Georgia', serif", fontWeight: 700 }}>{fmt(total)}</span>
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

  const billets  = [...DENOMINATIONS.filter(d => d.type === "billet")].reverse();
  const rouleaux = [...DENOMINATIONS.filter(d => d.type === "rouleau")].reverse();
  const pieces   = [...DENOMINATIONS.filter(d => d.type === "piece")].reverse();

  const reset = () => { setQuantities({}); setResult(null); };

  const calculate = () => {
    if (!canCalculate) {
      setResult({ error: true, message: `Il manque ${fmt(FLOAT_TARGET - totalCents)} pour atteindre 300,00 $.` });
      return;
    }
    setResult(computeFloat(quantities));
  };

  const progressPct = Math.min(100, Math.round((totalCents / FLOAT_TARGET) * 100));

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Segoe UI', sans-serif", maxWidth: 480, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ background: C.bgCard, padding: "20px 16px 14px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 10, boxShadow: `0 2px 10px ${C.shadow}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: C.brownMid, textTransform: "uppercase", fontWeight: 600 }}>☕ Café · St. Mary</div>
            <div style={{ fontSize: 23, fontWeight: 800, color: C.brown, letterSpacing: -0.5, marginTop: 1 }}>Compteur de Caisse</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: C.textLight, letterSpacing: 1, marginBottom: 3, textTransform: "uppercase" }}>Total compté</div>
            <div style={{
              fontSize: 19, fontFamily: "'Georgia', serif", fontWeight: 900,
              color: canCalculate ? C.brown : totalCents > 0 ? C.gold : C.textLight,
              background: C.bgSection,
              border: `1.5px solid ${C.brownPale}`,
              borderRadius: 12, padding: "4px 12px",
            }}>
              {fmt(totalCents)}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: C.textLight, letterSpacing: 1 }}>PROGRESSION VERS 300,00 $</span>
            <span style={{ fontSize: 10, color: canCalculate ? C.brown : C.gold, fontWeight: 700 }}>{progressPct}%</span>
          </div>
          <div style={{ height: 6, background: C.brownPale, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: canCalculate ? `linear-gradient(90deg, ${C.brownLight}, ${C.brown})` : `linear-gradient(90deg, ${C.goldLight}, ${C.gold})`, borderRadius: 99, transition: "width 0.3s ease" }} />
          </div>
        </div>

        <div style={{ padding: "5px 12px", background: C.bgSection, borderRadius: 8, border: `1px solid ${C.brownPale}`, fontSize: 11, color: C.textMuted, textAlign: "center" }}>
          Float fixe : <span style={{ color: C.brown, fontWeight: 700 }}>300,00 $</span> · petite monnaie priorisée
        </div>
      </div>

      {/* ── Result ── */}
      {result && (
        <div style={{ padding: "14px 14px 0" }}>
          {result.error ? (
            <div style={{ background: C.redLight, border: `1.5px solid ${C.red}`, borderRadius: 14, padding: "13px 16px", color: C.red, fontSize: 13, fontWeight: 600, boxShadow: `0 2px 8px rgba(192,57,43,0.1)` }}>
              ⚠️ {result.message}
            </div>
          ) : (
            <>
              <AllocTable alloc={result.floatAlloc} title="🏦 Float — garder en caisse" accent={C.brown} bg="#fffaf6" borderColor={C.brownPale} />
              <AllocTable alloc={result.depotAlloc} title="📦 Dépôt — enveloppe" accent={C.blue} bg={C.blueLight} borderColor="#b8d0ec" />
            </>
          )}
        </div>
      )}

      {/* ── Inputs ── */}
      <div style={{ paddingBottom: 110 }}>
        <Section title="Billets"          keys={billets}  quantities={quantities} onChange={handleChange} />
        <Section title="Rouleaux"         keys={rouleaux} quantities={quantities} onChange={handleChange} />
        <Section title="Pièces détachées" keys={pieces}   quantities={quantities} onChange={handleChange} />
      </div>

      {/* ── Bottom bar ── */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.bgCard, borderTop: `1px solid ${C.border}`, padding: "12px 16px 28px", boxShadow: `0 -4px 16px ${C.shadow}` }}>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={reset} style={{ flex: 1, padding: "13px 0", background: C.bgSection, border: `1.5px solid ${C.brownPale}`, borderRadius: 12, color: C.textMuted, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Reset
          </button>
          <button
            onClick={calculate}
            style={{
              flex: 3, padding: "13px 0", border: "none", borderRadius: 12,
              background: canCalculate ? `linear-gradient(135deg, ${C.brownLight}, ${C.brown})` : C.bgSection,
              color: canCalculate ? "#fff" : C.textLight,
              fontWeight: 800, fontSize: 15, cursor: "pointer",
              boxShadow: canCalculate ? `0 4px 14px rgba(107,66,38,0.35)` : "none",
              transition: "all 0.2s",
              letterSpacing: 0.5,
            }}>
            Calculer Float + Dépôt
          </button>
        </div>
      </div>
    </div>
  );
}
