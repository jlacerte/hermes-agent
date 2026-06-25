"""Pont AG-UI (CopilotKit V2) <-> Hermès — platform-plugin AUTONOME.

Objectif: sortir le pont AG-UI du fichier upstream gateway/platforms/api_server.py
(réécrit à chaque sync) vers un plugin séparé. Cet adapter ouvre son PROPRE serveur
aiohttp et lance les runs d'agent in-process; il a donc accès à l'objet agent vivant
et peut l'interrompre à la détection d'un outil client — le couplage dur identifié
au spike T1 (doc Archon 17328275) — sans toucher api_server.py.

Étape actuelle = SCAFFOLD: enregistrement du platform-plugin + serveur HTTP minimal
servant GET /ag-ui/info (discovery CopilotKit). La logique passthrough + interrupt +
round-trip HITL sera relocalisée ensuite (autonome, sans dépendre des internals
d'api_server). Voir docs Archon e8cce433 / 17328275 / d3537356.

Inerte par défaut: check_requirements() exige MECG_AGUI_ENABLED.
"""

import logging
import os
from typing import Any, Dict, Optional

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import BasePlatformAdapter, SendResult

try:
    from aiohttp import web
    AIOHTTP_AVAILABLE = True
except ImportError:  # pragma: no cover
    web = None  # type: ignore
    AIOHTTP_AVAILABLE = False

logger = logging.getLogger(__name__)

# Contrat de discovery lu par AG-UI core: {version, agents:{<id>:{description}}}.
AGUI_PROTOCOL_VERSION = "0.0.1"

DEFAULT_HOST = "10.0.0.1"  # VPN-only, cohérent avec les UIs internes MECG
DEFAULT_PORT = 8643


def _env_truthy(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


class AGUIAdapter(BasePlatformAdapter):
    """Adapter platform autonome qui sert le pont AG-UI sur son propre port."""

    def __init__(self, config: PlatformConfig):
        # Platform("mecg_agui") est créé dynamiquement par Platform._missing_()
        # (scan du dossier plugins/platforms/mecg_agui) — aucun edit de l'enum
        # upstream requis. La valeur DOIT matcher le nom de dossier.
        platform = Platform("mecg_agui")
        super().__init__(config=config, platform=platform)

        extra = config.extra or {}
        self._host: str = (
            extra.get("host") or os.getenv("MECG_AGUI_HOST", DEFAULT_HOST)
        )
        self._port: int = int(
            extra.get("port") or os.getenv("MECG_AGUI_PORT", str(DEFAULT_PORT))
        )
        self._key: str = extra.get("key") or os.getenv("MECG_AGUI_KEY", "")

        self._app: Optional["web.Application"] = None
        self._runner: Optional["web.AppRunner"] = None
        self._site: Optional["web.TCPSite"] = None

    # -- Auth -----------------------------------------------------------------

    def _check_auth(self, request: "web.Request") -> Optional["web.Response"]:
        """Vérifie le Bearer si une clé est configurée. None = OK."""
        if not self._key:
            return None
        auth = request.headers.get("Authorization", "")
        if auth == f"Bearer {self._key}":
            return None
        return web.json_response({"error": "unauthorized"}, status=401)

    # -- HTTP handlers --------------------------------------------------------

    async def _handle_agui_info(self, request: "web.Request") -> "web.Response":
        """GET /ag-ui/info — discovery agent pour CopilotKit V2."""
        auth_err = self._check_auth(request)
        if auth_err:
            return auth_err
        return web.json_response({
            "version": AGUI_PROTOCOL_VERSION,
            "agents": {
                "default": {
                    "description": "Philippe — assistant Mécanique Gicleurs (Hermès)",
                },
            },
        })

    # -- Cycle de vie ---------------------------------------------------------

    async def connect(self) -> bool:
        """Démarre le serveur aiohttp du pont AG-UI."""
        if not AIOHTTP_AVAILABLE:
            logger.warning("[%s] aiohttp non installé", self.name)
            return False
        try:
            self._app = web.Application()
            self._app.router.add_get("/ag-ui/info", self._handle_agui_info)
            # TODO (relocalisation): POST /ag-ui/agent/{id}/run|connect
            #   -> run d'agent in-process + passthrough outils client + interrupt.

            self._runner = web.AppRunner(self._app)
            await self._runner.setup()
            self._site = web.TCPSite(self._runner, self._host, self._port)
            await self._site.start()

            self._mark_connected()
            logger.info(
                "[%s] Pont AG-UI à l'écoute sur http://%s:%d",
                self.name, self._host, self._port,
            )
            return True
        except Exception as e:
            logger.error("[%s] Échec démarrage pont AG-UI: %s", self.name, e)
            return False

    async def disconnect(self) -> None:
        """Arrête le serveur aiohttp."""
        self._mark_disconnected()
        if self._site:
            await self._site.stop()
            self._site = None
        if self._runner:
            await self._runner.cleanup()
            self._runner = None
        self._app = None

    async def send(
        self,
        chat_id: str,
        content: str,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        """AG-UI est un canal requête/réponse HTTP — pas d'envoi sortant push."""
        return SendResult(success=False, error="AG-UI ne supporte pas l'envoi sortant")

    async def get_chat_info(self, chat_id: str) -> Dict[str, Any]:
        """AG-UI n'a pas de notion de chat persistant — métadonnées minimales."""
        return {"chat_id": chat_id, "platform": "mecg-agui", "type": "agui"}


# -- Enregistrement du plugin -------------------------------------------------

def check_requirements() -> bool:
    """Inerte par défaut: actif seulement si MECG_AGUI_ENABLED et aiohttp dispo."""
    return AIOHTTP_AVAILABLE and _env_truthy("MECG_AGUI_ENABLED")


def validate_config(config) -> bool:
    return _env_truthy("MECG_AGUI_ENABLED")


def is_connected(config) -> bool:
    return _env_truthy("MECG_AGUI_ENABLED")


def register(ctx) -> None:
    """Point d'entrée du plugin — appelé par le système de plugins Hermès."""
    ctx.register_platform(
        name="mecg_agui",
        label="MECG AG-UI",
        adapter_factory=lambda cfg: AGUIAdapter(cfg),
        check_fn=check_requirements,
        validate_config=validate_config,
        is_connected=is_connected,
        required_env=["MECG_AGUI_ENABLED"],
        emoji="🗺️",
        pii_safe=True,
        platform_hint=(
            "Tu communiques via le copilote AG-UI (CopilotKit) de Mécanique "
            "Gicleurs. Les actions visuelles (afficher_carte, etc.) sont des "
            "outils côté navigateur exécutés par le client."
        ),
    )
