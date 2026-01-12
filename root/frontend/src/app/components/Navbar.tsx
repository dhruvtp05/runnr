"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
// Import the font directly into the component file if not using the global layout class
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`${inter.className} fixed top-0 w-full z-50 px-4 pt-6 transition-all duration-300`}>
      <nav className={`max-w-5xl mx-auto flex items-center justify-between px-6 py-2.5 rounded-2xl border transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/80 backdrop-blur-md border-slate-200 shadow-sm' 
          : 'bg-white/50 border-transparent shadow-none'
      }`}>
        
        {/* Logo - Lowercase, Bold, Tight Spacing */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tighter text-slate-900">
            runn<span className="text-blue-600">ai.</span>
          </span>
        </Link>

        {/* Navigation Links - Medium Weight, Airy Spacing */}
        <div className="flex items-center gap-8">
          {/* Theme Switcher Toggle */}
          <div className="flex items-center bg-slate-100/50 p-1 rounded-full border border-slate-200 ml-2">
             <div className="p-1.5 rounded-full bg-white shadow-sm border border-slate-200/50">
                <Moon className="w-3.5 h-3.5 text-slate-700" />
             </div>
             <div className="p-1.5 rounded-full opacity-40">
                <Sun className="w-3.5 h-3.5 text-slate-400" />
             </div>
          </div>
        </div>
      </nav>
    </div>
  );
}