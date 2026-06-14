// Gating de la démo en prod (A8, doc 7f16373c §A8).
// La page /demo et ses routes API (copilotkit-demo, autosuggest) tournent sur
// gpt-4o-mini via une clé OpenAI EXTERNE (DEMO_OPENAI_API_KEY) -> coût + exposition.
// En production elles sont DÉSACTIVÉES par défaut; activer explicitement avec
// ENABLE_DEMO=true dans l'environnement du service copilot-ui.
export const DEMO_ENABLED = process.env.ENABLE_DEMO === "true";

// Réponse 403 standard pour les routes API démo quand la démo est gatée.
export function demoDisabledResponse() {
  return Response.json(
    { error: "Démo désactivée en production (ENABLE_DEMO non défini)." },
    { status: 403 }
  );
}
