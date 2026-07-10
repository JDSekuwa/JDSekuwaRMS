"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process request.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#FAFAFA] font-sans px-4 text-zinc-800 relative overflow-hidden">
      
      {/* Background Subtle Sparks/Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1C0D02]/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-orange-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-md rounded-card border border-zinc-200 bg-white p-8 shadow-xl relative z-10 space-y-6">
        
        {/* Header Branding Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4 h-20 w-20 rounded-full border-2 border-orange-500/20 p-1 shadow-md bg-[#140A03]">
            <Image
              src="/logo.png"
              alt="JD Sekuwa House Logo"
              fill
              className="rounded-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900">
            Reset Password
          </h2>
          <p className="mt-2 text-xs text-zinc-500 max-w-[280px]">
            Enter your email below and we will send you a secure link to reset your account credentials.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              <p className="font-bold">Reset Email Dispatched</p>
              <p className="mt-1 text-xs text-green-600">
                Please check your inbox at <strong className="font-semibold">{email}</strong>. Follow the instructions in the email to configure your new password.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs font-semibold text-orange-600 hover:text-orange-500 transition-colors pt-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to login page</span>
            </Link>
          </div>
        ) : (
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
                disabled={loading}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition duration-200 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-orange-600 to-yellow-500 py-3 text-sm font-semibold text-white shadow-md shadow-orange-500/10 transition duration-200 hover:from-orange-500 hover:to-yellow-400 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Sending link..." : "Send Reset Link"}
              </button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to login</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
