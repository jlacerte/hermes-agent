// Route d'autosuggestion DEMO — contourne le bug de @copilotkit/react-textarea@1.60.1
// dont la fonction d'autosuggestion interne ne fait AUCUN appel reseau
// (`const response = {}` code en dur dans le bundle -> retourne toujours "").
// Ici: appel direct OpenAI -> complete le texte au curseur. Modele neutre, pas d'outils Zoho.
import OpenAI from "openai";
import { logInfo, logError } from "@/app/lib/logger";
import { DEMO_ENABLED, demoDisabledResponse } from "@/app/lib/demo-gate";

const DEMO_MODEL = process.env.DEMO_MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.DEMO_OPENAI_API_KEY || "missing-key" });

export const POST = async (req) => {
  if (!DEMO_ENABLED) return demoDisabledResponse();
  const requestId = crypto.randomUUID().slice(0, 8);
  const t0 = performance.now();
  try {
    const { textBeforeCursor = "", textAfterCursor = "", purpose = "" } = await req.json();
    logInfo("autosuggest", "requete entrante", { requestId, model: DEMO_MODEL, len: textBeforeCursor.length });

    const completion = await openai.chat.completions.create({
      model: DEMO_MODEL,
      temperature: 0.3,
      max_tokens: 60,
      messages: [
        {
          role: "system",
          content:
            `Tu es un assistant d'ecriture. L'utilisateur redige un texte. ` +
            `Objectif: ${purpose}\n` +
            `Devine la SUITE immediate du texte (1 phrase courte max). ` +
            `Reponds UNIQUEMENT par la continuation, sans guillemets, sans repeter le texte deja ecrit. ` +
            `Si rien de pertinent, reponds une suite naturelle plausible.`,
        },
        { role: "user", content: `<TexteApresCurseur>${textAfterCursor}</TexteApresCurseur>` },
        { role: "user", content: `<TexteAvantCurseur>${textBeforeCursor}</TexteAvantCurseur>` },
      ],
    });

    const suggestion = completion.choices?.[0]?.message?.content?.trim() || "";
    const latencyMs = Math.round(performance.now() - t0);
    logInfo("autosuggest", "requete completee", { requestId, latencyMs, sugLen: suggestion.length });
    return Response.json({ suggestion, requestId });
  } catch (err) {
    const latencyMs = Math.round(performance.now() - t0);
    logError("autosuggest", "erreur", { requestId, latencyMs, error: err?.message });
    return Response.json({ suggestion: "", error: err?.message, requestId }, { status: 502 });
  }
};
