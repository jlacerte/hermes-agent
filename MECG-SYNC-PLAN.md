# Plan de sync upstream Hermès (NousResearch) — Suivi MECG

> Fichier de suivi vivant. Sync du fork `jlacerte/hermes-agent` (branche `main`, prod)
> sur l'upstream `NousResearch/hermes-agent`. Mettre à jour la checklist à chaque sync.

**Dernière analyse : 2026-07-02** — par Octopode (session Slack)

> ## ✅ BASCULE PROD FAITE — 2026-07-03 10:13 EDT
> - `main` fast-forward → `ce82f35545` (merge des 2891 commits) + fix `3e7cdbe526`.
> - `pip install -e .` → **hermes-agent 0.18.0** (deps bumpées : PyJWT, certifi, urllib3, packaging).
> - Restart `hermes-gateway` → **actif, NRestarts=0**, ports **8642 + 8643** servis, `/ag-ui/info`=401 (vivant, auth-gaté).
> - **Régression rencontrée + corrigée** : upstream v0.18 appelle `adapter.connect(is_reconnect=…)`; `AGUIAdapter.connect()` ne l'acceptait pas → 8643 down. Fix = signature `connect(self, *, is_reconnect=False)` (commit `3e7cdbe526`).
> - **Rollback dispo** : `git reset --hard mecg-pre-sync-2026-07-02 && venv/bin/python -m pip install -e . && sudo systemctl restart hermes-gateway`.
> - **Suivi à faire (non bloquant)** : WARNING `TimeoutStopSec=90s < drain_timeout=180s` → au prochain restart systemd peut SIGKILL en plein drain. Corriger via `hermes gateway install --force` ou raccourcir `agent.restart_drain_timeout`.
> - **À pousser** : `git push fork main` + push du tag `mecg-pre-sync-2026-07-02` (fait localement seulement).

---

## 1. État des lieux (2026-07-02)

| Élément | Valeur |
|---------|--------|
| Remote upstream | `origin` = `git@github.com:NousResearch/hermes-agent.git` |
| Remote fork MECG | `fork` = `github.com/jlacerte/hermes-agent.git` |
| Branche prod | `main` (service `hermes-gateway.service`, workdir `/mnt/mc-database/hermes-home`) |
| Dernier ancêtre commun | `ce99a81123` — **2026-06-11** |
| Dernier tag de rollback | `mecg-pre-sync-2026-06-22` (on était *behind 1190*) |
| **Nouvelle màj upstream** | tag **`v2026.7.1`**, tête `6cffc37b5a` |
| **Divergence actuelle** | upstream **+2851 commits** / MECG **+23 commits** |

Prod tourne **derrière de 2851 commits**. Gros retard : Nous Research est très actif
(desktop, terminal, gateway, api-server, mémoire, sécurité).

---

## 2. La recette MECG (ce qui marche — à préserver)

1. **Tag de rollback** avant chaque sync : `mecg-pre-sync-YYYY-MM-DD` (point de retour sûr).
2. **Découplage en plugins isolés** : les customisations vivent dans des dossiers
   *additifs* qui n'existent pas upstream → **zéro conflit**.

### Surface MECG (23 commits) classée par risque

🟢 **ADDITIF / isolé — ne conflicte PAS** (la recette fonctionne ici)
- `plugins/phone/` — outil `appeler_telephone` (Hermès décide d'appeler). Nouveau plugin.
- `plugins/platforms/mecg_agui/` — bridge AG-UI CopilotKit V2 relocalisé (`adapter.py`, 767 l). Nouveau plugin.
- `frontend/` — copilot-ui complet (monorepo UI). ~18 000 lignes, dossier neuf.

🔴 **PATCHE DU CŒUR — conflit garanti au sync** (le « costaud »)
- `gateway/platforms/api_server.py` — **746 l MECG** vs **+686/−110 upstream (22 commits)**. ⚠️ point chaud #1.
- `gateway/platforms/email.py` — 39 l MECG vs 6 commits upstream. Sujet courriel paramétrable.
- `toolsets.py` (4 l) + `tools/send_message_tool.py` (14 l) vs 10 & 12 commits upstream.

🟡 **FIX GEMINI — probablement déjà natifs upstream (à ABANDONNER au sync)**
- MECG `fix(sanitize): repair concatenated parallel tool_call args (Gemini)`
  → upstream `0cebf994c9 fix(agent): repair empty-name tool_calls in sanitizer`
- MECG `Fix Gemini streaming multiple tool calls bug`
  → upstream `032d702140 fix(agent): omit stream_options for native Gemini streaming`
  + `936af2f4f5 Merge consecutive same-role contents for native Gemini`
- Branches liées : `mecg-gemini-fixes`, `sync-v2-gemini`.

---

## 3. Opportunités apportées par cette màj (upstream fait maintenant le travail)

Plusieurs besoins MECG sont peut-être couverts nativement → **réduire notre code**:
- `4a09b692ec feat(api-server): per-client model routing via model_routes`
- `b98baa3039 feat(config): extra HTTP headers for LLM API calls`
- `c73e74386b feat(vertex): add Google Vertex AI provider for Gemini (OAuth2)` (pertinent pour fallback Gemini)
- Durcissements api-server : auth `/health/detailed`, redaction erreurs, cap runs concurrents anti-DoS, scope approvals par run id.

---

## 4. Stratégie de sync recommandée

**Objectif : réduire la surface rouge AVANT de merger, pour minimiser les conflits.**

### Étape 0 — Filet de sécurité
- [ ] Sauvegarder `.env` / `~/.hermes/`. Noter version prod actuelle.
- [ ] `git tag mecg-pre-sync-2026-07-02 main` (rollback).
- [ ] Confirmer que prod (`main`) est propre (`git status`).

### Étape 1 — Réduire le rouge (préparation, hors prod) ✅ FAIT 2026-07-02
> Rapport détaillé : `MECG-SYNC-ETAPE1-FINDINGS.md`
- [x] **Gemini** : `47a1140df9` (sanitize concat) → **DROP** (delta net vide, déjà auto-réverté ;
      3 tests orphelins échouent sur `main` → à supprimer au sync). `25c594f31e` (multi tool-calls,
      mécanisme `generation` dans `gemini_native_adapter.py`) → **GARDER** (non couvert upstream).
- [x] **api_server.py** : **732 l MECG = 100 % pont AG-UI, 0 ligne métier irréductible**.
      ~416 l = pont `/ag-ui/*` déjà dupliqué dans le plugin `mecg_agui` (SUPPRIMABLE) mais prod le sert
      encore sur **port 8642** (frontend `route.js` pas repointé). ~316 l = passthrough `/v1/*` (PORTER/DROP).
      Cible 0 résiduel atteignable APRÈS : finir migration plugin (enable + repoint frontend) + confirmer abandon `/v1/*`.
- [x] **email / toolsets / send_message** : **3× GARDER** (~57 l, additifs, rétrocompatibles).
      Upstream `model_routes`/extra headers/Vertex = routing LLM, orthogonal → ne remplace pas nos patches.

### Étape 1.5 — Migration pont AG-UI vers plugin ✅ DÉJÀ LIVE (constaté 2026-07-02)
> **Révision majeure** : contrairement à ce que supposaient §3.1 des findings, la migration
> est **déjà faite et en prod** (amorcée le 25 juin, vérifiée live le 2 juillet).
- [x] `MECG_AGUI_ENABLED=true` + plugin actif sur **8643** (`hermes-home/.env:487-490`), in-process (même PID que le gateway).
- [x] Frontend repointé : `frontend/.env.local:1` = `http://10.0.0.1:8643/v1` → `/ag-ui` du **plugin** (pas 8642).
- [x] `copilot-ui` (next, port 8083) redémarré le 25 juin → charge le 8643. `GET /api/copilotkit/info` = 200 via plugin.
- [x] Backups de rollback conservés : `frontend/.env.local.bak-agui-*` (8642), `hermes-home/.env.bak-agui-*`.
- [ ] **RESTE** : (a) validation fonctionnelle bout-en-bout via harnais headless (piliers/carte/B3) ;
      (b) audit consommateurs `/v1/*` (surtout hermes-voice sur 8642) ; (c) suppression du bloc core.
- ⚠️ **Couplage à traiter ensemble** : `_agui_normalize_tools` (bloc A, `api_server.py:3389`) est **aussi
      appelé par le passthrough `/v1/responses`**. Supprimer le bloc A `/ag-ui/*` (3380-3794) + routes (4913-4916)
      SANS retirer/ajuster le passthrough `/v1/*` (~316 l) casserait `/v1/responses`. → un seul chantier.

### Étape 2 — Sync dans une branche jetable
- [ ] `git switch -c sync-2026-07-02 main`
- [ ] `git merge origin/main` (ou rebase des seuls patches survivants).
- [ ] Résoudre les conflits — concentrés sur `api_server.py`.

### Étape 3 — Validation AVANT bascule prod
- [ ] Lancer le gateway sur la branche sync (port/env de test, PAS prod).
- [ ] Harnais headless existants : `frontend/scripts/headless-piliers-prod.js`,
      `headless-carte-prod.js`, `headless-b3-approve.js`/`refuse.js` (gate afficher_carte, HITL).
- [ ] Test bout-en-bout AG-UI (CopilotKit) + `send_message` + plugin phone.
- [ ] **Ne pas casser Philippe / hermes-voice** (services séparés — vérifier quand même l'API `localhost:8642`).

### Étape 4 — Bascule + suivi
- [ ] Fast-forward `main` ← `sync-2026-07-02`.
- [ ] `sudo systemctl restart hermes-gateway` + vérifier logs.
- [ ] Push `fork main`. Mettre à jour ce fichier (section 1 + journal §6).

---

## 5. Points de vigilance

- ⚠️ `api_server.py` = **le** point de douleur. Tout le travail de découplage vise à le vider.
- ⚠️ 2851 commits = possibles **breaking changes** structurels (renommages, déplacements de
  modules) qui cassent nos plugins même « isolés ». Valider les *imports* des plugins après merge.
- ⚠️ Ne jamais tester sur le service prod `hermes-gateway` directement (workdir `hermes-home`).
- ⚠️ Frontend `copilot-ui` : `package-lock.json` (12 680 l) → risque de conflit npm, régénérable.

---

## 6. Journal des syncs

| Date | Avant (behind) | Après | Tag rollback | Notes |
|------|----------------|-------|--------------|-------|
| 2026-06-22 | 1190 | — | `mecg-pre-sync-2026-06-22` | 19 patches MECG |
| 2026-07-02 | 2851 | *(à faire)* | *(à créer)* | Analyse + plan. Cible v2026.7.1 |
