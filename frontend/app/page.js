"use client";

import dynamic from "next/dynamic";

// UI client-only : CopilotKit + actions (Generative UI) ne prerendent pas côté serveur
const PhilippeUI = dynamic(() => import("./ui"), { ssr: false });

export default function Home() {
  return <PhilippeUI />;
}
