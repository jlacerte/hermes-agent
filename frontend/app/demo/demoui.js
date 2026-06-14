"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

import PilierReadable from "./components/PilierReadable";
import PilierAction from "./components/PilierAction";
import PilierHITL from "./components/PilierHITL";
import PilierTextarea from "./components/PilierTextarea";
import PilierToolRender from "./components/PilierToolRender";

const PILIERS = [
  {
    num: "01",
    slug: "readable",
    titre: "useCopilotReadable",
    desc: "Expose l'état de la page à Philippe — il voit le contexte sans qu'on le lui répète.",
    accent: "#22c55e",
  },
  {
    num: "02",
    slug: "action",
    titre: "useCopilotAction (Frontend Action)",
    desc: "Philippe peut déclencher des actions dans l'interface — ouvrir une facture, changer un statut.",
    accent: "#38bdf8",
  },
  {
    num: "03",
    slug: "hitl",
    titre: "Human-in-the-Loop",
    desc: "Philippe demande une approbation avant d'agir — l'humain garde le contrôle.",
    accent: "#f59e0b",
  },
  {
    num: "04",
    slug: "textarea",
    titre: "CopilotTextarea",
    desc: "Autocomplétion IA dans un champ texte — Cmd+K pour suggestions, Tab pour accepter.",
    accent: "#a78bfa",
  },
  {
    num: "05",
    slug: "genui",
    titre: "Generative UI",
    desc: "Philippe génère des cartes visuelles directement dans le chat — disponible sur la page principale.",
    accent: "#fb923c",
    readOnly: true,
  },
];

function SectionPilier({ pilier, children }) {
  return (
    <section
      style={{
        marginBottom: 48,
        paddingBottom: 48,
        borderBottom: "1px solid #1e293b",
      }}
    >
      {/* En-tête section */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: `${pilier.accent}22`,
            border: `1px solid ${pilier.accent}55`,
            borderRadius: 10,
            padding: "8px 14px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: pilier.accent,
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "monospace",
              letterSpacing: 1,
            }}
          >
            {pilier.num}
          </span>
        </div>
        <div>
          <h2
            style={{
              margin: "0 0 6px",
              fontSize: 18,
              fontWeight: 700,
              color: "#f1f5f9",
            }}
          >
            {pilier.titre}
          </h2>
          <p
            style={{
              margin: 0,
              color: "#94a3b8",
              fontSize: 13,
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            {pilier.desc}
          </p>
        </div>
      </div>

      {/* Contenu */}
      {children}
    </section>
  );
}

function GenUIReadOnly() {
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #fb923c33",
        borderLeft: "4px solid #fb923c",
        borderRadius: 10,
        padding: "18px 22px",
        maxWidth: 520,
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            background: "#fb923c22",
            border: "1px solid #fb923c55",
            color: "#fb923c",
            borderRadius: 6,
            padding: "2px 10px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Acquis
        </span>
        <span style={{ fontWeight: 700, color: "#f1f5f9" }}>
          Generative UI — afficher_carte
        </span>
      </div>
      <p style={{ margin: "0 0 12px", color: "#94a3b8", lineHeight: 1.6 }}>
        Philippe peut générer des{" "}
        <strong style={{ color: "#fb923c" }}>cartes visuelles structurées</strong> directement
        dans le chat via <code style={{ fontFamily: "monospace", color: "#fb923c" }}>useCopilotAction</code>{" "}
        avec <code style={{ fontFamily: "monospace", color: "#fb923c" }}>available: &quot;frontend&quot;</code> et
        un <code style={{ fontFamily: "monospace", color: "#fb923c" }}>render</code> sans handler.
      </p>
      <div
        style={{
          background: "#1e293b",
          borderRadius: 8,
          padding: "10px 14px",
          color: "#94a3b8",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        Essaie sur la page principale /{" "}
        <span style={{ color: "#fb923c", fontWeight: 600 }}>
          &ldquo;montre-moi une carte de démo avec 3 lignes&rdquo;
        </span>
      </div>
    </div>
  );
}

export default function DemoUI() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit-demo">
      {/* Catch-all render — rend les tool-calls reels de Hermes comme cartes */}
      <PilierToolRender />
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(160deg,#0a0f1e 0%,#0f172a 60%,#1e293b 100%)",
          color: "#e2e8f0",
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <header
          style={{
            borderBottom: "1px solid #1e293b",
            padding: "24px 40px",
            background: "#0a0f1e",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#f1f5f9",
                }}
              >
                Demo CopilotKit x Hermes — MECG
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                5 piliers d&apos;intégration · Mécanique Gicleurs · CopilotKit 1.60.1
              </p>
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {PILIERS.map((p) => (
                <span
                  key={p.slug}
                  style={{
                    background: `${p.accent}18`,
                    border: `1px solid ${p.accent}44`,
                    color: p.accent,
                    borderRadius: 20,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {p.num}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Intro */}
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "40px 40px 0",
          }}
        >
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: "20px 24px",
              marginBottom: 48,
            }}
          >
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 14,
                color: "#e2e8f0",
                fontWeight: 600,
              }}
            >
              Démonstration des 5 piliers CopilotKit intégrés à l&apos;agent Hermes (Philippe)
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
              Chaque section ci-dessous illustre un pilier d&apos;intégration CopilotKit. Le bouton de chat
              (bas droite) est Philippe — ton assistant IA MECG. Interagis avec lui pour déclencher les
              démonstrations en temps réel.
            </p>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {[
                "useCopilotReadable",
                "useCopilotAction",
                "renderAndWaitForResponse",
                "CopilotTextarea",
                "Generative UI",
              ].map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    padding: "2px 10px",
                    fontSize: 11,
                    color: "#64748b",
                    fontFamily: "monospace",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Pilier 01 — Readable */}
          <SectionPilier pilier={PILIERS[0]}>
            <PilierReadable />
          </SectionPilier>

          {/* Pilier 02 — Action */}
          <SectionPilier pilier={PILIERS[1]}>
            <PilierAction />
          </SectionPilier>

          {/* Pilier 03 — HITL */}
          <SectionPilier pilier={PILIERS[2]}>
            <PilierHITL />
          </SectionPilier>

          {/* Pilier 04 — Textarea */}
          <SectionPilier pilier={PILIERS[3]}>
            <PilierTextarea />
          </SectionPilier>

          {/* Pilier 05 — Generative UI (read-only, déjà sur /) */}
          <SectionPilier pilier={PILIERS[4]}>
            <GenUIReadOnly />
          </SectionPilier>

          {/* Footer */}
          <footer
            style={{
              padding: "32px 0 48px",
              textAlign: "center",
              color: "#334155",
              fontSize: 12,
            }}
          >
            CopilotKit 1.60.1 · Hermes Agent · Mécanique Gicleurs
          </footer>
        </div>

        {/* Chat popup Philippe */}
        <CopilotPopup
          instructions="Tu es Philippe en MODE DÉMONSTRATION CopilotKit pour Mécanique Gicleurs. Tu parles à Justin Lacerte. Cette page démontre les piliers AG-UI via des OUTILS FRONTEND. RÈGLES STRICTES — tu DOIS utiliser les outils frontend, JAMAIS tes outils Zoho internes sur cette page:

• FACTURES: dès qu'on te demande d'ouvrir, afficher, voir ou consulter une facture, appelle IMMÉDIATEMENT l'outil frontend `ouvrir_facture` avec le numéro mentionné (ex: FAC-1042). NE CHERCHE RIEN dans Zoho, n'utilise aucun outil Zoho — appelle DIRECTEMENT `ouvrir_facture`. Si tu connais le client/montant, passe-les; sinon passe juste le numéro, le panneau complétera.

• CHANGER STATUT: si on demande de changer le statut d'une facture, appelle `changer_statut_facture`.

• RELANCES: dès qu'on parle d'envoyer une relance, un rappel ou une mise en demeure de paiement, appelle IMMÉDIATEMENT l'outil frontend `confirmer_relance` avec le client et le montant pour demander l'approbation humaine. N'ENVOIE JAMAIS de courriel, n'utilise AUCUN outil Zoho — appelle DIRECTEMENT `confirmer_relance` et attends la décision.

• CONTEXTE: tu peux lire le client sélectionné dans la page via le contexte (useCopilotReadable). Si on te demande quel client est sélectionné, réponds d'après ce contexte.

Réponds en français, ton direct. Appelle l'outil frontend EN PREMIER, explique ensuite brièvement."
          labels={{
            title: "Philippe — Demo CopilotKit",
            initial:
              "Salut Justin ! Voici la démo des 5 piliers. Essaie : « Ouvre la facture FAC-1042 » ou « Envoie une relance à Deslauriers pour 3 480,00 $ »",
            placeholder: "Interagis avec les piliers…",
          }}
        />
      </div>
    </CopilotKit>
  );
}
