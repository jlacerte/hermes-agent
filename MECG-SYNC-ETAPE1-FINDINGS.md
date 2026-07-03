# Étape 1 « Réduire le rouge » — Findings

> Analyse read-only, 2026-07-02. Base : `main` (prod) vs upstream `origin/main`.
> Ancêtre commun (`git merge-base main origin/main`) = **`ce99a81123`** (2026-06-11).
> Cible upstream : tag `v2026.7.1` (`6cffc37b5a`). 23 commits MECG au-dessus de la base.
> Note : `git fetch origin --tags` a avancé `origin/main` à `5a6720b884` (au-delà de v2026.7.1). Sans impact sur les verdicts.

---

## 1. Résumé exécutif

- **Volet A (Gemini)** : le patch sanitize est **déjà mort** (auto-réverté), on le DROP ; le patch adapter (multi tool-calls) n'est **pas** couvert upstream, on le GARDE. 3 tests orphelins échouent aujourd'hui sur `main` (à supprimer au sync).
- **Volet B (`api_server.py`)** : **732 lignes ajoutées, 100 % pont AG-UI, 0 ligne de logique métier irréductible.** ~416 l = pont `/ag-ui/*` **déjà dupliqué** dans le plugin `mecg_agui` (supprimable une fois la migration finie) ; ~316 l = passthrough intérimaire sur `/v1/*` (portable/droppable). **Cible 0 résiduel atteignable.**
- **Volet C (email/toolsets/send_message)** : upstream (`model_routes`, extra headers, Vertex) est **orthogonal** (routing LLM, pas sujet courriel). On GARDE les 3 patches (petits, additifs, rétrocompatibles).

| Patch / fichier | SHA MECG | Verdict |
|---|---|---|
| `fix(sanitize): repair concatenated ... args` | `47a1140df9` | **DROP** (net-zéro, réverté par `25c594f31e`) |
| — ses 3 tests `test_repair_tool_call_arguments.py` | `47a1140df9` | **DROP** (échouent sur `main` aujourd'hui) |
| `Fix Gemini streaming multiple tool calls` (adapter) | `25c594f31e` | **GARDER** (non couvert upstream) |
| `api_server.py` — pont `/ag-ui/*` (~416 l) | bloc A9.1→relocate | **SUPPRIMABLE** (dupliqué dans plugin `mecg_agui`) |
| `api_server.py` — passthrough `/v1/*` (~316 l) | bloc A9.1/A9.3 | **PORTER/DROP** (intérimaire, pas dans le plugin) |
| `api_server.py` — logique métier core | — | **0 ligne** (rien d'irréductible) |
| `gateway/platforms/email.py` (`_parse_subject_and_body`, 39 l) | `6c4cb51564` | **GARDER** |
| `toolsets.py` (send_message dans hermes-api-server, 4 l) | `1bb488579a` | **GARDER** |
| `tools/send_message_tool.py` (param `subject`, 14 l) | `7c3d98458b` | **GARDER** |

---

## 2. Volet A — Patches Gemini

### A.1 — `fix(sanitize): repair concatenated parallel tool_call args` (`47a1140df9`) → **DROP**

Ce patch ajoutait une « repair pass 0b » dans `agent/message_sanitization.py::_repair_tool_call_arguments` (décoder le 1er objet JSON quand Gemini concatène `{"search":"a"}{"search":"b"}`), + 3 tests.

**Il est déjà auto-annulé.** Le patch suivant `25c594f31e` (4 h plus tard, même jour) **retire** intégralement la repair pass 0b et déplace la solution dans l'adapter. Preuve :

```
git diff ce99a81123 main -- agent/message_sanitization.py   →  (VIDE)
```

Le delta net MECG sur `message_sanitization.py` est **nul** : `main` == base. Rien à porter au sync.

**Upstream ne couvre pas ce cas précis** (et n'a pas à le faire) :
- `0cebf994c9 fix(agent): repair empty-name tool_calls in sanitizer` traite un **autre** bug (nom d'outil vide → Responses 400), pas les args concaténés.
- Seul autre commit upstream sur ce fichier : `2d286a6d00` (close tool-call sequence on interrupt) — sans rapport.

**⚠️ Tests orphelins — action requise.** Le patch 2 a réverté la source mais **pas** les 3 tests. Ils testent un comportement qui n'existe plus et **échouent sur `main` aujourd'hui** (vérifié) :

```
pytest tests/run_agent/test_repair_tool_call_arguments.py -k concatenated -o addopts=""
→ 3 failed
  test_concatenated_objects_keeps_first / _with_limit_keeps_first / _not_dropped_to_empty
  (log: "Unrepairable tool_call arguments ... replaced with empty object")
```

Ces 3 tests n'existent pas upstream (le fichier `tests/run_agent/test_repair_tool_call_arguments.py` existe upstream, blob `dcd98b5acf`, sans ces cas). **Les supprimer au sync** — ils encodent l'ancienne approche abandonnée.

### A.2 — `Fix Gemini streaming multiple tool calls bug` (`25c594f31e`) → **GARDER**

C'est le fix **vivant**. Delta net MECG concentré dans `agent/gemini_native_adapter.py::translate_stream_event` : une boucle `while` avec compteur `generation` ajouté à la `call_key` pour distinguer plusieurs appels d'outil parallèles de même `name`/`part_index` (sinon ils écrasent le même slot `tool_call_indices`).

**Upstream ne couvre pas.** La fonction `translate_stream_event` existe upstream (`origin/main:agent/gemini_native_adapter.py`, lignes ~663-710) avec la **même** structure `call_key = {part_index, name, thought_signature}` + dédup `last_arguments`, **mais SANS** le champ `generation` ni la boucle `while`. Les commits upstream sur ce fichier ne touchent pas ce mécanisme :
- `936af2f4f5` Merge consecutive same-role contents
- `c8e5f34f24` strip native self prefixes
- `eed61a1251` add role field to systemInstruction
- `032d702140` omit stream_options for native Gemini (c'est un fix `stream_options`, endpoint natif — orthogonal)

**Verdict : GARDER.** Le point d'ancrage upstream (lignes ~686-710) est identique → réapplication propre ou micro-conflit sur le même bloc. C'est notre seul vrai patch Gemini survivant.

---

## 3. Volet B — `gateway/platforms/api_server.py`

**Delta MECG vs base : 732 lignes ajoutées (`git diff ce99a81123 main`).** Upstream a bougé **22 commits** sur ce fichier depuis la base (durcissements auth/redaction/DoS, `model_routes`, normalisation contenu, etc.) → conflit garanti.

**Constat central : 100 % du delta MECG est du pont AG-UI. Aucune ligne de logique métier MECG irréductible.** Chaque bloc ajouté porte un commentaire `AG-UI / Point X` ou `AG-UI passthrough`. Il n'y a **rien** de type « règle business Gicleurs » collé dans le core.

### Découpage par catégorie

| Cat. | Contenu | Lignes ~ | Verdict |
|---|---|---|---|
| **(1) Dupliqué dans le plugin** | Pont dédié `/ag-ui/*` : `_agui_normalize_tools`, `_handle_agui_info`, `_handle_agui_run`, `_write_sse_agui` (hunk `@@ -3103 +3377,422`) + enregistrement des 3 routes `/ag-ui/*` (hunk `@@ -4196`) | **~416** | **SUPPRIMABLE** (voir réserve ci-dessous) |
| **(2) Core MECG irréductible** | — | **0** | — |
| **(3) À porter/droper** | Passthrough client-tools sur `/v1/chat/completions` (capture `tools`, préservation `tool_calls`/`role=tool`, relais `finish_reason=tool_calls` + `interrupt`, suppression du chunk `stop`) + sur `/v1/responses` (normalisation flat-tool, round-trip HITL `function_call`/`function_call_output`) + injection `client_tools` dans `_run_agent` | **~316** | **PORTER EN PLUGIN ou DROP** |

### Réserve importante sur la catégorie (1)

Le pont `/ag-ui/*` **est** dupliqué dans `plugins/platforms/mecg_agui/adapter.py` (767 l, standalone, port dédié 8643, inerte sauf `MECG_AGUI_ENABLED`). Le commit de relocalisation `683df9fb37` le dit noir sur blanc : *« api_server.py toujours intact … Reste : repoint frontend route.js »*.

**Mais la migration n'est PAS finie — le core reste le chemin LIVE en prod :**
- `frontend/app/api/copilotkit/[...path]/route.js` proxy vers `HERMES_API_URL` (`http://10.0.0.1:8642/v1`) en remplaçant `/v1` → `/ag-ui`, donc **`:8642/ag-ui/*`** = les routes **de `api_server.py`**, pas le port **8643** du plugin.
- Donc supprimer les ~416 l maintenant **casserait la prod**.

**Pour rendre les ~416 l réellement supprimables** (→ retour upstream) :
1. `MECG_AGUI_ENABLED=true` + démarrer le plugin (port 8643).
2. Repointer `route.js` / `HERMES_API_URL` vers le port du plugin.
3. Valider (harnais headless `frontend/scripts/headless-*prod.js`, HITL B3, gate `afficher_carte`).
4. Alors supprimer le pont `/ag-ui/*` + ses 3 routes de `api_server.py`.

### Catégorie (3) — les ~316 lignes de passthrough `/v1/*`

- **Pas couvert par le plugin** (le plugin ne sert que `/ag-ui/*`, jamais `/v1/*`).
- C'était l'approche **intérimaire A9.1** (`47c5467510`, `aebbbd9841`, `3031920de3`), avant le pont AG-UI dédié. Le frontend actuel n'utilise plus `/v1/*` pour les actions client (il passe par `/ag-ui/*`).
- **Rétrocompatible** : quand `body["tools"]` est vide, le comportement `/v1/*` est identique à l'upstream (aucun impact sur les appels API normaux).
- **Recommandation** : confirmer qu'aucun consommateur `/v1/*` n'envoie encore de `tools` client (le frontend ne le fait plus) → alors **DROP** ; sinon, encapsuler dans un plugin/wrapper. La rétrocompat rend le DROP peu risqué.

### Chiffre clé Volet B

> **732 l MECG dans le core → 0 irréductible.** ~416 l déjà dupliquées (plugin), ~316 l intérimaires droppables. **Cible « 0 ligne MECG dans le core » = atteignable**, conditionnée à : finir la migration plugin (repoint frontend) + confirmer l'abandon du passthrough `/v1/*`.

---

## 4. Volet C — email / toolsets / send_message

Upstream a ajouté `model_routes` (`4a09b692ec`), extra HTTP headers (`b98baa3039`), Vertex AI Gemini (`c73e74386b`). **Tous concernent le routing/headers/provider des appels LLM — rien à voir avec le sujet courriel ou le toolset send_message.** Aucun ne remplace nos patches.

| Fichier | Patch MECG | Analyse | Verdict |
|---|---|---|---|
| `gateway/platforms/email.py` (+39/−12, `6c4cb51564`) | `_parse_subject_and_body(to_addr, body)` : si le body commence par `Subject:`, extraire un sujet explicite ; sinon comportement d'origine (`Re: <ctx>`). Appelé aux 3 sites d'envoi (reply/send). | Fonctionnalité produit MECG (sujet courriel paramétrable). Upstream ne touche pas la logique de sujet de `EmailAdapter`. Patch propre, localisé, rétrocompatible. | **GARDER** (candidat PR upstream ; pas droppable) |
| `toolsets.py` (+4/−2, `1bb488579a`) | Ajoute `"send_message"` au toolset `hermes-api-server` + description. | Choix de configuration MECG (le client API = cockpit de confiance → doit pouvoir envoyer via l'outil dédié). Upstream ne modifie pas ce toolset. | **GARDER** (idéalement porter en **config/override** de toolset plutôt que patch de `toolsets.py`) |
| `tools/send_message_tool.py` (+14, `7c3d98458b`/`6c4cb51564`) | Ajoute un param optionnel `subject` propagé `_handle_send → _send_to_platform → _send_email → msg["Subject"]`. Défaut inchangé (`Hermes Agent`). | Purement additif, rétrocompatible, orthogonal à `model_routes`/headers/Vertex. | **GARDER** (candidat PR upstream) |

**Verdict Volet C : 3× GARDER, 0 DROP.** Le trio email-subject/send_message forme une unité cohérente et petite (~57 l). Pistes de réduction du rouge : (a) proposer email-subject + param `subject` en PR upstream (features génériques) ; (b) sortir l'ajout `send_message` de `toolsets.py` vers un mécanisme d'override de toolset côté config, pour ne plus patcher le fichier core.

---

## 5. Prochaine action recommandée (avant Étape 2)

1. **Gemini (tranché)** : au sync, DROP le patch sanitize `47a1140df9` **et ses 3 tests orphelins** (échouent déjà) ; GARDER l'adapter `25c594f31e` et le réappliquer sur `translate_stream_event` (ancrage upstream ~l.686-710 intact).
2. **api_server.py — finir la migration plugin (le gros levier, ~416 l)** : activer `MECG_AGUI_ENABLED`, repointer `frontend/.../route.js` (`HERMES_API_URL`) du port 8642 vers le port 8643 du plugin, valider via les harnais headless, PUIS supprimer le pont `/ag-ui/*` du core. **À trancher/tester avant Étape 2** — sans ça les ~416 l ne sont pas supprimables.
3. **api_server.py — passthrough `/v1/*` (~316 l)** : confirmer qu'aucun consommateur `/v1/chat/completions` ou `/v1/responses` n'envoie encore de `tools` client (audit frontend + tout autre client). Si non → DROP ; sinon → plugin/wrapper.
4. **Volet C** : décider si on tente les PR upstream (email-subject, param `subject`) pour réduire durablement le rouge, ou si on conserve les 3 patches tels quels pour cette sync (recommandé : conserver cette sync, PR plus tard).
5. **Rappel structurel** : 2851 commits d'écart → après merge, revalider les **imports** des plugins `mecg_agui` / `phone` (renommages de modules `gateway.run`, `run_agent.AIAgent`, helpers) même s'ils sont « isolés ».

**Ce qui reste à TESTER explicitement avant de merger :**
- `pytest tests/run_agent/test_repair_tool_call_arguments.py -o addopts=""` (doit passer une fois les 3 tests concat retirés).
- Plugin `mecg_agui` sur port 8643 : `/ag-ui/info`, `/connect` vide (0 appel LLM), run LLM + interrupt `client_tool_passthrough`, HITL B3 approve/refuse, gate `afficher_carte`.
- Non-régression `/v1/*` sans `tools` (comportement upstream) si on garde le passthrough.
