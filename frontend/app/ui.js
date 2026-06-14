"use client";

import { CopilotKit, useCopilotAction } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

function DemoCard({ titre, lignes, statut }) {
  const couleur =
    statut === "ok" ? "#22c55e" : statut === "attention" ? "#f59e0b" : "#64748b";
  return (
    <div
      style={{
        border: `1px solid ${couleur}`,
        borderLeft: `5px solid ${couleur}`,
        borderRadius: 12,
        padding: 16,
        margin: "8px 0",
        background: "#0f172a",
        color: "#e2e8f0",
        maxWidth: 320,
        fontFamily: "system-ui",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
        {titre}
      </div>
      {(lignes || []).map((l, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "4px 0",
            borderTop: i ? "1px solid #1e293b" : "none",
            fontSize: 13,
          }}
        >
          <span style={{ opacity: 0.7 }}>{l.label}</span>
          <span style={{ fontWeight: 600 }}>{l.valeur}</span>
        </div>
      ))}
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: couleur,
        }}
      >
        ● {statut || "info"}
      </div>
    </div>
  );
}

function CopilotActions() {
  // Generative UI : Philippe peut rendre une carte visuelle dans le chat
  useCopilotAction({
    name: "afficher_carte",
    available: "enabled",
    description:
      "Affiche une carte visuelle structurée dans le chat (Generative UI). Utilise-la quand Justin demande de voir une carte, un résumé visuel, un tableau de bord ou des données structurées.",
    parameters: [
      { name: "titre", type: "string", description: "Titre de la carte", required: true },
      {
        name: "statut",
        type: "string",
        description: "ok, attention ou info",
        required: false,
      },
      {
        name: "lignes",
        type: "string",
        description:
          "Lignes de la carte, une par ligne, au format 'Label: Valeur' séparées par des retours à la ligne",
        required: true,
      },
    ],
    render: ({ args }) => {
      const lignes = (args.lignes || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const i = l.indexOf(":");
          return i === -1
            ? { label: l, valeur: "" }
            : { label: l.slice(0, i).trim(), valeur: l.slice(i + 1).trim() };
        });
      return (
        <DemoCard
          titre={args.titre || "Carte"}
          lignes={lignes}
          statut={args.statut || "info"}
        />
      );
    },
  });
  return null;
}

export default function PhilippeUI() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <CopilotActions />
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg,#0f172a 0%,#1e293b 100%)",
          color: "#e2e8f0",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 8 }}>🐙</div>
        <h1 style={{ margin: "0 0 8px", fontSize: 26 }}>Philippe</h1>
        <p style={{ margin: 0, opacity: 0.75, maxWidth: 360 }}>
          Ton assistant Mécanique Gicleurs. Touche la bulle en bas à droite pour lui parler.
        </p>
        <p style={{ marginTop: 24, fontSize: 12, opacity: 0.55, maxWidth: 360 }}>
          💡 Essaie : « montre-moi une carte de démo avec 3 lignes »
        </p>
        <p style={{ marginTop: 24, fontSize: 12, opacity: 0.4 }}>
          CopilotKit · Hermès · VPN MECG
        </p>
      </main>

      <CopilotPopup
        instructions="Tu es Philippe, l'assistant de Mécanique Gicleurs. Réponds en français, ton direct et factuel. Tu parles à Justin Lacerte, le propriétaire. Quand Justin demande de voir une carte, un résumé visuel ou des données structurées, utilise l'action afficher_carte au lieu de répondre en texte."
        labels={{
          title: "Philippe",
          initial: "Salut Justin ! Demande-moi « montre-moi une carte de démo » pour voir le visuel.",
          placeholder: "Écris ta question…",
        }}
      />
    </CopilotKit>
  );
}
