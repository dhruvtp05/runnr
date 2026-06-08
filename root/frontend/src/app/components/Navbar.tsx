"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onResize = () => {
      if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobileMenuOpen]);

  const goToSection = (id: string) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSectionClick = (id: string) => {
    if (pathname === "/") {
      goToSection(id);
    } else {
      router.push(`/#${id}`);
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 navbar backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6">
        <nav className="flex items-center justify-between h-14 gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-heading">
            runnr
          </Link>

          <div className="hidden md:flex items-center gap-5">
            <button
              type="button"
              onClick={() => handleSectionClick("features")}
              className="text-sm text-body hover:text-heading transition-colors"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => handleSectionClick("how-it-works")}
              className="text-sm text-body hover:text-heading transition-colors"
            >
              How it works
            </button>
            <Link
              href="/routes/saved"
              className="text-sm text-body hover:text-heading transition-colors"
            >
              Saved routes
            </Link>
            <ThemeToggle />
            <Link href="/routes" className="btn btn-primary">
              Plan a route
            </Link>
          </div>

          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              className="btn-ghost rounded-md p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-default py-3 flex flex-col gap-1">
            <button
              type="button"
              className="py-2 text-left text-sm text-body"
              onClick={() => handleSectionClick("features")}
            >
              Features
            </button>
            <button
              type="button"
              className="py-2 text-left text-sm text-body"
              onClick={() => handleSectionClick("how-it-works")}
            >
              How it works
            </button>
            <Link
              href="/routes/saved"
              className="py-2 text-sm text-body"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Saved routes
            </Link>
            <Link
              href="/routes"
              className="py-2 text-sm font-medium text-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Plan a route
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
