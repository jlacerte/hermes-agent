"""Pont AG-UI (CopilotKit V2) <-> Hermès — platform-plugin AUTONOME.

Objectif: sortir le pont AG-UI du fichier upstream gateway/platforms/api_server.py
(réécrit à chaque sync) vers un platform-plugin AUTONOME, pour qu'une mise à jour
d'Hermès ne casse plus le copilote (spike T1=NON, doc Archon 17328275 ; viabilité
T3, doc d3537356).

Cet adapter ouvre son PROPRE serveur aiohttp et lance les runs d'agent in-process;
il a donc accès à l'objet agent vivant et peut l'interrompre à la détection d'un
outil client (afficher_carte, etc.) — le couplage dur identifié au spike — SANS
toucher api_server.py.

Architecture: STANDALONE (décision D1). On ne sous-classe PAS APIServerAdapter; on
reproduit un run-path mince qui n'appelle que le cœur stable (run_agent.AIAgent +
helpers gateway.run). Upstream ne touche jamais ce fichier; en retour ce fichier
n'appelle que des APIs cœur, bien plus stables que le bloc AG-UI clobberé.

Mapping AG-UI (RunAgentInput -> _run_agent), repris de l'implémentation d'origine
(doc dc032870):
  messages -> conversation_history + dernier message user (round-trips d'outils
              client APLATIS en texte: Gemini 3.x rejette les functionCall rejoués
              sans thought_signature)
  context  -> ephemeral_system_prompt (le panneau ouvert devient visible au modèle)
  tools    -> client_tools (passthrough actions frontend; non exécutés serveur)
  deltas   -> TEXT_MESSAGE_* | tool starts -> TOOL_CALL_* | completes -> TOOL_CALL_RESULT
  fin      -> RUN_FINISHED / RUN_ERROR

Inerte par défaut: check_requirements() exige MECG_AGUI_ENABLED.
"""

import asyncio
import json
import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

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
# Intervalle de keepalive SSE (commentaire « : keepalive ») en secondes.
SSE_KEEPALIVE_SECONDS = 15

DEFAULT_HOST = "10.0.0.1"  # VPN-only, cohérent avec les UIs internes MECG
DEFAULT_PORT = 8643

# L'agent AG-UI utilise la MÊME config/toolset que la plateforme api_server
# (mêmes outils Zoho, même modèle) — relocalisation fidèle, zéro changement de
# comportement. C'est un choix de toolset, pas de routage.
_AGENT_PLATFORM = "api_server"


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
        self._session_db = None

    # -- Auth -----------------------------------------------------------------

    def _check_auth(self, request: "web.Request") -> Optional["web.Response"]:
        """Vérifie le Bearer si une clé est configurée. None = OK."""
        if not self._key:
            return None
        if request.headers.get("Authorization", "") == f"Bearer {self._key}":
            return None
        return web.json_response({"error": "unauthorized"}, status=401)

    def _parse_session_key_header(
        self, request: "web.Request"
    ) -> Tuple[Optional[str], Optional["web.Response"]]:
        """Extrait X-Hermes-Session-Key (scope mémoire long terme). L'auth est
        déjà vérifiée par _check_auth à l'entrée du handler."""
        raw = request.headers.get("X-Hermes-Session-Key", "").strip()
        return (raw or None), None

    # -- Agent run-path (standalone) -----------------------------------------

    def _ensure_session_db(self):
        """Initialise paresseusement la SessionDB partagée (state.db)."""
        if self._session_db is None:
            try:
                from hermes_state import SessionDB
                self._session_db = SessionDB()
            except Exception as e:
                logger.debug("SessionDB indisponible pour AG-UI: %s", e)
        return self._session_db

    def _create_agent(
        self,
        ephemeral_system_prompt: Optional[str] = None,
        session_id: Optional[str] = None,
        stream_delta_callback=None,
        tool_progress_callback=None,
        tool_start_callback=None,
        tool_complete_callback=None,
        gateway_session_key: Optional[str] = None,
    ) -> Any:
        """Crée un AIAgent via la config runtime du gateway (cœur stable)."""
        from run_agent import AIAgent
        from gateway.run import (
            _resolve_runtime_agent_kwargs,
            _resolve_gateway_model,
            _load_gateway_config,
            GatewayRunner,
        )
        from hermes_cli.tools_config import _get_platform_tools

        runtime_kwargs = _resolve_runtime_agent_kwargs()
        reasoning_config = GatewayRunner._load_reasoning_config()
        model = _resolve_gateway_model()
        user_config = _load_gateway_config()
        enabled_toolsets = sorted(_get_platform_tools(user_config, _AGENT_PLATFORM))
        max_iterations = int(os.getenv("HERMES_MAX_ITERATIONS", "90"))
        fallback_model = GatewayRunner._load_fallback_model()

        return AIAgent(
            model=model,
            **runtime_kwargs,
            max_iterations=max_iterations,
            quiet_mode=True,
            verbose_logging=False,
            ephemeral_system_prompt=ephemeral_system_prompt or None,
            enabled_toolsets=enabled_toolsets,
            session_id=session_id,
            platform=_AGENT_PLATFORM,
            stream_delta_callback=stream_delta_callback,
            tool_progress_callback=tool_progress_callback,
            tool_start_callback=tool_start_callback,
            tool_complete_callback=tool_complete_callback,
            session_db=self._ensure_session_db(),
            fallback_model=fallback_model,
            reasoning_config=reasoning_config,
            gateway_session_key=gateway_session_key,
        )

    async def _run_agent(
        self,
        user_message: str,
        conversation_history: List[Dict[str, str]],
        ephemeral_system_prompt: Optional[str] = None,
        session_id: Optional[str] = None,
        stream_delta_callback=None,
        tool_start_callback=None,
        tool_complete_callback=None,
        agent_ref: Optional[list] = None,
        gateway_session_key: Optional[str] = None,
        client_tools: Optional[List[Dict[str, Any]]] = None,
    ) -> tuple:
        """Crée un agent et lance la conversation dans un thread executor.

        Si *agent_ref* est une liste à un élément, l'instance AIAgent y est
        stockée avant run_conversation — c'est ce qui permet au writer SSE
        d'appeler agent.interrupt() depuis un autre thread (le couplage dur).
        """
        loop = asyncio.get_running_loop()

        def _run():
            from gateway.session_context import clear_session_vars, set_session_vars

            tokens = set_session_vars(
                platform=_AGENT_PLATFORM,
                chat_id=session_id or "",
                session_key=gateway_session_key or session_id or "",
                session_id=session_id or "",
            )
            try:
                agent = self._create_agent(
                    ephemeral_system_prompt=ephemeral_system_prompt,
                    session_id=session_id,
                    stream_delta_callback=stream_delta_callback,
                    tool_start_callback=tool_start_callback,
                    tool_complete_callback=tool_complete_callback,
                    gateway_session_key=gateway_session_key,
                )
                # Injecte les tool-defs client dans la surface de l'agent pour
                # que le modèle les voie (sinon « Unknown tool »). On n'ajoute
                # que les noms inconnus pour ne pas masquer un outil serveur.
                if client_tools:
                    _existing = {
                        t.get("function", {}).get("name")
                        for t in (agent.tools or [])
                        if isinstance(t, dict)
                    }
                    for ct in client_tools:
                        if not isinstance(ct, dict):
                            continue
                        cname = ct.get("function", {}).get("name")
                        if cname and cname not in _existing:
                            agent.tools = agent.tools or []
                            agent.tools.append(ct)
                            agent.valid_tool_names.add(cname)
                            _existing.add(cname)
                if agent_ref is not None:
                    agent_ref[0] = agent
                effective_task_id = session_id or str(uuid.uuid4())
                result = agent.run_conversation(
                    user_message=user_message,
                    conversation_history=conversation_history,
                    task_id=effective_task_id,
                )
                usage = {
                    "input_tokens": getattr(agent, "session_prompt_tokens", 0) or 0,
                    "output_tokens": getattr(agent, "session_completion_tokens", 0) or 0,
                    "total_tokens": getattr(agent, "session_total_tokens", 0) or 0,
                }
                _eff_sid = getattr(agent, "session_id", session_id)
                if isinstance(_eff_sid, str) and _eff_sid:
                    result["session_id"] = _eff_sid
                return result, usage
            finally:
                clear_session_vars(tokens)

        return await loop.run_in_executor(None, _run)

    # -- AG-UI helpers --------------------------------------------------------

    @staticmethod
    def _agui_normalize_tools(raw_tools) -> List[Dict[str, Any]]:
        """AG-UI flat tool {name,description,parameters} -> nested Chat shape
        {type:function, function:{...}} attendu par _run_agent."""
        client_tools: List[Dict[str, Any]] = []
        for t in raw_tools or []:
            if not isinstance(t, dict):
                continue
            if "function" in t:
                client_tools.append(t)
            elif t.get("name"):
                client_tools.append({
                    "type": "function",
                    "function": {
                        "name": t.get("name"),
                        "description": t.get("description", ""),
                        "parameters": t.get("parameters", {}),
                    },
                })
        return client_tools

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

    async def _handle_agui_run(self, request: "web.Request") -> "web.StreamResponse":
        """POST /ag-ui/agent/{agent_id}/run (et /connect) — run AG-UI."""
        auth_err = self._check_auth(request)
        if auth_err:
            return auth_err
        gateway_session_key, key_err = self._parse_session_key_header(request)
        if key_err is not None:
            return key_err

        try:
            body = await request.json()
        except (json.JSONDecodeError, Exception):
            return web.json_response(
                {"error": {"message": "Invalid JSON in request body", "type": "invalid_request_error"}},
                status=400,
            )

        thread_id = body.get("threadId") or str(uuid.uuid4())
        run_id = body.get("runId") or str(uuid.uuid4())
        raw_messages = body.get("messages") or []
        raw_context = body.get("context") or []
        raw_tools = body.get("tools") or []

        # tools -> client_tools. Quand le modèle en invoque un, l'agent ne doit
        # PAS l'exécuter côté serveur (relayé au client à la place).
        client_tools = self._agui_normalize_tools(raw_tools)
        client_tool_names: set = {
            t.get("function", {}).get("name")
            for t in client_tools
            if isinstance(t, dict) and t.get("function", {}).get("name")
        }

        # context (useAgentContext [{description,value}]) -> system prompt
        # éphémère. C'est ce qui laisse le modèle « voir » le panneau ouvert et
        # répondre aux questions de suivi dessus.
        ephemeral_system_prompt = None
        ctx_lines: List[str] = []
        for c in raw_context:
            if not isinstance(c, dict):
                continue
            desc = c.get("description", "")
            val = c.get("value", "")
            if isinstance(val, (dict, list)):
                val = json.dumps(val, ensure_ascii=False)
            line = f"{desc}: {val}".strip().strip(":").strip()
            if line:
                ctx_lines.append(line)
        if ctx_lines:
            ephemeral_system_prompt = (
                "Contexte courant de l'interface (fourni par le frontend):\n"
                + "\n".join(ctx_lines)
            )

        # messages -> liste chat-format. Les tool calls de cet historique sont
        # des outils CLIENT (afficher_carte / ouvrir_facture / confirmer_relance);
        # les outils serveur (Zoho) ne round-trippent jamais par le client. On
        # APLATIT ces round-trips en TEXTE au lieu de les rejouer en function_call
        # natif: Gemini 3.x rejette un functionCall rejoué sans thought_signature
        # (que CopilotKit ne préserve pas). Le texte porte la même info (décision).
        tcid2name: Dict[str, str] = {}
        mapped: List[Dict[str, Any]] = []
        for m in raw_messages:
            if not isinstance(m, dict):
                continue
            role = m.get("role", "user")
            content = m.get("content", "") or ""
            if role == "assistant":
                tcs = m.get("toolCalls") or m.get("tool_calls") or []
                notes = []
                for tc in tcs:
                    if not isinstance(tc, dict):
                        continue
                    fn = tc.get("function", {}) or {}
                    name = fn.get("name", "")
                    args = fn.get("arguments", "") or ""
                    tcid = tc.get("id", "")
                    if tcid:
                        tcid2name[tcid] = name
                    notes.append(f"{name}({args})" if args else f"{name}()")
                text = content
                if notes:
                    note_str = "[action interface demandée: " + "; ".join(notes) + "]"
                    text = (content + "\n" + note_str) if content else note_str
                mapped.append({"role": "assistant", "content": text})
            elif role == "tool":
                tcid = m.get("toolCallId") or m.get("tool_call_id") or ""
                name = tcid2name.get(tcid, "")
                body_txt = content if isinstance(content, str) else json.dumps(content)
                label = f"action « {name} »" if name else "action interface"
                # Le résultat d'outil devient un tour USER (la réponse humaine/UI).
                mapped.append({
                    "role": "user",
                    "content": f"[Résultat {label}: {body_txt}]",
                })
            else:
                mapped.append({"role": role, "content": content})

        # Seule une liste FINISSANT par un message user est un nouveau tour. Si le
        # dernier message est un résultat d'outil / assistant (round-trip HITL),
        # c'est une CONTINUATION: garder l'ordre intact et laisser l'agent
        # reprendre depuis la réponse de fonction.
        if mapped and mapped[-1].get("role") == "user":
            user_message = mapped[-1].get("content", "")
            conversation_history = mapped[:-1]
        else:
            user_message = ""
            conversation_history = mapped

        session_id = thread_id or str(uuid.uuid4())

        # Le client V2 ouvre /connect avec un RunAgentInput VIDE (pas de messages)
        # pour établir/rejouer le stream. Lancer l'agent avec un user_message vide
        # provoque un Gemini 400 et gaspille un appel LLM. Court-circuit: émettre
        # un run AG-UI vide bien formé.
        has_history = any(
            (m.get("content") or m.get("tool_calls")) for m in conversation_history
        )
        if not user_message and not has_history:
            empty_headers = {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            }
            resp = web.StreamResponse(status=200, headers=empty_headers)
            await resp.prepare(request)
            await resp.write(
                f"data: {json.dumps({'type': 'RUN_STARTED', 'threadId': thread_id, 'runId': run_id})}\n\n".encode()
            )
            await resp.write(
                f"data: {json.dumps({'type': 'RUN_FINISHED', 'threadId': thread_id, 'runId': run_id})}\n\n".encode()
            )
            await resp.write_eof()
            return resp

        # ── SSE: queue thread-safe alimentée par les callbacks de _run_agent ──
        import queue as _q
        _stream_q: "_q.Queue" = _q.Queue()

        def _on_delta(delta):
            if delta is not None:
                _stream_q.put(delta)

        def _on_tool_start(tool_call_id, function_name, function_args):
            _stream_q.put(("__tool_started__", {
                "tool_call_id": tool_call_id,
                "name": function_name,
                "arguments": function_args or {},
            }))
            # Un outil CLIENT n'a pas d'impl serveur: relayer au client +
            # interrompre pour que l'agent ne tente PAS de l'exécuter.
            if function_name in client_tool_names:
                _agent = agent_ref[0] if agent_ref else None
                if _agent is not None:
                    try:
                        _agent.interrupt("client_tool_passthrough")
                    except Exception:
                        pass

        def _on_tool_complete(tool_call_id, function_name, function_args, function_result):
            # Les outils client (actions frontend / HITL) n'ont PAS de résultat
            # serveur: l'agent est interrompu et le vrai résultat vient de l'humain
            # via respond() au PROCHAIN run. L'exécuteur peut émettre un faux
            # « Unknown tool » ici — le supprimer, sinon CopilotKit marque le tool
            # call complété et replie la carte HITL avant le clic de l'utilisateur.
            if function_name in client_tool_names:
                return
            _stream_q.put(("__tool_completed__", {
                "tool_call_id": tool_call_id,
                "name": function_name,
                "result": function_result,
            }))

        agent_ref = [None]
        agent_task = asyncio.ensure_future(self._run_agent(
            user_message=user_message,
            conversation_history=conversation_history,
            ephemeral_system_prompt=ephemeral_system_prompt,
            session_id=session_id,
            stream_delta_callback=_on_delta,
            tool_start_callback=_on_tool_start,
            tool_complete_callback=_on_tool_complete,
            agent_ref=agent_ref,
            gateway_session_key=gateway_session_key,
            client_tools=client_tools,
        ))
        agent_task.add_done_callback(lambda _fut: _stream_q.put(None))

        return await self._write_sse_agui(
            request=request,
            thread_id=thread_id,
            run_id=run_id,
            stream_q=_stream_q,
            agent_task=agent_task,
            agent_ref=agent_ref,
            session_id=session_id,
            gateway_session_key=gateway_session_key,
        )

    async def _write_sse_agui(
        self,
        request: "web.Request",
        thread_id: str,
        run_id: str,
        stream_q,
        agent_task,
        agent_ref,
        session_id: str,
        gateway_session_key: Optional[str] = None,
    ) -> "web.StreamResponse":
        """Draine la queue agent et émet les events SSE AG-UI (data: <json>\\n\\n).

        NB: pas de CORS — le frontend route.js est un proxy same-origin (couche 1
        stable du découplage). Si un jour un client cross-origin direct est requis,
        ajouter les en-têtes CORS ici.
        """
        import queue as _q

        sse_headers = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
        if session_id:
            sse_headers["X-Hermes-Session-Id"] = session_id
        if gateway_session_key:
            sse_headers["X-Hermes-Session-Key"] = gateway_session_key
        response = web.StreamResponse(status=200, headers=sse_headers)
        await response.prepare(request)

        text_msg_id: Optional[str] = None
        final_text_parts: List[str] = []
        agent_error: Optional[str] = None

        async def _emit(event: Dict[str, Any]) -> None:
            await response.write(f"data: {json.dumps(event)}\n\n".encode())

        async def _open_text() -> None:
            nonlocal text_msg_id
            if text_msg_id is not None:
                return
            text_msg_id = f"msg_{uuid.uuid4().hex[:24]}"
            await _emit({"type": "TEXT_MESSAGE_START", "messageId": text_msg_id, "role": "assistant"})

        async def _close_text() -> None:
            nonlocal text_msg_id
            if text_msg_id is None:
                return
            await _emit({"type": "TEXT_MESSAGE_END", "messageId": text_msg_id})
            text_msg_id = None

        async def _emit_text_delta(delta: str) -> None:
            await _open_text()
            final_text_parts.append(delta)
            await _emit({"type": "TEXT_MESSAGE_CONTENT", "messageId": text_msg_id, "delta": delta})

        async def _emit_tool_started(payload: Dict[str, Any]) -> None:
            # AG-UI sépare les flux texte et tool-call: fermer tout message texte
            # assistant ouvert avant d'émettre un tool call.
            await _close_text()
            call_id = payload.get("tool_call_id") or f"call_{uuid.uuid4().hex[:16]}"
            name = payload.get("name", "")
            args = payload.get("arguments", {})
            args_str = json.dumps(args) if isinstance(args, (dict, list)) else str(args)
            await _emit({"type": "TOOL_CALL_START", "toolCallId": call_id, "toolCallName": name})
            if args_str and args_str != "{}":
                await _emit({"type": "TOOL_CALL_ARGS", "toolCallId": call_id, "delta": args_str})
            await _emit({"type": "TOOL_CALL_END", "toolCallId": call_id})

        async def _emit_tool_completed(payload: Dict[str, Any]) -> None:
            call_id = payload.get("tool_call_id")
            result = payload.get("result", "")
            result_str = result if isinstance(result, str) else json.dumps(result)
            await _emit({
                "type": "TOOL_CALL_RESULT",
                "messageId": f"msg_{uuid.uuid4().hex[:24]}",
                "toolCallId": call_id,
                "content": result_str,
                "role": "tool",
            })

        async def _dispatch(it) -> None:
            if isinstance(it, tuple) and len(it) == 2 and isinstance(it[0], str):
                tag, payload = it
                if tag == "__tool_started__":
                    await _emit_tool_started(payload)
                elif tag == "__tool_completed__":
                    await _emit_tool_completed(payload)
            elif isinstance(it, str):
                await _emit_text_delta(it)

        try:
            await _emit({"type": "RUN_STARTED", "threadId": thread_id, "runId": run_id})
            last_activity = time.monotonic()
            loop = asyncio.get_running_loop()
            while True:
                try:
                    item = await loop.run_in_executor(None, lambda: stream_q.get(timeout=0.5))
                except _q.Empty:
                    if agent_task.done():
                        while True:
                            try:
                                item = stream_q.get_nowait()
                                if item is None:
                                    break
                                await _dispatch(item)
                            except _q.Empty:
                                break
                        break
                    if time.monotonic() - last_activity >= SSE_KEEPALIVE_SECONDS:
                        await response.write(b": keepalive\n\n")
                        last_activity = time.monotonic()
                    continue
                if item is None:  # sentinelle EOS
                    break
                await _dispatch(item)
                last_activity = time.monotonic()

            await _close_text()

            try:
                result, _usage = await agent_task
                agent_final = result.get("final_response", "") if isinstance(result, dict) else ""
                if agent_final and not final_text_parts:
                    await _emit_text_delta(agent_final)
                    await _close_text()
                if isinstance(result, dict) and result.get("error") and not final_text_parts:
                    agent_error = result["error"]
            except Exception as e:  # noqa: BLE001
                logger.error("Erreur run agent AG-UI: %s", e, exc_info=True)
                agent_error = str(e)

            if agent_error:
                await _emit({"type": "RUN_ERROR", "message": agent_error})
            else:
                await _emit({"type": "RUN_FINISHED", "threadId": thread_id, "runId": run_id})
        except (ConnectionResetError, asyncio.CancelledError):
            _agent = agent_ref[0] if agent_ref else None
            if _agent is not None:
                try:
                    _agent.interrupt("client_disconnected")
                except Exception:
                    pass
            raise
        finally:
            try:
                await response.write_eof()
            except Exception:
                pass
        return response

    # -- Cycle de vie ---------------------------------------------------------

    async def connect(self) -> bool:
        """Démarre le serveur aiohttp du pont AG-UI."""
        if not AIOHTTP_AVAILABLE:
            logger.warning("[%s] aiohttp non installé", self.name)
            return False
        try:
            self._app = web.Application()
            self._app.router.add_get("/ag-ui/info", self._handle_agui_info)
            self._app.router.add_post("/ag-ui/agent/{agent_id}/run", self._handle_agui_run)
            self._app.router.add_post("/ag-ui/agent/{agent_id}/connect", self._handle_agui_run)

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
        return {"chat_id": chat_id, "platform": "mecg_agui", "type": "agui"}


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
