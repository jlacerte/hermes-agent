// Endpoint POST /api/clientlog — reçoit les erreurs client et les logge via le logger structuré
// Contrat: {level, message, stack, digest, url, userAgent, ts}
import { logInfo, logWarn, logError } from "@/app/lib/logger";

const STACK_MAX = 4000;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "body invalide" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "body invalide" }, { status: 400 });
  }

  const {
    level = "error",
    message = "(no message)",
    stack,
    digest,
    url,
    userAgent,
    ts,
  } = body;

  const extra = {
    digest: digest ?? undefined,
    url: url ?? undefined,
    userAgent: userAgent ?? undefined,
    clientTs: ts ?? undefined,
    stack: stack ? String(stack).slice(0, STACK_MAX) : undefined,
  };

  // Supprime les clés undefined pour alléger le JSON
  Object.keys(extra).forEach((k) => extra[k] === undefined && delete extra[k]);

  const normalizedLevel = String(level).toLowerCase();

  if (normalizedLevel === "error") {
    logError("client", String(message), extra);
  } else if (normalizedLevel === "warn") {
    logWarn("client", String(message), extra);
  } else {
    logInfo("client", String(message), extra);
  }

  return new Response(null, { status: 204 });
}
