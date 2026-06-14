"use client";

import dynamic from "next/dynamic";

// SSR:false — CopilotKit hooks ne fonctionnent pas côté serveur
const DemoUI = dynamic(() => import("./demoui"), { ssr: false });

export default function DemoClient() {
  return <DemoUI />;
}
