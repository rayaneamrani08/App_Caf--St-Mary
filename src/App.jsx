import { useState, useCallback } from "react";

const DENOMINATIONS = [
  { label: "Pièce 5¢",    value: 5,    type: "piece",   coinValue: 5 },
  { label: "Pièce 10¢",   value: 10,   type: "piece",   coinValue: 10 },
  { label: "Pièce 25¢",   value: 25,   type: "piece",   coinValue: 25 },
  { label: "Pièce 1$",    value: 100,  type: "piece",   coinValue: 100 },
  { label: "Pièce 2$",    value: 200,  type: "piece",   coinValue: 200 },
  { label: "Rouleau 5¢",  value: 200,  type: "rouleau", coinValue: 5,   rouleauQty: 40 },
  { label: "Rouleau 10¢", value: 500,  type: "rouleau", coinValue: 10,  rouleauQty: 50 },
  { label: "Rouleau 25¢", value: 1000, type: "rouleau", coinValue: 25,  rouleauQty: 40 },
  { label: "Rouleau 1$",  value: 2500, type: "rouleau", coinValue: 100, rouleauQty: 25 },
  { label: "Rouleau 2$",  value: 5000, type: "rouleau", coinValue: 200, rouleauQty: 25 },
  { label: "Billet 5$",   value: 500,  type: "billet" },
  { label: "Billet 10$",  value: 1000, type: "billet" },
  { label: "Billet 20$",  value: 2000, type: "billet" },
  { label: "Billet 50$",  value: 5000, type: "billet" },
];

const FLOAT_TARGET = 30000;

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

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { background: #0f0f0f; }
  input:focus { outline: none; }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

  .row-hover:active { background: #1a1a1a !important; }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .slide-up { animation: slideUp 0.25s ease; }
`;

function Tag({ children, color = "#ffffff22", textColor = "#ffffff88" }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: 0.8,
      background: color, color: textColor,
      padding: "2px 7px", borderRadius: 4,
      textTransform: "uppercase",
    }}>
      {children}
    </span>
  );
}

function AllocTable({ alloc, title, variant }) {
  const rows = DENOMINATIONS.filter(d => (alloc[d.label] || 0) > 0);
  const total = rows.reduce((s, d) => s + (alloc[d.label] || 0) * d.value, 0);
  const isFloat = variant === "float";

  return (
    <div className="slide-up" style={{
      background: "#141414",
      border: `1px solid ${isFloat ? "#2a2a2a" : "#1e2a3a"}`,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 12,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 16px",
        background: isFloat ? "#1a1a1a" : "#0d1620",
        borderBottom: `1px solid ${isFloat ? "#2a2a2a" : "#1e2a3a"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: isFloat ? "#e8c97e" : "#5b9bd5",
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: isFloat ? "#e8c97e" : "#5b9bd5", letterSpacing: 0.5 }}>
            {title}
          </span>
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: isFloat ? "#e8c97e" : "#5b9bd5", letterSpacing: -0.5 }}>
          {fmt(total)}
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "16px", color: "#444", fontSize: 13 }}>Rien à afficher</div>
      ) : rows.map((d, i) => (
        <div key={d.label} style={{
          display: "flex", alignItems: "center",
          padding: "12px 16px",
          borderBottom: i < rows.length - 1 ? "1px solid #1e1e1e" : "none",
          gap: 10,
        }}>
          <span style={{ flex: 1, fontSize: 14, color: "#ccc", fontWeight: 500 }}>{d.label}</span>
          <span style={{ fontSize: 13, color: "#555", marginRight: 8 }}>×{alloc[d.label]}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", minWidth: 72, textAlign: "right" }}>
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
    <div className="row-hover" style={{
      display: "flex", alignItems: "center",
      padding: "13px 16px",
      borderBottom: "1px solid #1a1a1a",
      gap: 12,
      background: "#141414",
      transition: "background 0.1s",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: "#e0e0e0", fontWeight: 500 }}>{denom.label}</div>
        {denom.rouleauQty && (
          <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
            {denom.rouleauQty} pièces · {fmt(denom.value)}
          </div>
        )}
      </div>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={qty === "" || qty == null ? "" : qty}
        onChange={handleInput}
        placeholder="0"
        style={{
          width: 60, textAlign: "center",
          background: "#1e1e1e",
          border: "1px solid #2e2e2e",
          borderRadius: 10,
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          padding: "8px 4px",
          transition: "border-color 0.15s",
        }}
        onFocus={e => e.target.style.borderColor = "#e8c97e"}
        onBlur={e => e.target.style.borderColor = "#2e2e2e"}
      />
      <div style={{
        width: 76, textAlign: "right",
        fontSize: 13, fontWeight: 600,
        color: subtotal > 0 ? "#e8c97e" : "#2e2e2e",
      }}>
        {subtotal > 0 ? fmt(subtotal) : "—"}
      </div>
    </div>
  );
}

function Section({ title, keys, quantities, onChange }) {
  const total = keys.reduce((acc, d) => acc + (quantities[d.label] || 0) * d.value, 0);
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px",
        background: "#0f0f0f",
        borderTop: "1px solid #1a1a1a",
        borderBottom: "1px solid #1a1a1a",
      }}>
        <span style={{ fontSize: 11, letterSpacing: 1.5, color: "#555", textTransform: "uppercase", fontWeight: 600 }}>
          {title}
        </span>
        <span style={{ fontSize: 13, color: total > 0 ? "#e8c97e" : "#333", fontWeight: 600 }}>
          {total > 0 ? fmt(total) : "—"}
        </span>
      </div>
      {keys.map(d => (
        <DenomRow key={d.label} denom={d} qty={quantities[d.label]} onChange={v => onChange(d.label, v)} />
      ))}
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
  const progressPct = Math.min(100, Math.round((totalCents / FLOAT_TARGET) * 100));

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

  return (
    <>
      <style>{styles}</style>
      <div style={{
        minHeight: "100vh",
        background: "#0f0f0f",
        color: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
        maxWidth: 480,
        margin: "0 auto",
      }}>

        {/* Header */}
        <div style={{
          background: "#0f0f0f",
          padding: "20px 16px 16px",
          position: "sticky", top: 0, zIndex: 10,
          borderBottom: "1px solid #1a1a1a",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "#555", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
                Café St. Mary
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: -0.5 }}>
                Compteur de caisse
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Total</div>
              <div style={{
                fontSize: 20, fontWeight: 700,
                color: canCalculate ? "#e8c97e" : totalCents > 0 ? "#fff" : "#333",
                letterSpacing: -0.5,
              }}>
                {fmt(totalCents)}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "#444", letterSpacing: 1, textTransform: "uppercase" }}>
                Objectif 300,00 $
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: canCalculate ? "#e8c97e" : "#666" }}>
                {progressPct}%
              </span>
            </div>
            <div style={{ height: 3, background: "#1e1e1e", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${progressPct}%`,
                background: canCalculate
                  ? "linear-gradient(90deg, #c8a84b, #e8c97e)"
                  : "linear-gradient(90deg, #444, #666)",
                borderRadius: 99,
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div style={{ padding: "14px 14px 0" }}>
            {result.error ? (
              <div className="slide-up" style={{
                background: "#1a0f0f",
                border: "1px solid #3a1a1a",
                borderRadius: 14,
                padding: "14px 16px",
                color: "#e05c5c",
                fontSize: 13,
                fontWeight: 500,
              }}>
                {result.message}
              </div>
            ) : (
              <>
                <AllocTable alloc={result.floatAlloc} title="Float · garder en caisse" variant="float" />
                <AllocTable alloc={result.depotAlloc} title="Dépôt · enveloppe" variant="depot" />
              </>
            )}
          </div>
        )}

        {/* Inputs */}
        <div style={{ paddingBottom: 110 }}>
          <Section title="Billets"          keys={billets}  quantities={quantities} onChange={handleChange} />
          <Section title="Pièces détachées" keys={pieces}   quantities={quantities} onChange={handleChange} />
          <Section title="Rouleaux"         keys={rouleaux} quantities={quantities} onChange={handleChange} />
        </div>

        {/* Bottom bar */}
        <div style={{
          position: "fixed", bottom: 0,
          left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 480,
          background: "#0f0f0f",
          borderTop: "1px solid #1a1a1a",
          padding: "12px 16px 32px",
        }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={reset} style={{
              flex: 1, padding: "14px 0",
              background: "transparent",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              color: "#555",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}>
              Réinitialiser
            </button>
            <button onClick={calculate} style={{
              flex: 3, padding: "14px 0",
              border: "none", borderRadius: 12,
              background: canCalculate
                ? "linear-gradient(135deg, #c8a84b, #e8c97e)"
                : "#1a1a1a",
              color: canCalculate ? "#000" : "#333",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: 0.3,
              transition: "all 0.2s",
            }}>
              Calculer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
