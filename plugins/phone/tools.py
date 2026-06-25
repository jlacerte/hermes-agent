"""Outil d'appel téléphonique sortant pour Hermès (plugin phone).

Hermès décide d'appeler -> POST sur l'endpoint local de hermes-voice (/call,
clé-protégé, local-only) -> Twilio compose depuis le numéro Hermès et dialogue
vocalement. La conversation est encadrée (garde-fou max-durée, end_call).
"""

from __future__ import annotations

import json
import os
import urllib.request

from tools.registry import tool_error, tool_result

HERMES_VOICE_CALL_URL = os.environ.get("HERMES_VOICE_CALL_URL", "http://127.0.0.1:8084/call")
# Secret partagé avec /call de hermes-voice. Côté gateway il s'appelle
# API_SERVER_KEY; côté voice HERMES_API_KEY (même valeur). On essaie les deux.
CALL_KEY = (
    os.environ.get("CALL_TRIGGER_KEY")
    or os.environ.get("HERMES_API_KEY")
    or os.environ.get("API_SERVER_KEY", "")
)


APPELER_SCHEMA = {
    "name": "appeler_telephone",
    "description": (
        "Passer un APPEL TÉLÉPHONIQUE sortant: Hermès appelle le numéro donné et "
        "dialogue vocalement (le but de l'appel est donné dans 'raison'). "
        "À utiliser quand Justin demande d'appeler quelqu'un, ou pour joindre un "
        "technicien/client de vive voix. Le numéro doit être au format E.164 (ex: +18194148807)."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "numero": {
                "type": "string",
                "description": "Numéro à appeler, format E.164 (ex: +18194148807).",
            },
            "raison": {
                "type": "string",
                "description": "But de l'appel / ce qu'Hermès doit dire ou demander à l'interlocuteur.",
            },
        },
        "required": ["numero"],
    },
}


def _handle_appeler(args: dict, **kw) -> str:
    numero = str(args.get("numero") or "").strip()
    raison = str(args.get("raison") or "").strip()
    if not numero:
        return tool_error("numero requis (format E.164, ex: +18194148807)")
    if not CALL_KEY:
        return tool_error("Aucune clé d'appel configurée (CALL_TRIGGER_KEY/HERMES_API_KEY).")

    payload = json.dumps({"to": numero, "context": raison, "key": CALL_KEY}).encode("utf-8")
    req = urllib.request.Request(
        HERMES_VOICE_CALL_URL,
        data=payload,
        headers={"Content-Type": "application/json", "X-Call-Key": CALL_KEY},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return tool_result({"appel_initie": True, "sid": data.get("sid"), "numero": numero})
    except Exception as e:
        return tool_error(f"Échec du déclenchement de l'appel: {type(e).__name__}: {e}")
