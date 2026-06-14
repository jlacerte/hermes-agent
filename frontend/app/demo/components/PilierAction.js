"use client";

import { useState } from "react";
import { useCopilotAction } from "@copilotkit/react-core";

const FACTURES_MOCK = {
  "FAC-1042": { numero: "FAC-1042", client: "Deslauriers inc.", montant: "3 480,00 $", statut: "En attente" },
  "FAC-1038": { numero: "FAC-1038", client: "CISSSO", montant: "12 750,00 $", statut: "Payée" },
  "FAC-1055": { numero: "FAC-1055", client: "Ville de Gatineau", montant: "6 215,50 $", statut: "En retard" },
};

const STATUT_COULEURS = {
  "Payée":      "#22c55e",
  "En attente": "#f59e0b",
  "En retard":  "#ef4444",
  "Annulée":    "#94a3b8",
};

const STATUTS_VALIDES = ["En attente", "Payée", "En retard", "Annulée"];

export default function PilierAction() {
  const [facture, setFacture] = useState(null);
  const [dernierAction, setDernierAction] = useState(null);

  // Action 1 — afficher une facture avec les VRAIES donnees Zoho fournies par Hermes.
  // Hermes cherche la facture dans Zoho, puis appelle cet outil avec les donnees reelles.
  useCopilotAction({
    name: "ouvrir_facture",
    description:
      "Affiche une facture MECG dans le panneau visuel ET dans le chat (carte). " +
      "APPELLE TOUJOURS cet outil immediatement quand l'utilisateur demande d'ouvrir, voir, afficher ou consulter une facture. " +
      "Le numero de facture suffit — les autres champs sont optionnels et seront completes automatiquement. " +
      "Ne demande JAMAIS de selectionner un client : appelle l'outil avec le seul numero si tu n'as pas le reste.",
    available: "enabled",
    parameters: [
      { name: "numero", type: "string", description: "Numero de la facture, ex: FAC-1042 ou INV-000123", required: true },
      { name: "client", type: "string", description: "Nom du client (optionnel, complete automatiquement)", required: false },
      { name: "montant", type: "string", description: "Montant total formate, ex: 620,87 $ (optionnel)", required: false },
      { name: "statut", type: "string", description: "Statut: Payée, En attente, En retard, Annulée", required: false },
      { name: "date", type: "string", description: "Date de la facture", required: false },
      { name: "details", type: "string", description: "Detail additionnel: bon de commande, lien PDF, note", required: false },
    ],
    handler: async ({ numero, client, montant, statut, date, details }) => {
      const num = (numero || "").trim();
      // Si Hermes ne passe que le numero, on complete depuis les donnees demo.
      const mock = FACTURES_MOCK[num.toUpperCase()] || {};
      const f = {
        numero: num,
        client: client || mock.client || "—",
        montant: montant || mock.montant || "—",
        statut: statut || mock.statut || "—",
        date: date || null,
        details: details || null,
      };
      setFacture(f);
      setDernierAction(`Facture ${num} affichée`);
      return `Facture ${num} affichée dans le panneau — client: ${f.client}, montant: ${f.montant}, statut: ${f.statut}.`;
    },
    // Carte rendue directement dans le chat (Generative UI) pendant/apres l'execution
    render: ({ status, args }) => {
      const a = args || {};
      const couleur = STATUT_COULEURS[a.statut] || "#38bdf8";
      return (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #334155",
            borderLeft: `4px solid ${couleur}`,
            borderRadius: 10,
            padding: "14px 16px",
            margin: "6px 0",
            color: "#e2e8f0",
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ color: "#f1f5f9", fontSize: 14 }}>{a.numero || "Facture"}</strong>
            {a.statut && (
              <span style={{ background: `${couleur}22`, border: `1px solid ${couleur}55`, color: couleur, borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                {a.statut}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 }}>
            <span style={{ color: "#64748b" }}>Client</span><span>{a.client || "—"}</span>
            <span style={{ color: "#64748b" }}>Montant</span><span style={{ color: "#22c55e", fontWeight: 700 }}>{a.montant || "—"}</span>
            {a.date && (<><span style={{ color: "#64748b" }}>Date</span><span>{a.date}</span></>)}
            {a.details && (<><span style={{ color: "#64748b" }}>Détail</span><span style={{ color: "#94a3b8" }}>{a.details}</span></>)}
          </div>
          {status !== "complete" && (
            <div style={{ marginTop: 8, color: "#64748b", fontSize: 11 }}>⏳ chargement depuis Zoho…</div>
          )}
        </div>
      );
    },
  });

  // Action 2 — changer le statut de la facture affichée
  useCopilotAction({
    name: "changer_statut_facture",
    description:
      "Change le statut de la facture actuellement affichée dans le panneau. " +
      `Statuts valides: ${STATUTS_VALIDES.join(", ")}.`,
    available: "enabled",
    parameters: [
      {
        name: "statut",
        type: "string",
        description: "Nouveau statut de la facture",
        enum: STATUTS_VALIDES,
        required: true,
      },
    ],
    handler: async ({ statut }) => {
      if (!facture) {
        return "Aucune facture ouverte. Ouvre d'abord une facture avec ouvrir_facture.";
      }
      if (!STATUTS_VALIDES.includes(statut)) {
        return `Statut invalide. Utilise un de: ${STATUTS_VALIDES.join(", ")}.`;
      }
      setFacture((prev) => prev ? { ...prev, statut } : null);
      setDernierAction(`Statut changé → ${statut}`);
      return `Statut de ${facture.numero} changé à "${statut}".`;
    },
  });

  // --- styles ---
  const styles = {
    container: {
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: 12,
      padding: 24,
      maxWidth: 480,
      color: "#e2e8f0",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      fontSize: 14,
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 20,
    },
    badge: {
      background: "#22c55e22",
      border: "1px solid #22c55e55",
      color: "#22c55e",
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    title: {
      fontSize: 16,
      fontWeight: 700,
      color: "#f1f5f9",
      margin: 0,
    },
    hint: {
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 8,
      padding: "10px 14px",
      marginBottom: 20,
      color: "#94a3b8",
      fontSize: 12,
      lineHeight: 1.6,
    },
    hintAccent: {
      color: "#f59e0b",
      fontWeight: 600,
    },
    panneau: {
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 8,
      padding: 18,
      minHeight: 120,
    },
    empty: {
      color: "#475569",
      textAlign: "center",
      paddingTop: 24,
      paddingBottom: 24,
      fontSize: 13,
    },
    factureGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "10px 16px",
    },
    fieldLabel: {
      color: "#64748b",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    fieldValue: {
      color: "#e2e8f0",
      fontWeight: 600,
      fontSize: 14,
    },
    statutPill: (statut) => ({
      display: "inline-block",
      background: `${STATUT_COULEURS[statut] || "#94a3b8"}22`,
      border: `1px solid ${STATUT_COULEURS[statut] || "#94a3b8"}55`,
      color: STATUT_COULEURS[statut] || "#94a3b8",
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 700,
    }),
    separator: {
      borderTop: "1px solid #334155",
      margin: "14px 0",
    },
    actionLog: {
      color: "#22c55e",
      fontSize: 12,
      display: "flex",
      alignItems: "center",
      gap: 6,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "#22c55e",
      display: "inline-block",
    },
    actionsSection: {
      marginTop: 18,
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: 8,
      padding: "10px 14px",
    },
    actionsTitle: {
      color: "#475569",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    actionItem: {
      color: "#94a3b8",
      fontSize: 12,
      marginBottom: 4,
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
    },
    actionName: {
      color: "#38bdf8",
      fontFamily: "monospace",
      fontSize: 12,
    },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.badge}>Pilier</span>
        <span style={styles.title}>Frontend Action</span>
      </div>

      {/* Hint */}
      <div style={styles.hint}>
        Demande à Philippe:{" "}
        <span style={styles.hintAccent}>"Ouvre la facture FAC-1042"</span>
        {" "}ou{" "}
        <span style={styles.hintAccent}>"Change le statut à Payée"</span>
      </div>

      {/* Panneau facture */}
      <div style={styles.panneau}>
        {!facture ? (
          <div style={styles.empty}>Aucune facture ouverte</div>
        ) : (
          <>
            <div style={styles.factureGrid}>
              <div>
                <div style={styles.fieldLabel}>Numéro</div>
                <div style={styles.fieldValue}>{facture.numero}</div>
              </div>
              <div>
                <div style={styles.fieldLabel}>Statut</div>
                <span style={styles.statutPill(facture.statut)}>{facture.statut}</span>
              </div>
              <div>
                <div style={styles.fieldLabel}>Client</div>
                <div style={styles.fieldValue}>{facture.client}</div>
              </div>
              <div>
                <div style={styles.fieldLabel}>Montant</div>
                <div style={{ ...styles.fieldValue, color: "#22c55e" }}>{facture.montant}</div>
              </div>
              {facture.date && (
                <div>
                  <div style={styles.fieldLabel}>Date</div>
                  <div style={styles.fieldValue}>{facture.date}</div>
                </div>
              )}
              {facture.details && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={styles.fieldLabel}>Détail</div>
                  <div style={{ ...styles.fieldValue, color: "#94a3b8", fontWeight: 400 }}>{facture.details}</div>
                </div>
              )}
            </div>

            {dernierAction && (
              <>
                <div style={styles.separator} />
                <div style={styles.actionLog}>
                  <span style={styles.dot} />
                  {dernierAction}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Actions exposées */}
      <div style={styles.actionsSection}>
        <div style={styles.actionsTitle}>Actions disponibles</div>
        <div style={styles.actionItem}>
          <span style={styles.actionName}>ouvrir_facture</span>
          <span>— affiche une facture par numéro (FAC-XXXX)</span>
        </div>
        <div style={styles.actionItem}>
          <span style={styles.actionName}>changer_statut_facture</span>
          <span>— modifie le statut de la facture affichée</span>
        </div>
      </div>
    </div>
  );
}
