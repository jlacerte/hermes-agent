# Plan complet — Coexistence Hermès upstream ↔ copilot-ui MECG

> **Objectif** : pouvoir prendre les mises à jour de `NousResearch/hermes-agent`
> (upstream très actif) à volonté, SANS jamais casser le copilot-ui CopilotKit
> (http://10.0.0.1:8083) ni les customisations MECG.
>
> **Créé** : 2026-07-23 · Archon projet Hermès `164018b3`
> Complète `MECG-SYNC-PLAN.md` (procédure de sync) — ce fichier-ci = stratégie de découplage durable.

---

## 1. Diagnostic (2026-07-23)

| Élément | Valeur |
|---------|--------|
| Upstream | `origin` = github.com/NousResearch/hermes-agent |
| Fork prod | `fork` = github.com/jlacerte/hermes-agent, branche `main` |
| Divergence | **behind 1024** / ahead 29 (MECG) |
| Dernier sync réussi | 2026-07-03 (2891 commits mergés, v0.18, recette prouvée) |

### Pourquoi ça conflicte

Les 29 commits MECG se classent en 3 zones :

🟢 **Additif — zéro conflit possible** (~18 700 lignes)
- `frontend/` — copilot-ui complet (Next.js, port 8083). N'existe pas upstream.
- `plugins/platforms/mecg_agui/` — bridge AG-UI CopilotKit (adapter 771 l., port 8643). N'existe pas upstream.
- `plugins/phone/` — outil `appeler_telephone`.

🔴 **Patch du cœur — conflit garanti à chaque sync**
- `gateway/platforms/api_server.py` — **~732 lignes MECG** dans un fichier
  qu'upstream modifie constamment. **C'est LE problème.**
  - Bloc A : pont `/ag-ui/*` (~416 l., lignes ~3380-3794 + routes ~4913-4916)
    → **déjà dupliqué** dans le plugin `mecg_agui`, qui est **déjà en prod** (8643).
  - Bloc B : passthrough `/v1/*` (~316 l.) → utilisé par le fix CopilotKit
    (`available:"enabled"` + passthrough tools, cf. mémoire copilot-ui).
  - ⚠️ Couplage : `_agui_normalize_tools` (bloc A) est appelé par `/v1/responses`
    (bloc B). Les deux blocs = un seul chantier.

🟡 **Petits patchs tolérés** (~57 l., rétrocompatibles, conflits triviaux)
- `plugins/platforms/email/adapter.py` (sujet paramétrable), `toolsets.py`,
  `tools/send_message_tool.py`, `hermes_cli/send_cmd.py`,
  `agent/gemini_native_adapter.py` (mécanisme `generation`, non couvert upstream).

---

## 2. Architecture cible

```
NousResearch/hermes-agent (upstream, intact)
        │  merge périodique — AUCUN conflit structurel
        ▼
jlacerte/hermes-agent (fork)
├── cœur upstream            ← 0 ligne MECG dans api_server.py (cible)
├── plugins/platforms/mecg_agui/   ← pont AG-UI + passthrough /v1 (TOUT le custom serveur)
├── plugins/phone/
├── frontend/                ← copilot-ui (100 % MECG, jamais touché par upstream)
└── ~57 l. de micro-patchs assumés (email/toolsets/send/gemini)
```

**Règle d'or permanente** : toute nouvelle feature MECG va dans un plugin ou
`frontend/`. On ne modifie JAMAIS un fichier upstream sauf micro-patch documenté ici.

---

## 3. Phase A — Vider `api_server.py` (le chantier structurel, une fois)

> Résout définitivement le conflit. ~1 session de travail. Prod non touchée avant l'étape A6.

- [ ] **A1. Audit des consommateurs `/v1/*` sur 8642**
      - `grep 8642` dans hermes-home, systemd, nginx, frontend, hermes-voice/Philippe.
      - Livrable : liste exhaustive de qui appelle encore 8642 (le frontend est déjà
        repointé sur 8643 depuis le 25 juin — vérifier `frontend/.env.local`).
- [ ] **A2. Porter le passthrough `/v1/*` (bloc B) dans le plugin `mecg_agui`**
      - Déplacer `_agui_normalize_tools` + `/v1/responses` (forme plate→nested,
        `available:"enabled"`) dans `plugins/platforms/mecg_agui/adapter.py`.
      - Exposer sur 8643. Le fix CopilotKit cesse d'être « FRAGILE, écrasé à l'upgrade ».
- [ ] **A3. Repointer les consommateurs restants** (trouvés en A1) de 8642 → 8643.
- [ ] **A4. Supprimer les blocs A+B de `api_server.py`** → diff cœur ≈ 0.
- [ ] **A5. Validation hors prod** : gateway sur port/env de test, puis harnais
      headless : `frontend/scripts/headless-piliers-prod.js`, `headless-carte-prod.js`,
      `headless-b3-approve.js` / `headless-b3-refuse.js` + un tour `/v1/responses`.
- [ ] **A6. Bascule** : commit, restart `hermes-gateway`, re-run harnais, push fork.
- [ ] **A7. Rollback prêt** : tag `mecg-pre-decouplage-YYYY-MM-DD` avant A4.

## 4. Phase B — Sync de rattrapage (behind 1024)

> Recette éprouvée le 2026-07-03 (détail : `MECG-SYNC-PLAN.md` §4). Faire APRÈS la Phase A
> pour un merge quasi sans conflit.

- [ ] B1. Filet : backup `.env` + `hermes-home`, tag `mecg-pre-sync-YYYY-MM-DD`, `git status` propre.
- [ ] B2. `git fetch origin` puis branche jetable : `git switch -c sync-YYYY-MM-DD main` → `git merge origin/main`.
- [ ] B3. Conflits attendus : quasi rien (micro-patchs 🟡, `package-lock.json` → régénérer).
- [ ] B4. `pip install -e .` dans le venv, vérifier les **imports des plugins**
      (upstream peut renommer des modules — cf. incident `is_reconnect` v0.18).
- [ ] B5. Validation hors prod : harnais headless complets + `send_message` + plugin phone.
- [ ] B6. Bascule : ff `main`, restart `hermes-gateway`, vérifier logs + NRestarts=0, push fork + tag.
- [ ] B7. Journal : mettre à jour `MECG-SYNC-PLAN.md` §6.

## 5. Phase C — Régime permanent

- **Cadence** : sync mensuel (ou à chaque release upstream taguée), ~30 min :
  tag rollback → merge → harnais headless → restart → push. Candidat : tâche Archon
  récurrente exécutée par le Concierge, avec toi en validation avant bascule.
- **Garde-fous** :
  1. Jamais de code MECG dans un fichier upstream (sauf liste 🟡 documentée ici).
  2. Tout ajout serveur → plugin. Tout ajout UI → `frontend/`.
  3. Avant chaque sync : relire ce fichier + `MECG-SYNC-PLAN.md`.
  4. Rollback toujours dispo : `git reset --hard <tag> && pip install -e . && sudo systemctl restart hermes-gateway`.
- **Suivi micro-patchs 🟡** : à chaque sync, vérifier si upstream couvre désormais le besoin
  (ex. sujet email paramétrable, fixes Gemini) → si oui, DROP le patch. Cible : 0.

## 6. Points de vigilance

- ⚠️ Ne jamais tester sur le service prod `hermes-gateway` (workdir `/mnt/mc-database/hermes-home`).
- ⚠️ `hermes-voice` / Philippe : vérifier 8642 avant de supprimer quoi que ce soit (A1).
- ⚠️ Warning systemd connu : `TimeoutStopSec=90s < drain_timeout=180s` → corriger à l'occasion.
- ⚠️ `frontend/package-lock.json` : conflit npm probable → régénérer, ne pas résoudre à la main.
- ⚠️ Après tout sync : `SOUL.md`/`config.yaml` vivent dans `hermes-home` (repo `hermes-config`), non touchés par le sync du code — mais restart requis pour `.env`/`config.yaml`.
