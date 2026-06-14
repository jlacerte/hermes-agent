"use client";

import { useState, useCallback } from "react";
import {
  CopilotKit,
  useCopilotAction,
  useCopilotReadable,
} from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

// ---------------------------------------------------------------------------
// Page PROD de Philippe (Hermès). Contrairement à /demo (gpt-4o-mini, données
// factices), ici le runtime est le VRAI Philippe via /api/copilotkit, et les
// données viennent de ses outils Zoho. Les actions frontend ne servent qu'à
// AFFICHER / DEMANDER UNE APPROBATION — l'intelligence et les données sont chez
// Philippe.
//   - afficher_carte      (Generative UI)        — rend une carte dans le chat
//   - ouvrir_facture      (Frontend Action)      — affiche une vraie facture
//   - confirmer_relance   (Human-in-the-Loop)    — approbation avant envoi réel
//   - useCopilotReadable  (contexte de page)     — Philippe « voit » la facture ouverte
// ---------------------------------------------------------------------------

const STATUT_COULEURS = {
  "Payée": "#22c55e",
  "Payee": "#22c55e",
  "En attente": "#f59e0b",
  "En souffrance": "#ef4444",
  "En retard": "#ef4444",
  "Overdue": "#ef4444",
  "Annulée": "#94a3b8",
  "Brouillon": "#64748b",
};

function couleurStatut(statut) {
  if (!statut) return "#38bdf8";
  return STATUT_COULEURS[statut] || STATUT_COULEURS[statut.trim()] || "#38bdf8";
}

// --- Carte générique (Generative UI / afficher_carte) ---
function CarteGenerique({ titre, lignes, statut }) {
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
        maxWidth: 340,
        fontFamily: "system-ui",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{titre}</div>
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

// --- Carte facture rendue dans le chat (ouvrir_facture) ---
function CarteFacture({ args, status }) {
  const a = args || {};
  const couleur = couleurStatut(a.statut);
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
        maxWidth: 360,
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
        <div style={{ marginTop: 8, color: "#64748b", fontSize: 11 }}>⏳ chargement…</div>
      )}
    </div>
  );
}

function PhilippeCockpit() {
  const [facture, setFacture] = useState(null);
  const [journal, setJournal] = useState([]);

  const ajouterDecision = useCallback((client, montant, decision) => {
    setJournal((prev) => [
      {
        id: `${client}-${prev.length}`,
        client,
        montant,
        decision,
      },
      ...prev,
    ].slice(0, 10));
  }, []);

  // --- Contexte de page exposé à Philippe (useCopilotReadable) ---
  // Philippe « voit » la facture actuellement ouverte sans qu'on la lui répète.
  useCopilotReadable({
    description:
      "La facture MECG actuellement ouverte/affichée dans le panneau de l'interface prod. " +
      "Null si aucune facture n'est ouverte. Quand Justin parle de 'cette facture' ou 'la facture ouverte', " +
      "c'est celle-ci.",
    value: facture,
  });

  // --- Pilier Generative UI : carte visuelle générique ---
  useCopilotAction({
    name: "afficher_carte",
    available: "enabled",
    description:
      "Affiche une carte visuelle structurée dans le chat (Generative UI). Utilise-la pour présenter " +
      "un résumé, un mini-tableau de bord ou des données structurées (ex: comptes à recevoir, état d'un client). " +
      "Remplis-la avec de VRAIES données issues de tes outils Zoho.",
    parameters: [
      { name: "titre", type: "string", description: "Titre de la carte", required: true },
      { name: "statut", type: "string", description: "ok, attention ou info", required: false },
      {
        name: "lignes",
        type: "string",
        description: "Lignes 'Label: Valeur' séparées par des retours à la ligne",
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
      return <CarteGenerique titre={args.titre || "Carte"} lignes={lignes} statut={args.statut || "info"} />;
    },
  });

  // --- Pilier Frontend Action : ouvrir une VRAIE facture ---
  // Philippe récupère la facture via ses outils Zoho Books, puis appelle cette
  // action avec les vraies données pour l'afficher dans le panneau + une carte.
  useCopilotAction({
    name: "ouvrir_facture",
    available: "enabled",
    description:
      "Affiche une facture MECG dans le panneau visuel ET dans le chat. " +
      "IMPORTANT: récupère D'ABORD les vraies données de la facture via tes outils Zoho Books " +
      "(numéro, client, montant, statut, date), PUIS appelle cette action avec ces vraies données. " +
      "Ne passe jamais de données inventées.",
    parameters: [
      { name: "numero", type: "string", description: "Numéro de la facture (ex: FAC-2301)", required: true },
      { name: "client", type: "string", description: "Nom réel du client", required: false },
      { name: "montant", type: "string", description: "Montant total formaté (ex: 2 109,79 $)", required: false },
      { name: "statut", type: "string", description: "Statut réel (Payée, En attente, En souffrance…)", required: false },
      { name: "date", type: "string", description: "Date de la facture", required: false },
      { name: "details", type: "string", description: "Détail additionnel (PO, note)", required: false },
    ],
    handler: async ({ numero, client, montant, statut, date, details }) => {
      const f = {
        numero: (numero || "").trim(),
        client: client || "—",
        montant: montant || "—",
        statut: statut || "—",
        date: date || null,
        details: details || null,
      };
      setFacture(f);
      return `Facture ${f.numero} affichée dans le panneau (client: ${f.client}, montant: ${f.montant}, statut: ${f.statut}).`;
    },
    render: ({ status, args }) => <CarteFacture args={args} status={status} />,
  });

  // --- Pilier Human-in-the-Loop : approbation avant relance réelle ---
  // Philippe propose une relance, la carte demande l'approbation, et la décision
  // ('approuve'/'refuse') est renvoyée à Philippe qui agit en conséquence.
  useCopilotAction({
    name: "confirmer_relance",
    available: "enabled",
    description:
      "Demande à Justin d'approuver ou refuser l'envoi d'une relance de paiement AVANT d'agir. " +
      "Appelle cette action avant tout envoi de courriel de relance. Retourne 'approuve' ou 'refuse'. " +
      "N'envoie le courriel QUE si la réponse est 'approuve'.",
    parameters: [
      { name: "client", type: "string", description: "Nom du client à relancer", required: true },
      { name: "montant", type: "string", description: "Montant impayé (ex: 2 109,79 $)", required: true },
    ],
    renderAndWaitForResponse: ({ args, status, respond }) => {
      const client = args?.client || "—";
      const montant = args?.montant || "—";
      const enAttente = status === "executing";
      const repondre = (decision) => {
        if (!respond) return;
        ajouterDecision(client, montant, decision);
        respond(decision);
      };
      return (
        <div style={hitl.carte}>
          <div style={hitl.badgeRow}>
            <span style={hitl.badge}>Approbation requise</span>
            {!enAttente && (
              <span style={{ ...hitl.badge, background: "#94a3b822", borderColor: "#94a3b855", color: "#94a3b8" }}>
                Traité
              </span>
            )}
          </div>
          <div style={hitl.corps}>
            <div style={hitl.ligne}><span style={hitl.label}>Client</span><span style={hitl.valeur}>{client}</span></div>
            <div style={hitl.ligne}><span style={hitl.label}>Montant impayé</span><span style={{ ...hitl.valeur, color: "#f59e0b", fontWeight: 700 }}>{montant}</span></div>
            <div style={hitl.ligne}><span style={hitl.label}>Action</span><span style={hitl.valeur}>Envoi courriel de relance</span></div>
          </div>
          {enAttente ? (
            <div style={hitl.boutons}>
              <button style={{ ...hitl.btn, ...hitl.btnOui }} onClick={() => repondre("approuve")}>Approuver</button>
              <button style={{ ...hitl.btn, ...hitl.btnNon }} onClick={() => repondre("refuse")}>Refuser</button>
            </div>
          ) : (
            <div style={hitl.traite}>Décision soumise — Philippe poursuit…</div>
          )}
        </div>
      );
    },
  });

  // --- Panneaux visibles (rend les piliers démontrables/visibles) ---
  return (
    <main style={page.main}>
      <div style={{ fontSize: 56, marginBottom: 8 }}>🐙</div>
      <h1 style={{ margin: "0 0 8px", fontSize: 26 }}>Philippe</h1>
      <p style={{ margin: 0, opacity: 0.75, maxWidth: 380 }}>
        Ton assistant Mécanique Gicleurs — branché sur tes vraies données Zoho.
        Touche la bulle en bas à droite pour lui parler.
      </p>

      <div style={page.grid}>
        {/* Panneau facture ouverte */}
        <div style={page.panneau}>
          <div style={page.panneauTitre}>Facture ouverte</div>
          {!facture ? (
            <div style={page.vide}>Aucune facture ouverte — demande « ouvre la facture FAC-2301 »</div>
          ) : (
            <div style={page.factureGrid}>
              <div><div style={page.fLabel}>Numéro</div><div style={page.fVal}>{facture.numero}</div></div>
              <div><div style={page.fLabel}>Statut</div><span style={page.pill(couleurStatut(facture.statut))}>{facture.statut}</span></div>
              <div><div style={page.fLabel}>Client</div><div style={page.fVal}>{facture.client}</div></div>
              <div><div style={page.fLabel}>Montant</div><div style={{ ...page.fVal, color: "#22c55e" }}>{facture.montant}</div></div>
              {facture.date && (<div><div style={page.fLabel}>Date</div><div style={page.fVal}>{facture.date}</div></div>)}
              {facture.details && (<div style={{ gridColumn: "1 / -1" }}><div style={page.fLabel}>Détail</div><div style={{ ...page.fVal, fontWeight: 400, color: "#94a3b8" }}>{facture.details}</div></div>)}
            </div>
          )}
        </div>

        {/* Journal des décisions de relance */}
        <div style={page.panneau}>
          <div style={page.panneauTitre}>Décisions de relance</div>
          {journal.length === 0 ? (
            <div style={page.vide}>Aucune décision — demande « relance Ramada pour 2 109,79 $ »</div>
          ) : (
            journal.map((e) => (
              <div key={e.id} style={page.jRow}>
                <div>
                  <div style={page.fVal}>{e.client}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>{e.montant}</div>
                </div>
                <span style={page.pill(e.decision === "approuve" ? "#22c55e" : "#ef4444")}>
                  {e.decision === "approuve" ? "Approuvé" : "Refusé"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, opacity: 0.4 }}>CopilotKit · Hermès · VPN MECG</p>
    </main>
  );
}

export default function PhilippeUI() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <PhilippeCockpit />
      <CopilotPopup
        instructions={`Tu es Philippe, l'assistant de Mécanique Gicleurs (MECG). Tu parles à Justin Lacerte, le propriétaire. Réponds en français, ton direct et factuel.

Tu disposes d'OUTILS D'AFFICHAGE dans cette interface (en plus de tes outils Zoho habituels). Utilise-les pour rendre tes réponses visuelles :

• FACTURES : quand Justin demande d'ouvrir, voir, afficher ou consulter une facture, récupère D'ABORD les vraies données via tes outils Zoho Books (numéro, client, montant, statut, date), PUIS appelle l'action 'ouvrir_facture' avec ces vraies données pour l'afficher dans le panneau. Ne montre jamais de données inventées.

• CARTES / RÉSUMÉS : pour un résumé visuel, un état de comptes à recevoir ou un mini-tableau de bord, appelle 'afficher_carte' avec de vraies données Zoho.

• RELANCES : quand Justin veut envoyer une relance/rappel de paiement, appelle TOUJOURS 'confirmer_relance' d'abord (client + montant) pour obtenir son approbation. Tu n'envoies le courriel de relance via tes outils QUE si la réponse est 'approuve'. Si 'refuse', n'envoie rien.

• CONTEXTE : la facture actuellement ouverte dans le panneau t'est exposée comme contexte. Quand Justin dit « cette facture » ou « la facture ouverte », c'est celle-là.`}
        labels={{
          title: "Philippe",
          initial: "Salut Justin ! Demande-moi d'ouvrir une facture, un résumé de tes comptes à recevoir, ou une relance.",
          placeholder: "Écris ta question…",
        }}
      />
    </CopilotKit>
  );
}

// --- styles page ---
const page = {
  main: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "linear-gradient(160deg,#0f172a 0%,#1e293b 100%)",
    color: "#e2e8f0",
    padding: 24,
    textAlign: "center",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  grid: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 32,
    width: "100%",
    maxWidth: 820,
  },
  panneau: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 20,
    width: 380,
    textAlign: "left",
    minHeight: 140,
  },
  panneauTitre: {
    color: "#64748b",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  vide: { color: "#475569", fontSize: 13, paddingTop: 12 },
  factureGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" },
  fLabel: { color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  fVal: { color: "#e2e8f0", fontWeight: 600, fontSize: 14 },
  pill: (couleur) => ({
    display: "inline-block",
    background: `${couleur}22`,
    border: `1px solid ${couleur}55`,
    color: couleur,
    borderRadius: 6,
    padding: "2px 10px",
    fontSize: 12,
    fontWeight: 700,
  }),
  jRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderTop: "1px solid #1e293b",
  },
};

// --- styles carte HITL ---
const hitl = {
  carte: {
    background: "#1e293b",
    border: "1px solid #f59e0b55",
    borderRadius: 10,
    padding: 18,
    maxWidth: 360,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 14,
    color: "#e2e8f0",
    margin: "6px 0",
  },
  badgeRow: { display: "flex", gap: 8, marginBottom: 14 },
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
  ligne: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  label: { color: "#64748b", fontSize: 12 },
  valeur: { color: "#e2e8f0", fontWeight: 600, fontSize: 13 },
  boutons: { display: "flex", gap: 10 },
  btn: { flex: 1, padding: "9px 0", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  btnOui: { background: "#22c55e", color: "#0f172a" },
  btnNon: { background: "#ef444422", border: "1px solid #ef444455", color: "#ef4444" },
  traite: { color: "#64748b", fontSize: 12, textAlign: "center", paddingTop: 4 },
};
