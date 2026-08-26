import { useState, useEffect, useCallback, useContext, createContext, useRef } from "react";

/* ------------------------------------------------------------------ */
/* Data & helpers                                                      */
/* ------------------------------------------------------------------ */

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

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("fr-CA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const LS_KEYS = {
  theme: "csm_theme_v1",
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

async function appendCashHistory(entry) {
  const res = await fetch("/api/cash-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error("Échec de l'enregistrement du comptage.");
}

function computeFloat(quantities) {
  const floatAlloc = {};
  const depotAlloc = {};
  for (const d of DENOMINATIONS) {
    if (d.type === "rouleau") {
      floatAlloc[d.label] = quantities[d.label] || 0;
      depotAlloc[d.label] = 0;
    } else {
      floatAlloc[d.label] = 0;
      depotAlloc[d.label] = quantities[d.label] || 0;
    }
  }
  const rouleauTotal = DENOMINATIONS.filter(d => d.type === "rouleau")
    .reduce((sum, d) => sum + floatAlloc[d.label] * d.value, 0);
  let remaining = FLOAT_TARGET - rouleauTotal;
  const nonRouleau = DENOMINATIONS.filter(d => d.type !== "rouleau");
  for (const d of nonRouleau) {
    if (remaining <= 0) break;
    const available = depotAlloc[d.label];
    const use = Math.min(available, Math.floor(remaining / d.value));
    floatAlloc[d.label] += use;
    depotAlloc[d.label] -= use;
    remaining -= use * d.value;
  }
  if (remaining === 0) return { floatAlloc, depotAlloc };
  for (const d of nonRouleau) {
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
    for (const d of [...nonRouleau].reverse()) {
      if (overshoot <= 0) break;
      const canGiveBack = Math.min(floatAlloc[d.label], Math.floor(overshoot / d.value));
      floatAlloc[d.label] -= canGiveBack;
      depotAlloc[d.label] += canGiveBack;
      overshoot -= canGiveBack * d.value;
    }
  }
  return { floatAlloc, depotAlloc };
}

/* ------------------------------------------------------------------ */
/* Theme                                                                */
/* ------------------------------------------------------------------ */

const darkTokens = {
  name: "dark",
  bg: "#14110d",
  bgElevated: "#1c1712",
  bgElevated2: "#241e17",
  bgInput: "#201a14",
  border: "#241e17",
  borderStrong: "#362d22",
  borderInput: "#3d3226",
  textPrimary: "#f7f3ec",
  textSecondary: "#d8cfc0",
  textMuted: "#8c8271",
  textFaint: "#4a4133",
  accentGold: "#e3b563",
  accentGoldDark: "#c89144",
  accentBlue: "#7fb0e0",
  danger: "#e2685c",
  dangerBg: "#241512",
  dangerBorder: "#47241e",
  success: "#83c99a",
  shadow: "rgba(0,0,0,0.35)",
};

const lightTokens = {
  name: "light",
  bg: "#faf6ef",
  bgElevated: "#ffffff",
  bgElevated2: "#f3ebdc",
  bgInput: "#f6efe1",
  border: "#ece1cc",
  borderStrong: "#e0d2b4",
  borderInput: "#d8c6a0",
  textPrimary: "#221c13",
  textSecondary: "#5b5140",
  textMuted: "#948a73",
  textFaint: "#d9cfb9",
  accentGold: "#a9721f",
  accentGoldDark: "#8a5a16",
  accentBlue: "#35688f",
  danger: "#c1473b",
  dangerBg: "#fbecea",
  dangerBorder: "#efc7be",
  success: "#3d8358",
  shadow: "rgba(90,70,40,0.12)",
};

const fontHeading = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const fontBody = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const ThemeContext = createContext({ t: darkTokens, themeName: "dark", toggleTheme: () => {} });
function useTheme() {
  return useContext(ThemeContext);
}

const globalStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  input:focus { outline: none; }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
  ::selection { background: rgba(227,181,99,0.35); }

  button { cursor: pointer; font-family: inherit; }
  button:disabled { cursor: default; }
  a, button, [role="button"] { -webkit-tap-highlight-color: transparent; }

  :focus-visible { outline: 2px solid var(--focus-ring, #e3b563); outline-offset: 2px; border-radius: 6px; }

  .row-hover { transition: background 0.15s ease; }
  .row-hover:active { background: rgba(127,127,127,0.14) !important; }

  .press { transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .press:active { transform: scale(0.97); }

  .icon-badge { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease; }
  .row-hover:hover .icon-badge, .row-hover:active .icon-badge { transform: scale(1.1) rotate(-6deg); }

  .chevron { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .row-hover:hover .chevron, .row-hover:active .chevron { transform: translateX(3px) rotate(-90deg); }

  .theme-icon { transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease; }
  .theme-icon:active { transform: rotate(90deg) scale(0.85); }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .slide-up { animation: slideUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) backwards; }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .fade-in { animation: fadeIn 0.25s ease backwards; }

  @keyframes pulseDot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.35); opacity: 0.6; }
  }
  .pulse-dot { animation: pulseDot 2s ease-in-out infinite; }

  @keyframes popIn {
    from { opacity: 0; transform: scale(0.6) rotate(-8deg); }
    to   { opacity: 1; transform: scale(1) rotate(0deg); }
  }
  .pop-in { animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) backwards; }

  @media (prefers-reduced-motion: reduce) {
    .slide-up, .fade-in, .pop-in { animation: fadeIn 0.01ms; }
    .pulse-dot { animation: none; }
    * { transition-duration: 0.01ms !important; }
  }
`;

/* ------------------------------------------------------------------ */
/* Shared UI pieces                                                     */
/* ------------------------------------------------------------------ */

function Btn({ children, onClick, variant = "primary", style, disabled }) {
  const { t } = useTheme();
  const base = {
    border: "none", borderRadius: 12, padding: "13px 16px", minHeight: 48,
    fontWeight: 700, fontSize: 14, cursor: disabled ? "default" : "pointer",
    fontFamily: fontBody, opacity: disabled ? 0.5 : 1, width: "100%",
    transition: "transform 0.12s ease, filter 0.15s ease, background 0.15s ease",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  };
  const variants = {
    primary: {
      background: `linear-gradient(135deg, ${t.accentGoldDark}, ${t.accentGold})`,
      color: "#1c1508",
      boxShadow: `0 4px 14px ${t.shadow}`,
    },
    ghost:   { background: t.bgElevated2, border: `1px solid ${t.borderStrong}`, color: t.textSecondary },
    danger:  { background: "transparent", border: `1px solid ${t.dangerBorder}`, color: t.danger },
  };
  return (
    <button
      className="press"
      disabled={disabled}
      onClick={onClick}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.filter = "brightness(0.94)"; }}
      onMouseUp={e => { e.currentTarget.style.filter = "none"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

function InfoCard({ title, children, accent }) {
  const { t } = useTheme();
  const accentColor = accent || t.accentBlue;
  return (
    <div style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 18,
      padding: "18px",
      marginBottom: 12,
      boxShadow: `0 1px 2px ${t.shadow}`,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 1,
        color: accentColor, marginBottom: 10, textTransform: "uppercase",
      }}>
        {title}
      </div>
      <div style={{ fontSize: 14.5, color: t.textSecondary, lineHeight: 1.65 }}>
        {children}
      </div>
    </div>
  );
}

function StepList({ steps }) {
  const { t } = useTheme();
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {steps.map((s, i) => (
        <li key={i} style={{
          display: "flex", gap: 10,
          padding: "8px 0",
          borderBottom: i < steps.length - 1 ? `1px solid ${t.border}` : "none",
        }}>
          <span style={{
            flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
            background: `${t.accentGold}22`, color: t.accentGold,
            fontSize: 11, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {i + 1}
          </span>
          <span style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5, paddingTop: 1 }}>
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items }) {
  const { t } = useTheme();
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((it, i) => (
        <li key={i} style={{
          display: "flex", gap: 8, padding: "6px 0",
          borderBottom: i < items.length - 1 ? `1px solid ${t.border}` : "none",
        }}>
          <span style={{ color: t.accentGold }}>•</span>
          <span style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function AllocTable({ alloc, title, variant }) {
  const { t } = useTheme();
  const rows = DENOMINATIONS.filter(d => (alloc[d.label] || 0) > 0);
  const total = rows.reduce((s, d) => s + (alloc[d.label] || 0) * d.value, 0);
  const isFloat = variant === "float";
  const accent = isFloat ? t.accentGold : t.accentBlue;

  return (
    <div className="slide-up" style={{
      background: t.bgElevated,
      border: `1.5px solid ${accent}55`,
      borderRadius: 20,
      overflow: "hidden",
      marginBottom: 14,
      boxShadow: `0 2px 10px ${t.shadow}`,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 18px",
        background: `${accent}14`,
        borderBottom: `1px solid ${accent}33`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: 1, textTransform: "uppercase" }}>
            {title}
          </span>
        </div>
        <span style={{ fontFamily: fontBody, fontVariantNumeric: "tabular-nums", fontSize: 26, fontWeight: 800, color: accent, letterSpacing: -0.5 }}>
          {fmt(total)}
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "16px", color: t.textMuted, fontSize: 13 }}>Rien à afficher</div>
      ) : rows.map((d, i) => (
        <div key={d.label} style={{
          display: "flex", alignItems: "center",
          padding: "14px 18px",
          borderBottom: i < rows.length - 1 ? `1px solid ${t.border}` : "none",
          gap: 12,
        }}>
          <span style={{ flex: 1, fontSize: 15, color: t.textPrimary, fontWeight: 600 }}>{d.label}</span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: accent, fontVariantNumeric: "tabular-nums",
            background: `${accent}1c`, borderRadius: 8, padding: "4px 10px", whiteSpace: "nowrap",
          }}>
            × {alloc[d.label]}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 17, fontWeight: 800, color: t.textPrimary, minWidth: 88, textAlign: "right" }}>
            {fmt((alloc[d.label] || 0) * d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DenomRow({ denom, qty, onChange }) {
  const { t } = useTheme();
  const handleInput = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d+$/.test(v)) onChange(v === "" ? "" : parseInt(v, 10));
  };
  const subtotal = (qty || 0) * denom.value;

  return (
    <div className="row-hover" style={{
      display: "flex", alignItems: "center",
      padding: "13px 16px",
      borderBottom: `1px solid ${t.border}`,
      gap: 12,
      background: t.bgElevated,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: t.textSecondary, fontWeight: 500 }}>{denom.label}</div>
        {denom.rouleauQty && (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
            {denom.rouleauQty} pièces · {fmt(denom.value)}
          </div>
        )}
      </div>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={`Quantité — ${denom.label}`}
        value={qty === "" || qty == null ? "" : qty}
        onChange={handleInput}
        placeholder="0"
        style={{
          width: 60, textAlign: "center",
          background: t.bgInput,
          border: `1.5px solid ${t.borderInput}`,
          borderRadius: 10,
          color: t.textPrimary,
          fontSize: 16,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          padding: "10px 4px",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
        onFocus={e => { e.target.style.borderColor = t.accentGold; e.target.style.boxShadow = `0 0 0 3px ${t.accentGold}22`; }}
        onBlur={e => { e.target.style.borderColor = t.borderInput; e.target.style.boxShadow = "none"; }}
      />
      <div style={{
        width: 76, textAlign: "right",
        fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums",
        color: subtotal > 0 ? t.accentGold : t.textFaint,
      }}>
        {subtotal > 0 ? fmt(subtotal) : "—"}
      </div>
    </div>
  );
}

function Section({ title, keys, quantities, onChange }) {
  const { t } = useTheme();
  const total = keys.reduce((acc, d) => acc + (quantities[d.label] || 0) * d.value, 0);
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 16px",
        background: t.bg,
        borderTop: `1px solid ${t.border}`,
        borderBottom: `1px solid ${t.border}`,
      }}>
        <span style={{ fontSize: 11, letterSpacing: 1.5, color: t.textMuted, textTransform: "uppercase", fontWeight: 700 }}>
          {title}
        </span>
        <span style={{ fontSize: 13, color: total > 0 ? t.accentGold : t.textFaint, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {total > 0 ? fmt(total) : "—"}
        </span>
      </div>
      {keys.map(d => (
        <DenomRow key={d.label} denom={d} qty={quantities[d.label]} onChange={v => onChange(d.label, v)} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation & header                                                  */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  { id: "home",       label: "Accueil" },
  { id: "caisse",     label: "Compteur de caisse" },
  { id: "historique", label: "Historique des comptages" },
  { id: "checklist",  label: "Fermeture" },
  { id: "horaire",    label: "Horaire d'équipe" },
  { id: "menu",       label: "Menu" },
  { id: "urgence",    label: "Codes d'urgence" },
  { id: "formation",  label: "Formation" },
  { id: "about",      label: "À propos" },
];

function MenuIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 3.5H13M1 7H13M1 10.5H13" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ color }) {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 3L4.5 6L7.5 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="3" stroke={color} strokeWidth="1.3" />
      <path d="M7 0.5V2M7 12V13.5M13.5 7H12M2 7H0.5M11.4 2.6L10.3 3.7M3.7 10.3L2.6 11.4M11.4 11.4L10.3 10.3M3.7 3.7L2.6 2.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 8.5A5.5 5.5 0 1 1 5.5 1.5A4.3 4.3 0 0 0 12.5 8.5Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

const SECTION_ICON_PATHS = {
  home:       "M3 9.5L10 4l7 5.5M5 8.5V16h10V8.5",
  caisse:     "M4 6h12v9H4zM4 6l1.5-2h9L16 6M7 10.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  historique: "M10 4v6l4 2M4.5 8A5.5 5.5 0 1 1 5 12.5M4.5 4v4h4",
  checklist:  "M4 5.5h9M4 10h9M4 14.5h6M15.5 4l1.2 1.2L19 3",
  horaire:    "M4 4.5h12v11H4zM4 8h12M7 3v2.5M13 3v2.5",
  menu:       "M5 4h10M5 4v12M15 4v3a3 3 0 0 1-3 3M5 10c2 0 5-1 5 2v4",
  urgence:    "M10 3.5L17.5 16h-15L10 3.5zM10 8v3.5M10 13.5v.1",
  formation:  "M4 5a2 2 0 0 1 2-2h9v13H6a2 2 0 0 0-2 2V5zM15 3v13",
  about:      "M10 17a7 7 0 1 0 0-14a7 7 0 0 0 0 14zM10 9v4.5M10 6.5v.1",
};

function SectionIcon({ id, color, size = 15 }) {
  const d = SECTION_ICON_PATHS[id];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={d} stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionSwitcher({ active, onChange }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Ouvrir le menu de navigation"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: t.bgElevated2,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: 9,
          padding: "8px 10px",
          fontFamily: fontBody,
          transition: "border-color 0.15s",
        }}
      >
        <MenuIcon color={t.textSecondary} />
        <ChevronIcon color={t.textMuted} />
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.15)" }}
          />
          <div className="slide-up" style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0,
            background: t.bgElevated2,
            border: `1px solid ${t.borderStrong}`,
            borderRadius: 14,
            overflow: "hidden",
            overflowY: "auto",
            maxHeight: "65vh",
            zIndex: 21,
            width: 232,
            boxShadow: `0 12px 32px ${t.shadow}`,
          }}>
            {SECTIONS.map(s => (
              <div
                key={s.id}
                onClick={() => { onChange(s.id); setOpen(false); }}
                role="button"
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 14px",
                  paddingLeft: s.id === active ? 11 : 14,
                  borderLeft: s.id === active ? `3px solid ${t.accentGold}` : "3px solid transparent",
                  background: s.id === active ? `${t.accentGold}12` : "transparent",
                  borderBottom: `1px solid ${t.border}`,
                  fontSize: 13.5,
                  fontWeight: s.id === active ? 700 : 500,
                  color: s.id === active ? t.textPrimary : t.textSecondary,
                }}
              >
                <SectionIcon id={s.id} color={s.id === active ? t.accentGold : t.textMuted} />
                {s.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ThemeToggleButton() {
  const { t, themeName, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} aria-label="Changer de thème" className="theme-icon" style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: 34, height: 34,
      background: t.bgElevated2,
      border: `1px solid ${t.borderStrong}`,
      borderRadius: 9,
      transition: "border-color 0.15s",
    }}>
      <span key={themeName} className="pop-in" style={{ display: "flex" }}>
        {themeName === "dark" ? <SunIcon color={t.textSecondary} /> : <MoonIcon color={t.textSecondary} />}
      </span>
    </button>
  );
}

function ViewHeader({ activeSection, onSectionChange, title, right, children }) {
  const { t } = useTheme();
  return (
    <div style={{
      background: `${t.bg}e8`,
      backdropFilter: "blur(14px) saturate(1.4)",
      WebkitBackdropFilter: "blur(14px) saturate(1.4)",
      padding: "18px 16px 16px",
      position: "sticky", top: 0, zIndex: 10,
      borderBottom: `1px solid ${t.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SectionSwitcher active={activeSection} onChange={onSectionChange} />
          <div style={{ fontSize: 10.5, letterSpacing: 2.5, color: t.accentGold, textTransform: "uppercase", fontWeight: 700 }}>
            Café St. Mary
          </div>
        </div>
        <ThemeToggleButton />
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontFamily: fontHeading, fontSize: 26, fontWeight: 700, color: t.textPrimary, letterSpacing: -0.3, lineHeight: 1.15 }}>
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Accueil                                                              */
/* ------------------------------------------------------------------ */

const HOME_GROUPS = [
  { title: "Outils du quart", ids: ["caisse", "historique", "checklist", "horaire"] },
  { title: "Informations",    ids: ["menu", "urgence", "formation", "about"] },
];

function HomeView({ activeSection, onSectionChange }) {
  const { t } = useTheme();
  const byId = Object.fromEntries(SECTIONS.map(s => [s.id, s]));

  return (
    <div>
      <ViewHeader activeSection={activeSection} onSectionChange={onSectionChange} title="Bienvenue" />
      <div style={{ padding: "18px 14px 40px" }}>
        {HOME_GROUPS.map((group, gi) => (
          <div key={group.title} style={{ marginBottom: gi < HOME_GROUPS.length - 1 ? 22 : 0 }}>
            <div style={{
              fontSize: 11, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase",
              color: t.textMuted, marginBottom: 10, paddingLeft: 2,
            }}>
              {group.title}
            </div>
            <div style={{
              background: t.bgElevated, border: `1px solid ${t.border}`,
              borderRadius: 16, overflow: "hidden", boxShadow: `0 1px 2px ${t.shadow}`,
            }}>
              {group.ids.map((id, i) => {
                const s = byId[id];
                return (
                  <button
                    key={s.id}
                    className="row-hover press slide-up"
                    onClick={() => onSectionChange(s.id)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      width: "100%", textAlign: "left",
                      background: "transparent",
                      border: "none",
                      borderBottom: i < group.ids.length - 1 ? `1px solid ${t.border}` : "none",
                      padding: "15px 16px",
                      fontFamily: fontBody,
                      animationDelay: `${(gi * group.ids.length + i) * 45}ms`,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="icon-badge" style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 34, height: 34, borderRadius: 10,
                        background: `${t.accentGold}18`, flexShrink: 0,
                      }}>
                        <SectionIcon id={s.id} color={t.accentGold} />
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: t.textPrimary }}>{s.label}</span>
                    </span>
                    <span className="chevron" style={{ transform: "rotate(-90deg)", display: "flex", opacity: 0.7 }}>
                      <ChevronIcon color={t.textMuted} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formation                                                            */
/* ------------------------------------------------------------------ */

function FormationView({ activeSection, onSectionChange }) {
  const { t } = useTheme();
  return (
    <div>
      <ViewHeader activeSection={activeSection} onSectionChange={onSectionChange} title="Formation" />
      <div style={{ padding: "16px 14px 40px" }}>
        <InfoCard title="Bienvenue" accent={t.accentGold}></InfoCard>

        <InfoCard title="Ouverture de caisse">
          <StepList steps={[]} />
        </InfoCard>

        <InfoCard title="Fermeture de caisse">
          <StepList steps={[]} />
        </InfoCard>

        <InfoCard title="Bonnes pratiques">
          <StepList steps={[]} />
        </InfoCard>

        <InfoCard title="Contacts utiles" accent={t.accentBlue}></InfoCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* About                                                                */
/* ------------------------------------------------------------------ */

function AboutView({ activeSection, onSectionChange }) {
  const { t } = useTheme();
  return (
    <div>
      <ViewHeader activeSection={activeSection} onSectionChange={onSectionChange} title="À propos" />
      <div style={{ padding: "16px 14px 40px" }}>
        <InfoCard title="Notre histoire" accent={t.accentGold}></InfoCard>

        <InfoCard title="Notre mission"></InfoCard>

        <InfoCard title="Nos valeurs" accent={t.accentBlue}>
          <StepList steps={[]} /></InfoCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menu & rangement                                                     */
/* ------------------------------------------------------------------ */

const SANDWICHES_GOURMET = [];

const SANDWICHES_TRADITIONNELS = [];

const SANDWICHES_VEGE = [];

function MenuView({ activeSection, onSectionChange }) {
  const { t } = useTheme();
  return (
    <div>
      <ViewHeader activeSection={activeSection} onSectionChange={onSectionChange} title="Menu" />
      <div style={{ padding: "16px 14px 40px" }}>
        <InfoCard title="Gourmet" accent={t.accentGold}>
          <BulletList items={SANDWICHES_GOURMET} />
        </InfoCard>
        <InfoCard title="Traditionnel">
          <BulletList items={SANDWICHES_TRADITIONNELS} />
        </InfoCard>
        <InfoCard title="Végé" accent={t.accentBlue}>
          <BulletList items={SANDWICHES_VEGE} />
        </InfoCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Codes d'urgence                                                      */
/* ------------------------------------------------------------------ */

const EMERGENCY_CODES = [
  { code: "Code Rouge",  meaning: "Incendie" },
  { code: "Code Vert",   meaning: "Évacuation du bâtiment" },
  { code: "Code Blanc",  meaning: "Personne agressive ou situation violente" },
  { code: "Code Gris",   meaning: "Intrusion ou menace avec arme" },
  { code: "Code Rose",   meaning: "Enfant disparu ou enlèvement" },
  { code: "Code Jaune",  meaning: "Personne disparue" },
  { code: "Code Bleu",   meaning: "Urgence médicale — arrêt cardiorespiratoire" },
  { code: "Code Brun",   meaning: "Déversement de matière dangereuse" },
  { code: "Code Noir",   meaning: "Alerte à la bombe" },
];

const EMERGENCY_NUMBERS = [
  { label: "Urgence (police / ambulance / incendie)", value: "911" },
  { label: "Info-Santé / Info-Social", value: "811" },
  { label: "Centre antipoison du Québec", value: "1 800 463-5060" },
  { label: "Sûreté du Québec (non urgent)", value: "310-4141 (*4141 cellulaire)" },
];

function EmergencyCodesView({ activeSection, onSectionChange }) {
  const { t } = useTheme();
  return (
    <div>
      <ViewHeader activeSection={activeSection} onSectionChange={onSectionChange} title="Codes d'urgence" />
      <div style={{ padding: "16px 14px 40px" }}>
        <InfoCard title="Danger immédiat" accent={t.danger}>
          En cas de danger immédiat pour une vie, composer le 911.
        </InfoCard>

        <InfoCard title="Codes internes" accent={t.accentBlue}>
          <div>
            {EMERGENCY_CODES.map((c, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0",
                borderBottom: i < EMERGENCY_CODES.length - 1 ? `1px solid ${t.border}` : "none",
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, whiteSpace: "nowrap" }}>{c.code}</span>
                <span style={{ fontSize: 13, color: t.textSecondary, textAlign: "right" }}>{c.meaning}</span>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard title="Numéros utiles">
          <div>
            {EMERGENCY_NUMBERS.map((n, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0",
                borderBottom: i < EMERGENCY_NUMBERS.length - 1 ? `1px solid ${t.border}` : "none",
              }}>
                <span style={{ fontSize: 13, color: t.textSecondary }}>{n.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, whiteSpace: "nowrap" }}>{n.value}</span>
              </div>
            ))}
          </div>
        </InfoCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horaire d'équipe                                                     */
/* ------------------------------------------------------------------ */

const MAX_SCHEDULE_IMAGE_BYTES = 5 * 1024 * 1024;

function ScheduleView({ activeSection, onSectionChange }) {
  const { t } = useTheme();
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/schedule")
      .then(r => r.json())
      .then(data => { if (!cancelled) setImage(data.url || null); })
      .catch(() => { if (!cancelled) setError("Impossible de charger l'horaire. Vérifie ta connexion."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_SCHEDULE_IMAGE_BYTES) {
      setError("Image trop volumineuse (5 Mo maximum).");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const res = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/png" },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec du téléversement.");
      setImage(data.url);
    } catch (err) {
      setError(err.message || "Le téléversement a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    const previous = image;
    setImage(null);
    try {
      const res = await fetch("/api/schedule", { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setImage(previous);
      setError("La suppression a échoué. Réessaie.");
    }
  };

  return (
    <div>
      <ViewHeader activeSection={activeSection} onSectionChange={onSectionChange} title="Horaire d'équipe" />
      <div style={{ padding: "16px 14px 40px" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFile}
          style={{ display: "none" }}
        />
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <Btn onClick={() => fileInputRef.current?.click()} disabled={uploading || loading}>
            {uploading ? "Téléversement…" : image ? "Remplacer l'horaire" : "Téléverser l'horaire"}
          </Btn>
          {image && (
            <div style={{ flexShrink: 0 }}>
              <Btn variant="ghost" onClick={removeImage} style={{ width: "auto", padding: "12px 16px" }}>Retirer</Btn>
            </div>
          )}
        </div>
        {error && <div style={{ color: t.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <InfoCard title="Chargement">Récupération de l'horaire…</InfoCard>
        ) : image ? (
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 16, overflow: "hidden", background: t.bgElevated }}>
            <img src={image} alt="Horaire de la semaine" style={{ width: "100%", display: "block" }} />
          </div>
        ) : (
          <InfoCard title="Aucun horaire" accent={t.accentBlue}>
            Téléverse une image (PNG ou JPG) de l'horaire hebdomadaire pour l'afficher ici. Visible par tous les employés.
          </InfoCard>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fermeture                                                            */
/* ------------------------------------------------------------------ */

const CLOSING_CAISSE = [];

const CLOSING_SANDWICHS = [];

function ClosingChecklistView({ activeSection, onSectionChange }) {
  const { t } = useTheme();
  return (
    <div>
      <ViewHeader activeSection={activeSection} onSectionChange={onSectionChange} title="Fermeture" />
      <div style={{ padding: "16px 14px 40px" }}>
        <InfoCard title="Fermeture de la caisse" accent={t.accentGold}>
          <BulletList items={CLOSING_CAISSE} />
        </InfoCard>
        <InfoCard title="Fermeture du poste sandwichs" accent={t.accentBlue}>
          <BulletList items={CLOSING_SANDWICHS} />
        </InfoCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Historique des comptages de caisse                                   */
/* ------------------------------------------------------------------ */

function CashHistoryView({ activeSection, onSectionChange }) {
  const { t } = useTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cash-history")
      .then(r => r.json())
      .then(data => { if (!cancelled) setHistory(data.history || []); })
      .catch(() => { if (!cancelled) setError("Impossible de charger l'historique. Vérifie ta connexion."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const removeEntry = async (id) => {
    const previous = history;
    setHistory(h => h.filter(e => e.id !== id));
    try {
      const res = await fetch(`/api/cash-history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setHistory(previous);
      setError("La suppression a échoué. Réessaie.");
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Effacer tout l'historique des comptages ?")) return;
    const previous = history;
    setHistory([]);
    try {
      const res = await fetch("/api/cash-history", { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setHistory(previous);
      setError("La suppression a échoué. Réessaie.");
    }
  };

  return (
    <div>
      <ViewHeader activeSection={activeSection} onSectionChange={onSectionChange} title="Historique des comptages" />
      <div style={{ padding: "16px 14px 40px" }}>
        {error && <div style={{ color: t.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        {loading ? (
          <InfoCard title="Chargement">Récupération de l'historique…</InfoCard>
        ) : history.length === 0 ? (
          <InfoCard title="Aucun comptage" accent={t.accentBlue}>
            Utilise l'onglet « Compteur de caisse » pour faire un comptage — il sera enregistré ici automatiquement.
          </InfoCard>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <Btn variant="danger" onClick={clearAll} style={{ width: "auto", padding: "8px 14px", fontSize: 12 }}>
                Tout effacer
              </Btn>
            </div>
            {history.map(entry => {
              const depotTotal = DENOMINATIONS.reduce((s, d) => s + (entry.depotAlloc[d.label] || 0) * d.value, 0);
              const isOpen = expanded.has(entry.id);
              return (
                <div key={entry.id} className="slide-up" style={{
                  background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14,
                  marginBottom: 10, overflow: "hidden",
                }}>
                  <div onClick={() => toggleExpand(entry.id)} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 16px", cursor: "pointer",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(entry.dateISO)}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>Dépôt : {fmt(depotTotal)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: t.accentGold, fontVariantNumeric: "tabular-nums" }}>{fmt(entry.totalCents)}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                        aria-label="Supprimer ce comptage"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 30, height: 30, background: "transparent", border: "none",
                          color: t.textMuted, fontSize: 18, borderRadius: 8,
                        }}
                      >×</button>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ padding: "0 14px 14px" }}>
                      <AllocTable alloc={entry.floatAlloc} title="Float · gardé en caisse" variant="float" />
                      <AllocTable alloc={entry.depotAlloc} title="Dépôt · enveloppe" variant="depot" />
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compteur de caisse                                                   */
/* ------------------------------------------------------------------ */

function CaisseView({ activeSection, onSectionChange }) {
  const { t } = useTheme();
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

  const reset = () => {
    if (!window.confirm("Réinitialiser le compteur de caisse ?")) return;
    setQuantities({});
    setResult(null);
  };

  const calculate = async () => {
    if (!canCalculate) {
      setResult({ error: true, message: `Il manque ${fmt(FLOAT_TARGET - totalCents)} pour atteindre 300,00 $.` });
      return;
    }
    const calcResult = computeFloat(quantities);
    setResult(calcResult);
    try {
      await appendCashHistory({
        id: uid(),
        dateISO: new Date().toISOString(),
        totalCents,
        floatAlloc: calcResult.floatAlloc,
        depotAlloc: calcResult.depotAlloc,
      });
    } catch {
      setResult({ ...calcResult, saveError: "Le comptage n'a pas pu être enregistré dans l'historique partagé." });
    }
  };

  return (
    <div>
      <ViewHeader
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        title="Compteur de caisse"
        right={
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: t.textMuted, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Total</div>
            <div style={{
              fontFamily: fontBody, fontVariantNumeric: "tabular-nums",
              fontSize: 21, fontWeight: 800,
              color: canCalculate ? t.accentGold : totalCents > 0 ? t.textPrimary : t.textFaint,
              letterSpacing: -0.5,
            }}>
              {fmt(totalCents)}
            </div>
          </div>
        }
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>
              Objectif 300,00 $
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: canCalculate ? t.accentGold : t.textMuted, fontVariantNumeric: "tabular-nums" }}>
              {progressPct}%
            </span>
          </div>
          <div style={{ height: 4, background: t.bgElevated2, borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${progressPct}%`,
              background: canCalculate
                ? `linear-gradient(90deg, ${t.accentGoldDark}, ${t.accentGold})`
                : `linear-gradient(90deg, ${t.textFaint}, ${t.textMuted})`,
              borderRadius: 99,
              transition: "width 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
            }} />
          </div>
        </div>
      </ViewHeader>

      {/* Result */}
      {result && (
        <div style={{ padding: "14px 14px 0" }}>
          {result.error ? (
            <div className="slide-up" style={{
              background: t.dangerBg,
              border: `1px solid ${t.dangerBorder}`,
              borderRadius: 14,
              padding: "14px 16px",
              color: t.danger,
              fontSize: 13,
              fontWeight: 500,
            }}>
              {result.message}
            </div>
          ) : (
            <>
              {result.saveError && (
                <div style={{ color: t.danger, fontSize: 12, marginBottom: 10 }}>{result.saveError}</div>
              )}
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
        background: `${t.bg}f0`,
        backdropFilter: "blur(14px) saturate(1.4)",
        WebkitBackdropFilter: "blur(14px) saturate(1.4)",
        borderTop: `1px solid ${t.border}`,
        boxShadow: `0 -4px 20px ${t.shadow}`,
        padding: "12px 16px 32px",
      }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Btn variant="ghost" onClick={reset}>Réinitialiser</Btn>
          </div>
          <div style={{ flex: 3 }}>
            <Btn onClick={calculate} disabled={!canCalculate && totalCents === 0}>Calculer</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App root                                                             */
/* ------------------------------------------------------------------ */

const VIEWS = {
  home: HomeView,
  caisse: CaisseView,
  historique: CashHistoryView,
  checklist: ClosingChecklistView,
  horaire: ScheduleView,
  menu: MenuView,
  urgence: EmergencyCodesView,
  formation: FormationView,
  about: AboutView,
};

export default function App() {
  const [section, setSection] = useState("home");
  const [themeName, setThemeName] = useState(() => loadJSON(LS_KEYS.theme, "dark"));

  useEffect(() => saveJSON(LS_KEYS.theme, themeName), [themeName]);

  const t = themeName === "light" ? lightTokens : darkTokens;
  const toggleTheme = () => setThemeName(n => (n === "dark" ? "light" : "dark"));

  const ActiveView = VIEWS[section] || HomeView;

  return (
    <ThemeContext.Provider value={{ t, themeName, toggleTheme }}>
      <style>{`body { background: ${t.bg}; --focus-ring: ${t.accentGold}; }`}</style>
      <style>{globalStyles}</style>
      <div style={{
        minHeight: "100vh",
        background: t.bg,
        color: t.textPrimary,
        fontFamily: fontBody,
        maxWidth: 480,
        margin: "0 auto",
      }}>
        <div key={section} className="fade-in">
          <ActiveView activeSection={section} onSectionChange={setSection} />
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
