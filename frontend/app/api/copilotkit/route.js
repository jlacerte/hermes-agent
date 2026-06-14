// CopilotKit Runtime (Node) -> Hermes api_server (OpenAI-compatible /v1)
// La vraie popup CopilotKit parle a Philippe directement via OpenAIAdapter.
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import { logInfo, logError } from "@/app/lib/logger";

const HERMES_URL = process.env.HERMES_API_URL || "http://10.0.0.1:8642/v1";
const HERMES_MODEL = process.env.HERMES_MODEL || "hermes-agent";

const openai = new OpenAI({
  baseURL: HERMES_URL,
  apiKey: process.env.HERMES_API_KEY || "missing-key",
});

const serviceAdapter = new OpenAIAdapter({
  openai,
  model: HERMES_MODEL,
});

// onError: trace les echecs upstream Hermes captes a l'interieur du pipeline
// CopilotKit (au-dela du try/catch qui n'attrape que ce qui remonte de
// handleRequest). Best-effort: selon la version/le mode (cloud vs self-hosted)
// ce hook ne se declenche pas toujours -> le try/catch ci-dessous reste la
// garantie de tracage. Voir tache PROD-A5 (doc 7f16373c §A5).
const runtime = new CopilotRuntime({
  onError: (errorEvent) => {
    try {
      logError("copilotkit", "onError pipeline", {
        type: errorEvent?.type,
        name: errorEvent?.error?.name || errorEvent?.name,
        message: errorEvent?.error?.message || errorEvent?.message,
        upstream: HERMES_URL,
        context: errorEvent?.context
          ? JSON.stringify(errorEvent.context).slice(0, 1000)
          : undefined,
      });
    } catch (_) {
      // ne jamais laisser le handler d'erreur planter le runtime
    }
  },
});

export const POST = async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);

  logInfo("copilotkit", "requete entrante", {
    requestId,
    model: HERMES_MODEL,
    upstream: HERMES_URL,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  const t0 = performance.now();
  try {
    const response = await handleRequest(req);
    const latencyMs = Math.round(performance.now() - t0);

    logInfo("copilotkit", "requete completee", {
      requestId,
      latencyMs,
      status: response.status,
    });

    return response;
  } catch (err) {
    const latencyMs = Math.round(performance.now() - t0);

    // Classifie l'echec upstream Hermes pour un diagnostic exploitable.
    const code = err?.code || err?.cause?.code;
    const upstreamDown = code === "ECONNREFUSED" || code === "ECONNRESET";
    const timeout = code === "ETIMEDOUT" || code === "UND_ERR_HEADERS_TIMEOUT";
    const kind = upstreamDown
      ? "hermes_injoignable"
      : timeout
      ? "hermes_timeout"
      : "hermes_erreur";

    logError("copilotkit", "echec upstream Hermes", {
      requestId,
      kind,
      code,
      latencyMs,
      upstream: HERMES_URL,
      error: err?.message,
      stack: err?.stack?.slice(0, 2000),
    });

    return Response.json(
      { error: "Upstream error", kind, requestId },
      { status: 502 }
    );
  }
};
