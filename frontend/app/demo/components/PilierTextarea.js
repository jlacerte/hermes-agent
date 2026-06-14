"use client";

import { useState, Component } from "react";
import { BaseCopilotTextarea } from "@copilotkit/react-textarea";
import "@copilotkit/react-textarea/styles.css";

// Garde-fou: le rendu du texte fantome de l'autosuggestion peut lancer une
// erreur transitoire Slate ("Cannot resolve a DOM point") quand le curseur
// bouge pendant l'arrivee de la suggestion (frequent sur clavier mobile/IME).
// Au lieu de laisser cette erreur faire planter toute la page, on la rattrape
// et on remonte le widget (key++) -> recuperation silencieuse, texte preserve.
class TextareaBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { key: 0 };
  }
  componentDidCatch(error) {
    if (String(error?.message || "").includes("Cannot resolve a DOM point")) {
      // erreur Slate transitoire -> remonter le widget
      this.setState((s) => ({ key: s.key + 1 }));
    } else {
      throw error;
    }
  }
  render() {
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}

export default function PilierTextarea() {
  const [texte, setTexte] = useState("");
  const [destinataire, setDestinataire] = useState("Deslauriers");

  const exemples = [
    "Deslauriers",
    "CISSSO",
    "Ville de Gatineau",
  ];

  return (
    <div
      style={{
        background: "#0f172a",
        color: "#e2e8f0",
        borderRadius: "12px",
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "720px",
        margin: "0 auto",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <div
          style={{
            background: "#f59e0b",
            borderRadius: "8px",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            flexShrink: 0,
          }}
        >
          ✉
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "16px", color: "#f1f5f9" }}>
            CopilotTextarea — Relance MECG
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8" }}>
            Autocomplétion IA • Cmd+K pour suggestions • Tab pour accepter
          </div>
        </div>
      </div>

      {/* Sélecteur destinataire */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
          Destinataire
        </label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {exemples.map((nom) => (
            <button
              key={nom}
              onClick={() => setDestinataire(nom)}
              style={{
                padding: "4px 12px",
                borderRadius: "20px",
                border: "1px solid",
                borderColor: destinataire === nom ? "#f59e0b" : "#334155",
                background: destinataire === nom ? "#78350f" : "#1e293b",
                color: destinataire === nom ? "#fde68a" : "#94a3b8",
                cursor: "pointer",
                fontSize: "13px",
                transition: "all 0.15s",
              }}
            >
              {nom}
            </button>
          ))}
        </div>
      </div>

      {/* Label champ */}
      <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "8px" }}>
        Corps du courriel de relance
      </label>

      {/* CopilotTextarea */}
      <div
        style={{
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #334155",
        }}
      >
        <TextareaBoundary>
        <BaseCopilotTextarea
          value={texte}
          onValueChange={(val) => setTexte(val || "")}
          placeholder={`Rédigez votre relance pour ${destinataire}...`}
          rows={8}
          style={{
            width: "100%",
            minHeight: "180px",
            background: "#1e293b",
            color: "#e2e8f0",
            border: "none",
            padding: "14px",
            fontSize: "14px",
            lineHeight: "1.6",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
          placeholderStyle={{
            color: "#475569",
            fontStyle: "italic",
          }}
          suggestionsStyle={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: "#94a3b8",
            fontSize: "13px",
          }}
          baseAutosuggestionsConfig={{
            textareaPurpose: `Rédiger un courriel de relance professionnel, poli mais ferme,
au nom de Mécanique Gicleurs (MECG), entreprise de systèmes de gicleurs incendie en Outaouais.
Le destinataire est ${destinataire}.
L'objectif est de rappeler une facture impayée ou un suivi de service en attente,
de façon courtoise mais avec une demande d'action claire.
Ton: professionnel, direct, en français québécois correct.`,
            // Declenchement fiable: ne pas suspendre l'autosuggestion sur les
            // mouvements de curseur / events synthetiques (sinon 0 suggestion).
            debounceTime: 300,
            disableWhenEmpty: false,
            temporarilyDisableWhenMovingCursorWithoutChangingText: false,
            temporarilyDisableNotTrustedEvents: false,
            // CONTOURNEMENT bug @copilotkit/react-textarea@1.60.1: la fonction
            // d'autosuggestion interne du package ne fait AUCUN appel reseau
            // (`const response = {}` code en dur -> retourne toujours ""). On
            // fournit notre propre fonction qui appelle vraiment le LLM via /api/autosuggest.
            apiConfig: {
              // noop pour Cmd+K (insertion) — non requis pour l'autosuggestion inline
              insertionOrEditingFunction: async () => "",
              autosuggestionsFunction: async (editorState, abortSignal) => {
                try {
                  const res = await fetch("/api/autosuggest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: abortSignal,
                    body: JSON.stringify({
                      textBeforeCursor: editorState.textBeforeCursor || "",
                      textAfterCursor: editorState.textAfterCursor || "",
                      purpose: `Courriel de relance MECG pour ${destinataire}`,
                    }),
                  });
                  const data = await res.json();
                  return data.suggestion || "";
                } catch (e) {
                  if (e.name === "AbortError") return "";
                  return "";
                }
              },
            },
          }}
        />
        </TextareaBoundary>
      </div>

      {/* Stats et actions */}
      <div
        style={{
          marginTop: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          {texte.length > 0 ? (
            <span>
              <span style={{ color: "#22c55e" }}>{texte.split(/\s+/).filter(Boolean).length}</span>
              {" mots · "}
              <span style={{ color: "#f59e0b" }}>{texte.length}</span>
              {" caractères"}
            </span>
          ) : (
            <span>En attente de saisie…</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setTexte("")}
            disabled={!texte}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid #334155",
              background: "transparent",
              color: texte ? "#94a3b8" : "#334155",
              cursor: texte ? "pointer" : "default",
              fontSize: "13px",
            }}
          >
            Effacer
          </button>
          <button
            disabled={!texte}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              background: texte ? "#22c55e" : "#166534",
              color: texte ? "#0f172a" : "#4ade80",
              cursor: texte ? "pointer" : "default",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Envoyer
          </button>
        </div>
      </div>

      {/* Badge pilier */}
      <div
        style={{
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 6px #22c55e",
          }}
        />
        <span style={{ fontSize: "11px", color: "#475569" }}>
          @copilotkit/react-textarea@1.60.1 — Pilier CopilotTextarea actif
        </span>
      </div>
    </div>
  );
}
