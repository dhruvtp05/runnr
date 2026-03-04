"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, ExternalLink, Trash2 } from "lucide-react";

type SavedRouteMeta = {
  id: string;
  name: string | null;
  createdAt: string;
};

const STORAGE_KEY = "runnr:saved-routes";

export default function SavedRoutesClient() {
  const [items, setItems] = useState<SavedRouteMeta[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedRouteMeta[];
      setItems(parsed);
    } catch {
      // ignore
    }
  }, []);

  const remove = (id: string) => {
    setItems((curr) => {
      const next = curr.filter((r) => r.id !== id);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (!items.length) {
    return (
      <div className="glass rounded-2xl p-6 border border-white/10 text-sm text-zinc-300">
        <p className="mb-2">
          When you save routes, they&apos;ll show up here for this browser.
        </p>
        <p className="text-zinc-500">
          Saving does not require an account; if you clear your browser data,
          this list will reset, but your shared links will still work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const label = item.name?.trim() || "Unnamed route set";
        const date = item.createdAt
          ? new Date(item.createdAt).toLocaleString()
          : "";
        const href = `/routes/saved/${item.id}`;
        return (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="font-medium text-white truncate">{label}</div>
              {date ? (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
                  <Clock className="w-3 h-3" />
                  <span>{date}</span>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={href}
                className="inline-flex items-center gap-1 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30"
              >
                <ExternalLink className="w-3 h-3" />
                Open
              </Link>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                aria-label="Remove from this list"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

