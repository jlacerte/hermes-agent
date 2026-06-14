# Démo 5 piliers AG-UI (CopilotKit) — copilot-ui

État final **2026-06-12** : **les 5 piliers PASS**, prouvés au harnais ET vus à l'œil sur screenshot.
Commits : `af4f074` (5 piliers) · `e23f479` (client/montant optionnels) · fix Slate mobile.

URL démo : `http://10.0.0.1:8083/demo`

---

## Architecture — pourquoi une route démo isolée

Hermès (port 8642) est un **agent souverain** : il a ses propres outils Zoho et son prompt
système. Quand on lui offre une action frontend mock (« ouvre la facture »), il fait le **vrai
travail Zoho** (cherche/télécharge) et **ignore** l'action frontend. C'est correct — c'est un vrai
agent. Mais ça empêche de piloter les piliers « Frontend Action » et « HITL » depuis l'UI.

**Solution** : route isolée `/api/copilotkit-demo` branchée sur un **modèle neutre `gpt-4o-mini`**
(clé `DEMO_OPENAI_API_KEY`). Sans outils Zoho, le modèle **appelle vraiment** les actions
frontend → les 5 piliers se déclenchent. **Hermès prod reste 100 % intact.**

---

## Les 5 piliers — état vérifié

| Pilier | Mécanisme | État | Preuve |
|--------|-----------|------|--------|
| P1 useCopilotReadable | contexte client lu par le modèle | PASS | répond « Deslauriers » |
| P2 Frontend Action | `ouvrir_facture` → panneau rempli | PASS | panneau FAC-1042 / 3 480 $ |
| P3 Human-in-the-Loop | carte Approuver/Refuser → `respond()` | PASS | clic → état « Traité » |
| P4 CopilotTextarea | autosuggestion via `/api/autosuggest` | PASS | suggestions réelles 38-74 car |
| P5 Generative UI | render de tool-call en carte | PASS | carte rendue dans le chat |

### P2 — piège réglé
`client` et `montant` étaient `required`. `gpt-4o-mini` (sans Zoho) ne connaît pas le client →
refusait d'appeler l'outil (« pas de client sélectionné »). **Fix** : rendus optionnels, le numéro
de facture suffit, le handler complète depuis les données démo.

### P4 — BUG DU PACKAGE (cause racine)
`@copilotkit/react-textarea@1.60.1` **ship un build cassé** : la fonction d'autosuggestion interne
construit les messages puis les jette — `const response = {}` codé en dur → retourne **toujours
`""`**, sans aucun appel réseau. De plus `CopilotTextarea` **écrase** `apiConfig`, empêchant tout
override.
**Contournement** : bascule sur `BaseCopilotTextarea` + fonction `autosuggestionsFunction` custom
qui appelle notre route `/api/autosuggest` (OpenAI direct). Suggestions réelles confirmées.

### Erreur Slate mobile
`Cannot resolve a DOM point from Slate point` sur Android (IME bouge le curseur pendant que la
suggestion revient). Réglé par un **error boundary** autour du widget — l'erreur transitoire est
rattrapée, le texte préservé, plus de page blanche.

---

## Tester — le harnais

```bash
NODE_PATH=/tmp/copilot-debug/node_modules node scripts/headless-piliers.js
```

Le harnais parle vraiment à Philippe, capture une preuve par pilier + un screenshot
(`/tmp/copilot-debug/piliers.png`). Exit 0 = 5 piliers PASS.

## ⚠️ RÈGLE D'OR — voir avec les yeux

Un `status 200` serveur **ne prouve PAS** le rendu navigateur. Leçon prouvée : les logs étaient
verts pendant que l'écran de Justin affichait « pas de client sélectionné ».

**Conclusion obligatoire de tout test : OUVRIR le PNG avec l'outil `Read` et REGARDER.**
Ne jamais conclure « ça marche » sur les seuls logs. Le harnais imprime un rappel final + le chemin
du screenshot — il faut le lire à l'œil avant de déclarer un pilier fonctionnel.
