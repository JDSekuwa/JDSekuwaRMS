"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [embers, setEmbers] = useState<Array<{ id: number; left: string; size: string; delay: string; duration: string }>>([]);

  // Generate sparks for the charcoal grill effect
  useEffect(() => {
    const generated = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 6 + 4}px`,
      delay: `${Math.random() * 10}s`,
      duration: `${Math.random() * 8 + 8}s`
    }));
    setEmbers(generated);
  }, []);

  const redirectPath = searchParams?.get("redirect") || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid login credentials.");
      }

      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FAFAFA] font-sans overflow-hidden text-zinc-800">
      
      {/* LEFT COLUMN: Premium Restaurant Aesthetic Panel (hidden on small/mobile) */}
      <div className="relative hidden w-[55%] flex-col items-center justify-center bg-gradient-to-b from-[#1C0D02] via-[#0E0601] to-[#050200] px-12 md:flex overflow-hidden border-r border-[#2C1403]/30">
        
        {/* Floating Charcoal Embers Sparks */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {embers.map((ember) => (
            <div
              key={ember.id}
              className="absolute bottom-0 rounded-full bg-gradient-to-t from-orange-600 via-orange-500 to-yellow-400 opacity-0"
              style={{
                left: ember.left,
                width: ember.size,
                height: ember.size,
                animationName: "float-ember",
                animationDuration: ember.duration,
                animationDelay: ember.delay,
                animationIterationCount: "infinite",
                animationTimingFunction: "linear",
                filter: "blur(1px) drop-shadow(0 0 5px rgba(249, 115, 22, 0.9))"
              }}
            />
          ))}
        </div>

        {/* Ambient Warm Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,88,12,0.08),transparent_70%)] pointer-events-none" />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-orange-600/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Logo Container with Custom Animated Glow */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="relative mb-6 h-64 w-64 rounded-full overflow-hidden border-4 border-orange-500/20 bg-[#140A03] p-1 shadow-2xl animate-pulse-glow">
            <Image
              src="/logo.png"
              alt="JD Sekuwa House Logo"
              fill
              priority
              className="rounded-full object-cover"
            />
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            JD Sekuwa House
          </h2>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-[2px] w-8 bg-gradient-to-r from-transparent to-orange-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-orange-400/90">
              Charcoal Grilled Culinary Art
            </span>
            <span className="h-[2px] w-8 bg-gradient-to-l from-transparent to-orange-500" />
          </div>
          <p className="mt-4 max-w-sm text-sm text-zinc-400/80 leading-relaxed">
            Welcome to the Restaurant Management Portal. Securely log in to manage inventory, tables, rooms, and billing schedules.
          </p>
        </div>
        
        {/* Footnote */}
        <div className="absolute bottom-6 left-6 z-10 text-[10px] uppercase tracking-widest text-zinc-600">
          &copy; {new Date().getFullYear()} JD Sekuwa House. All rights reserved.
        </div>
      </div>

      {/* RIGHT COLUMN: Clean Login Gating Section */}
      <div className="relative flex w-full flex-col justify-center px-6 py-12 md:w-[45%] lg:px-16 bg-[#FDFDFD]">
        
        {/* Mobile Header (visible only on mobile) */}
        <div className="mb-10 flex flex-col items-center text-center md:hidden">
          <div className="relative mb-4 h-24 w-24 rounded-full border-2 border-orange-500/20 p-1 shadow-xl bg-[#140A03]">
            <Image
              src="/logo.png"
              alt="JD Sekuwa House Logo"
              fill
              className="rounded-full object-cover"
            />
          </div>
          <h1 className="bg-gradient-to-r from-orange-600 via-red-500 to-yellow-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            JD Sekuwa RMS
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Restaurant Management System &bull; Portal
          </p>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">
            Sign In
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Enter your credentials to access the portal dashboard.
          </p>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md self-center md:self-auto">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition duration-200 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-4 pr-12 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition duration-200 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 outline-none transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-orange-600 to-yellow-500 py-3 text-sm font-semibold text-white shadow-md shadow-orange-500/10 transition duration-200 hover:from-orange-500 hover:to-yellow-400 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
