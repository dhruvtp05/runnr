"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "py-3" : "py-5"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6">
        <nav
          className={`flex items-center justify-between rounded-2xl border transition-all duration-300 ${
            isScrolled
              ? "bg-zinc-900/80 border-white/5 backdrop-blur-xl shadow-lg shadow-black/20"
              : "bg-zinc-900/40 border-white/5 backdrop-blur-md"
          } px-5 py-3`}
        >
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white"
          >
            runn<span className="gradient-text">r</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              How it works
            </Link>
            <Link
              href="#"
              className="rounded-full bg-white text-zinc-900 text-sm font-semibold px-4 py-2 hover:bg-zinc-200 transition-colors"
            >
              Get started
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-zinc-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {isMobileMenuOpen && (
          <div className="md:hidden mt-2 rounded-2xl border border-white/5 bg-zinc-900/95 backdrop-blur-xl p-4 flex flex-col gap-2">
            <Link href="#features" className="py-2 text-zinc-300" onClick={() => setIsMobileMenuOpen(false)}>
              Features
            </Link>
            <Link href="#how-it-works" className="py-2 text-zinc-300" onClick={() => setIsMobileMenuOpen(false)}>
              How it works
            </Link>
            <Link href="#" className="py-2 text-zinc-300" onClick={() => setIsMobileMenuOpen(false)}>
              Pricing
            </Link>
            <Link href="#" className="py-2 text-white font-medium" onClick={() => setIsMobileMenuOpen(false)}>
              Get started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
