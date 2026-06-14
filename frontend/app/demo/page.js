// Server Component — gate la démo en prod (A8, doc 7f16373c §A8).
// /demo n'est accessible que si ENABLE_DEMO=true; sinon 404 (notFound).
import { notFound } from "next/navigation";
import { DEMO_ENABLED } from "@/app/lib/demo-gate";
import DemoClient from "./demo-client";

// Gate évalué au RUNTIME (pas au build) -> ENABLE_DEMO=true + restart suffit
// à réactiver /demo sans rebuild.
export const dynamic = "force-dynamic";

export default function DemoPage() {
  if (!DEMO_ENABLED) notFound();
  return <DemoClient />;
}
