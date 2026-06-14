"use client";

// Catch-all render — LE vrai pattern AG-UI.
// Hermes est un agent autonome avec ses propres outils Zoho (MCP). Plutot que de
// le forcer a appeler un outil frontend mock, on REND ses tool-calls reels comme
// cartes visuelles dans le chat. useCopilotAction({ name: "*" }) intercepte
// TOUT outil que Hermes declenche et remplace le rendu brut par une carte propre.

import { useCopilotAction } from "@copilotkit/react-core";

// Tente d'extraire des champs lisibles d'un resultat d'outil (string JSON ou objet)
function parseResult(result) {
  if (!result) return null;
  if (typeof result === "object") return result;
  if (typeof result === "string") {
    const s = result.trim();
    try {
      return JSON.parse(s);
    } catch {
      return { texte: s.slice(0, 600) };
    }
  }
  return { texte: String(result) };
}

function jolieCle(k) {
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PilierToolRender() {
  useCopilotAction({
    name: "*", // intercepte tout outil non explicitement defini ailleurs
    render: ({ name, status, args, result }) => {
      const estFacture = /facture|invoice/i.test(name || "");
      const accent = estFacture ? "#22c55e" : "#38bdf8";
      const enCours = status !== "complete";
      const data = parseResult(result);

      // Champs args (parametres passes par Hermes a son outil)
      const argEntries = args && typeof args === "object" ? Object.entries(args) : [];
      // Champs resultat (donnees reelles renvoyees par Zoho)
      const resEntries =
        data && typeof data === "object"
          ? Object.entries(data).filter(
              ([, v]) => v != null && typeof v !== "object"
            )
          : [];

      return (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #334155",
            borderLeft: `4px solid ${accent}`,
            borderRadius: 10,
            padding: "14px 16px",
            margin: "6px 0",
            color: "#e2e8f0",
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 13,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 15 }}>{estFacture ? "🧾" : "🛠️"}</span>
            <strong style={{ color: "#f1f5f9", fontSize: 13 }}>
              {estFacture ? "Facture" : "Outil Hermès"}
            </strong>
            <code
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "#64748b",
                marginLeft: "auto",
              }}
            >
              {name}
            </code>
            <span style={{ fontSize: 9, color: "#334155" }}>· AG-UI·MECG</span>
          </div>

          {argEntries.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "4px 12px",
                fontSize: 12,
                marginBottom: resEntries.length ? 10 : 0,
              }}
            >
              {argEntries.map(([k, v]) => (
                <>
                  <span key={`k-${k}`} style={{ color: "#64748b" }}>
                    {jolieCle(k)}
                  </span>
                  <span key={`v-${k}`} style={{ color: "#e2e8f0" }}>
                    {String(v)}
                  </span>
                </>
              ))}
            </div>
          )}

          {enCours ? (
            <div style={{ color: "#f59e0b", fontSize: 12 }}>
              ⏳ Hermès exécute l&apos;outil…
            </div>
          ) : resEntries.length > 0 ? (
            <div
              style={{
                background: "#1e293b",
                borderRadius: 8,
                padding: "10px 12px",
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "4px 12px",
                fontSize: 12,
              }}
            >
              {resEntries.slice(0, 8).map(([k, v]) => (
                <>
                  <span key={`rk-${k}`} style={{ color: "#64748b" }}>
                    {jolieCle(k)}
                  </span>
                  <span
                    key={`rv-${k}`}
                    style={{
                      color: /montant|total|amount/i.test(k)
                        ? "#22c55e"
                        : "#e2e8f0",
                      fontWeight: /montant|total|amount/i.test(k) ? 700 : 400,
                    }}
                  >
                    {String(v)}
                  </span>
                </>
              ))}
            </div>
          ) : (
            <div style={{ color: "#22c55e", fontSize: 12 }}>✓ Terminé</div>
          )}
        </div>
      );
    },
  });

  return null; // composant logique uniquement
}
