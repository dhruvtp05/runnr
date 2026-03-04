"use client";

import dynamic from "next/dynamic";

const SavedRouteView = dynamic(() => import("./saved-route-view"), {
  ssr: false,
});

export default SavedRouteView;

