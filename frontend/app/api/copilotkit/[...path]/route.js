// Proxy same-origin pour CopilotKit V2 (AG-UI).
// Le navigateur ne parle QU'À la même origine (/api/copilotkit/...) -> zéro CORS.
// On relaie en pass-through streaming vers le bridge AG-UI de Philippe
// (http://10.0.0.1:8642/ag-ui/...) en ajoutant le Bearer côté serveur, pour que
// la clé API ne quitte jamais le backend. runtimeUrl reste '/api/copilotkit'.
//
// Le client V2 (@copilotkitnext/core) tape:
//   GET  /api/copilotkit/info
//   POST /api/copilotkit/agent/<id>/run    (et /connect)
// -> mappés tels quels sur /ag-ui/<même suffixe>.
import { logError } from "@/app/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// HERMES_API_URL pointe sur .../v1 ; le bridge AG-UI est à .../ag-ui.
const AGUI_BASE =
  (process.env.HERMES_API_URL || "http://10.0.0.1:8642/v1")
    .replace(/\/v1\/?$/, "")
    .replace(/\/$/, "") + "/ag-ui";
const KEY = process.env.HERMES_API_KEY || "missing-key";

async function forward(req, ctx, method) {
  // Next 15: ctx.params est une Promise ; await fonctionne aussi sur un objet plat.
  const { path } = await ctx.params;
  const suffix = (path || []).join("/");
  const search = new URL(req.url).search || "";
  const target = `${AGUI_BASE}/${suffix}${search}`;

  const headers = {
    Authorization: `Bearer ${KEY}`,
    Accept: req.headers.get("accept") || "text/event-stream",
  };
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;
  const sk = req.headers.get("x-hermes-session-key");
  if (sk) headers["x-hermes-session-key"] = sk;

  const body = method === "POST" ? await req.text() : undefined;

  try {
    const upstream = await fetch(target, { method, headers, body });
    const respHeaders = new Headers();
    const ctype = upstream.headers.get("content-type");
    if (ctype) respHeaders.set("content-type", ctype);
    respHeaders.set("cache-control", "no-cache, no-transform");
    respHeaders.set("x-accel-buffering", "no");
    // upstream.body est un ReadableStream -> pass-through SSE sans buffering.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (err) {
    logError("agui-proxy", "echec upstream Hermes", {
      target,
      method,
      error: err?.message,
      code: err?.cause?.code,
    });
    return Response.json({ error: "Upstream AG-UI error" }, { status: 502 });
  }
}

export async function GET(req, ctx) {
  return forward(req, ctx, "GET");
}
export async function POST(req, ctx) {
  return forward(req, ctx, "POST");
}
