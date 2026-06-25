"""Plugin phone — appel téléphonique sortant pour Hermès (bundled, auto-loaded).

Enregistre l'outil appeler_telephone dans le toolset ``phone``. Le handler POST
sur l'endpoint local de hermes-voice (/call). kind: backend -> auto-load au démarrage.
"""

from __future__ import annotations

from plugins.phone.tools import APPELER_SCHEMA, _handle_appeler

_TOOLS = (
    ("appeler_telephone", APPELER_SCHEMA, _handle_appeler, "📞"),
)


def register(ctx) -> None:
    """Register the phone tools. Called once by the plugin loader."""
    for name, schema, handler, emoji in _TOOLS:
        ctx.register_tool(
            name=name,
            toolset="phone",
            schema=schema,
            handler=handler,
            emoji=emoji,
        )
