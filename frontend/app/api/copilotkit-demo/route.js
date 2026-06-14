// CopilotKit Runtime DEMO — modele neutre (gpt-4o-mini) SANS outils Zoho.
// But: montrer les 5 piliers AG-UI tels que documentes par les createurs.
// Un modele neutre n'a QUE les actions frontend -> il les appelle vraiment
// (Frontend Action, HITL, Generative UI, Textarea). Hermes prod reste intact.
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import { logInfo, logError } from "@/app/lib/logger";

const DEMO_MODEL = process.env.DEMO_MODEL || "gpt-4o-mini";

const openai = new OpenAI({
  apiKey: process.env.DEMO_OPENAI_API_KEY || "missing-key",
});

const serviceAdapter = new OpenAIAdapter({
  openai,
  model: DEMO_MODEL,
});

const runtime = new CopilotRuntime();

export const POST = async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);

  logInfo("copilotkit-demo", "requete entrante", {
    requestId,
    model: DEMO_MODEL,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit-demo",
  });

  const t0 = performance.now();
  try {
    const response = await handleRequest(req);
    const latencyMs = Math.round(performance.now() - t0);

    logInfo("copilotkit-demo", "requete completee", {
      requestId,
      latencyMs,
      status: response.status,
    });

    return response;
  } catch (err) {
    const latencyMs = Math.round(performance.now() - t0);

    logError("copilotkit-demo", "erreur handleRequest", {
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
