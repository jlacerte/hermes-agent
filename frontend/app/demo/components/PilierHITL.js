"use client";

import { useState, useCallback } from "react";
import { useCopilotAction } from "@copilotkit/react-core";

// --- couleurs décision ---
const DECISION_COULEURS = {
  approuve: "#22c55e",
  refuse:   "#ef4444",
  pending:  "#f59e0b",
};

const MAX_JOURNAL = 10;

export default function PilierHITL() {
  // Journal des décisions passées
  const [journal, setJournal] = useState([]);

  const ajouterDecision = useCallback((client, montant, decision) => {
    setJournal((prev) => {
      const entry = {
        id:       Date.now(),
        client,
        montant,
        decision,
        heure:    new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      return [entry, ...prev].slice(0, MAX_JOURNAL);
    });
  }, []);

  // --- Action Human-in-the-Loop ---
  useCopilotAction({
    name: "confirmer_relance",
    description:
      "Demande à l'utilisateur d'approuver ou refuser l'envoi d'une relance de paiement. " +
      "Hermes utilise cette action AVANT d'envoyer tout courriel de relance. " +
      "Paramètres: client (nom) et montant (ex: '3 480,00 $'). " +
      "Retourne 'approuve' ou 'refuse' selon la décision de l'utilisateur.",
    available: "enabled",
    parameters: [
      {
        name: "client",
        type: "string",
        description: "Nom du client à relancer",
        required: true,
      },
      {
        name: "montant",
        type: "string",
        description: "Montant impayé, ex: '3 480,00 $'",
        required: true,
      },
    ],
    // handler optionnel — traite la réponse après respond()
    handler: async ({ client, montant }) => {
      // Ce handler reçoit la valeur passée à respond() via renderAndWaitForResponse
      // La valeur est déjà traitée dans renderAndWaitForResponse — ici on confirme juste
      return `Décision enregistrée pour la relance de ${client}.`;
    },
    renderAndWaitForResponse: ({ args, status, respond }) => {
      const client  = args?.client  || "—";
      const montant = args?.montant || "—";
      const enAttente = status === "executing";

      const handleRepondre = (decision) => {
        if (!respond) return;
        ajouterDecision(client, montant, decision);
        respond(decision);
      };

      // Carte d'approbation inline
      return (
        <div style={carteStyles.overlay}>
          <div style={carteStyles.carte}>
            {/* Badge */}
            <div style={carteStyles.badgeRow}>
              <span style={carteStyles.badge}>Approbation requise</span>
              {!enAttente && (
                <span style={{ ...carteStyles.badge, background: "#94a3b822", borderColor: "#94a3b855", color: "#94a3b8" }}>
                  Traité
                </span>
              )}
            </div>

            {/* Corps */}
            <div style={carteStyles.corps}>
              <div style={carteStyles.ligne}>
                <span style={carteStyles.label}>Client</span>
                <span style={carteStyles.valeur}>{client}</span>
              </div>
              <div style={carteStyles.ligne}>
                <span style={carteStyles.label}>Montant impayé</span>
                <span style={{ ...carteStyles.valeur, color: "#f59e0b", fontWeight: 700 }}>{montant}</span>
              </div>
              <div style={carteStyles.ligne}>
                <span style={carteStyles.label}>Action</span>
                <span style={carteStyles.valeur}>Envoi courriel de relance</span>
              </div>
            </div>

            {/* Boutons — seulement pendant l'exécution */}
            {enAttente ? (
              <div style={carteStyles.boutons}>
                <button
                  style={{ ...carteStyles.btn, ...carteStyles.btnApprouver }}
                  onClick={() => handleRepondre("approuve")}
                >
                  Approuver
                </button>
                <button
                  style={{ ...carteStyles.btn, ...carteStyles.btnRefuser }}
                  onClick={() => handleRepondre("refuse")}
                >
                  Refuser
                </button>
              </div>
            ) : (
              <div style={carteStyles.traiteMsg}>
                Décision soumise — en attente de confirmation Hermes…
              </div>
            )}
          </div>
        </div>
      );
    },
  });

  // --- styles panneau principal ---
  const s = {
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
      background: "#f59e0b22",
      border: "1px solid #f59e0b55",
      color: "#f59e0b",
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
    journalSection: {
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 8,
      padding: 16,
      minHeight: 120,
    },
    journalTitle: {
      color: "#64748b",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    empty: {
      color: "#475569",
      textAlign: "center",
      paddingTop: 20,
      paddingBottom: 20,
      fontSize: 13,
    },
    entryRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "7px 0",
      borderBottom: "1px solid #0f172a",
    },
    entryLeft: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
    },
    entryClient: {
      color: "#e2e8f0",
      fontWeight: 600,
      fontSize: 13,
    },
    entryMontant: {
      color: "#94a3b8",
      fontSize: 12,
    },
    entryRight: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 2,
    },
    entryHeure: {
      color: "#475569",
      fontSize: 11,
    },
    decisionPill: (decision) => ({
      display: "inline-block",
      background: `${DECISION_COULEURS[decision] || "#94a3b8"}22`,
      border: `1px solid ${DECISION_COULEURS[decision] || "#94a3b8"}55`,
      color: DECISION_COULEURS[decision] || "#94a3b8",
      borderRadius: 6,
      padding: "1px 9px",
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    }),
    actionSection: {
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
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.badge}>Pilier</span>
        <span style={s.title}>Human-in-the-Loop</span>
      </div>

      {/* Hint */}
      <div style={s.hint}>
        Demande à Hermes:{" "}
        <span style={s.hintAccent}>"Envoie une relance à Deslauriers pour 3 480,00 $"</span>
        {" "}— il demandera ton approbation avant d'agir.
      </div>

      {/* Journal des décisions */}
      <div style={s.journalSection}>
        <div style={s.journalTitle}>Journal des décisions</div>
        {journal.length === 0 ? (
          <div style={s.empty}>Aucune décision encore — en attente de relance…</div>
        ) : (
          journal.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                ...s.entryRow,
                ...(idx === journal.length - 1 ? { borderBottom: "none" } : {}),
              }}
            >
              <div style={s.entryLeft}>
                <span style={s.entryClient}>{entry.client}</span>
                <span style={s.entryMontant}>{entry.montant}</span>
              </div>
              <div style={s.entryRight}>
                <span style={s.decisionPill(entry.decision)}>
                  {entry.decision === "approuve" ? "Approuvé" : "Refusé"}
                </span>
                <span style={s.entryHeure}>{entry.heure}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Actions exposées */}
      <div style={s.actionSection}>
        <div style={s.actionsTitle}>Action HITL enregistrée</div>
        <div style={s.actionItem}>
          <span style={s.actionName}>confirmer_relance</span>
          <span>— approbation requise avant envoi courriel</span>
        </div>
      </div>
    </div>
  );
}

// --- styles de la carte d'approbation (rendue dans le chat CopilotKit) ---
const carteStyles = {
  overlay: {
    padding: "4px 0",
  },
  carte: {
    background: "#1e293b",
    border: "1px solid #f59e0b55",
    borderRadius: 10,
    padding: 18,
    maxWidth: 360,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontSize: 14,
    color: "#e2e8f0",
  },
  badgeRow: {
    display: "flex",
    gap: 8,
    marginBottom: 14,
  },
  badge: {
    background: "#f59e0b22",
    border: "1px solid #f59e0b55",
    color: "#f59e0b",
    borderRadius: 6,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  corps: {
    background: "#0f172a",
    borderRadius: 8,
    padding: "10px 14px",
    marginBottom: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  ligne: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: "#64748b",
    fontSize: 12,
  },
  valeur: {
    color: "#e2e8f0",
    fontWeight: 600,
    fontSize: 13,
  },
  boutons: {
    display: "flex",
    gap: 10,
  },
  btn: {
    flex: 1,
    padding: "9px 0",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
  btnApprouver: {
    background: "#22c55e",
    color: "#0f172a",
  },
  btnRefuser: {
    background: "#ef444422",
    border: "1px solid #ef444455",
    color: "#ef4444",
  },
  traiteMsg: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    paddingTop: 4,
  },
};
