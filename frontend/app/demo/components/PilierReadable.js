"use client";

import { useState } from "react";
import { useCopilotReadable } from "@copilotkit/react-core";

const CLIENTS = ["Deslauriers", "CISSSO", "Ville de Gatineau"];

// Palette sombre coherente
const styles = {
  container: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "480px",
    fontFamily: "system-ui, sans-serif",
    color: "#e2e8f0",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "20px",
  },
  badge: {
    backgroundColor: "#22c55e22",
    color: "#22c55e",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.08em",
    padding: "3px 10px",
    borderRadius: "99px",
    border: "1px solid #22c55e44",
  },
  title: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#e2e8f0",
    margin: 0,
  },
  subtitle: {
    fontSize: "12px",
    color: "#64748b",
    margin: "0 0 20px 0",
  },
  selectorLabel: {
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.06em",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: "10px",
  },
  buttonGroup: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },
  btnActive: {
    backgroundColor: "#22c55e",
    color: "#0f172a",
    border: "1px solid #22c55e",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
  },
  btnInactive: {
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "400",
    cursor: "pointer",
  },
  statusCard: {
    backgroundColor: "#1e293b",
    borderRadius: "8px",
    padding: "14px 16px",
    marginBottom: "16px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabel: {
    fontSize: "11px",
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  statusValue: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#22c55e",
  },
  statusNone: {
    fontSize: "14px",
    fontWeight: "400",
    color: "#475569",
    fontStyle: "italic",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#22c55e",
    display: "inline-block",
    marginRight: "6px",
    boxShadow: "0 0 6px #22c55e88",
  },
  dotOff: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#475569",
    display: "inline-block",
    marginRight: "6px",
  },
  hintBox: {
    backgroundColor: "#f59e0b11",
    border: "1px solid #f59e0b33",
    borderRadius: "8px",
    padding: "12px 14px",
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  hintIcon: {
    fontSize: "16px",
    flexShrink: 0,
    marginTop: "1px",
  },
  hintText: {
    fontSize: "12px",
    color: "#fbbf24",
    lineHeight: "1.5",
    margin: 0,
  },
  hintBold: {
    fontWeight: "700",
  },
  divider: {
    borderColor: "#1e293b",
    borderStyle: "solid",
    borderWidth: "0 0 1px 0",
    margin: "16px 0",
  },
};

export default function PilierReadable() {
  const [selectedClient, setSelectedClient] = useState(null);

  // Expose le client selectionne a Hermes via useCopilotReadable
  useCopilotReadable({
    description:
      "Le client MECG actuellement sélectionné dans l'interface. " +
      "Null si aucun client n'est sélectionné. " +
      "Clients possibles: Deslauriers, CISSSO, Ville de Gatineau.",
    value: selectedClient,
  });

  return (
    <div style={styles.container}>
      {/* En-tete */}
      <div style={styles.header}>
        <span style={styles.dot} />
        <p style={styles.title}>useCopilotReadable</p>
        <span style={styles.badge}>PILIER 1</span>
      </div>
      <p style={styles.subtitle}>
        Hermes voit l'état de la page sans qu'on le lui répète.
      </p>

      {/* Selecteur client */}
      <div style={styles.selectorLabel}>Sélectionner un client MECG</div>
      <div style={styles.buttonGroup}>
        {CLIENTS.map((client) => (
          <button
            key={client}
            style={
              selectedClient === client ? styles.btnActive : styles.btnInactive
            }
            onClick={() =>
              setSelectedClient((prev) => (prev === client ? null : client))
            }
          >
            {client}
          </button>
        ))}
      </div>

      <hr style={styles.divider} />

      {/* Etat expose */}
      <div style={styles.statusCard}>
        <div style={styles.statusRow}>
          <span style={styles.statusLabel}>
            <span style={selectedClient ? styles.dot : styles.dotOff} />
            Contexte exposé à Hermes
          </span>
          {selectedClient ? (
            <span style={styles.statusValue}>{selectedClient}</span>
          ) : (
            <span style={styles.statusNone}>aucun</span>
          )}
        </div>
      </div>

      {/* Indice de demonstration */}
      <div style={styles.hintBox}>
        <span style={styles.hintIcon}>💡</span>
        <p style={styles.hintText}>
          <span style={styles.hintBold}>Demande à Philippe :</span>{" "}
          <em>« Quel client est sélectionné en ce moment ? »</em>
          <br />
          Il répondra correctement sans que tu aies eu à le lui dire —
          il lit le contexte directement.
        </p>
      </div>
    </div>
  );
}
