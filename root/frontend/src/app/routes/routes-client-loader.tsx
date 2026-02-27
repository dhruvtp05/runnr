"use client";

import dynamic from "next/dynamic";

const RoutesClient = dynamic(() => import("./routes-client"), {
  ssr: false,
  loading: () => (
    <div className="glass rounded-2xl p-6 border border-white/10 text-zinc-300">
      Loading map…
    </div>
  ),
});

export default function RoutesClientLoader() {
  return <RoutesClient />;
}

