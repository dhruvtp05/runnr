"use client";

import dynamic from "next/dynamic";

const RoutesClient = dynamic(() => import("./routes-client"), {
  ssr: false,
  loading: () => (
    <div className="panel p-6 text-body">
      Loading map…
    </div>
  ),
});

export default function RoutesClientLoader() {
  return <RoutesClient />;
}

