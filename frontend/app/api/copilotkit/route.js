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

const runtime = new CopilotRuntime();

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

    logError("copilotkit", "erreur handleRequest", {
      requestId,
      latencyMs,
      error: err?.message,
      stack: err?.stack?.slice(0, 2000),
    });

    return Response.json(
      { error: "Upstream error", requestId },
      { status: 502 }
    );
  }
};
