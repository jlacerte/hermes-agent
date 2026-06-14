# Harnais de debug headless — copilot-ui

> ## ⚠️ RÈGLE D'OR — voir avec les yeux
> Un `status 200` serveur **ne prouve PAS** le rendu navigateur. Tout test (`headless-piliers.js`)
> capture un screenshot `/tmp/copilot-debug/piliers.png` : **l'ouvrir avec l'outil `Read` et le
> REGARDER** avant de déclarer quoi que ce soit « fonctionnel ». Voir `DEMO-PILIERS.md`.

## Lancer le harnais Playwright

```bash
# URL par défaut (http://10.0.0.1:8083/)
node scripts/headless-debug.js

# URL personnalisée
node scripts/headless-debug.js http://10.0.0.1:8083/

# Via npm
npm run debug
```

**Exit code 0** = aucune erreur critique (PAGEERROR ou HTTP>=500).  
**Exit code 1** = au moins une erreur détectée — lire la sortie pour le détail.

Le script capture : messages console, erreurs JS (pageerror), requêtes réseau échouées, réponses HTTP >=400, et le texte visible de la page (500 premiers chars).

---

## Lire les logs serveur

```bash
# Suivi en temps réel
journalctl -u copilot-ui -f

# 100 dernières lignes
journalctl -u copilot-ui -n 100 --no-pager

# Via npm
npm run logs

# Depuis la dernière heure
journalctl -u copilot-ui --since "1 hour ago"
```

---

## Logs client (clientlog)

Les erreurs frontend sont envoyées en POST vers `/api/clientlog` avec le JSON :
```json
{ "level": "error", "message": "...", "stack": "...", "digest": "...", "url": "...", "userAgent": "...", "ts": 1234567890 }
```

Ces logs apparaissent dans le journal systemd de `copilot-ui` — visibles avec `journalctl -u copilot-ui`.

---

## Leçon CopilotKit — actions render-only

CopilotKit 1.60.1 rejette une action sans champ de routage avec l'erreur :
```
Error: Invalid action configuration
```

**Fix appliqué dans `app/ui.js`** : ajouter `available: "frontend"` sur toute action render-only (sans handler serveur).

```js
useCopilotAction({
  name: "afficher_carte",
  available: "frontend",   // <-- obligatoire pour les actions render-only
  render: ({ args }) => <MaComposante {...args} />,
});
```

Ne pas modifier `app/ui.js`, `app/page.js`, ni `app/demo/**` — ces fichiers sont fonctionnels.
