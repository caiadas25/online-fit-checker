"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function getNextPath(): string {
  if (typeof window === "undefined") return "/try";

  const requestedPath = new URLSearchParams(window.location.search).get("next");
  if (!requestedPath || !requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return "/try";
  }

  return requestedPath === "/tester" ? "/try" : requestedPath;
}

export default function TesterPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tester/session")
      .then((r) => r.json())
      .then((data) => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tester/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      setPassword("");
      setAuthenticated(true);
      window.location.href = getNextPath();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setAuthenticated(false);
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/tester/logout", { method: "POST" });
    setAuthenticated(false);
  }

  if (authenticated === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f4ec] px-4 text-[#151515]">
        <p className="text-sm font-bold text-[#746f67]">Checking session...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f4ec] px-4 py-6 text-[#151515] sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(120deg,#f8f4ec_0%,#f8f4ec_42%,#f6ff70_42%,#f6ff70_58%,#ff6bb5_58%,#ff6bb5_72%,#62d8ff_72%,#62d8ff_100%)] opacity-25" />

      <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-full border-2 border-[#151515] bg-[#fffaf0]/90 px-4 py-3 shadow-[6px_6px_0_#151515]">
        <Link href="/" className="text-lg font-black tracking-tight">
          FitMashr
        </Link>
        <span className="rounded-full border-2 border-[#151515] bg-[#f6ff70] px-4 py-2 text-xs font-black uppercase">
          Tester
        </span>
      </nav>

      <section className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-sm flex-col justify-center">
        <div className="rounded-[1.6rem] border-2 border-[#151515] bg-[#fffaf0] p-5 shadow-[7px_7px_0_#151515]">
          <h1 className="text-3xl font-black leading-tight">Tester sign in</h1>

          {authenticated ? (
            <div className="mt-6 space-y-4">
              <Link
                href="/try"
                className="flex min-h-12 items-center justify-center rounded-[1.2rem] border-2 border-[#151515] bg-[#ff6bb5] px-5 text-sm font-black shadow-[4px_4px_0_#151515] transition hover:-translate-y-0.5 hover:bg-[#f6ff70]"
              >
                Open fit lab
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-11 w-full rounded-[1.1rem] border-2 border-[#151515] bg-white px-5 text-sm font-black transition hover:bg-[#62d8ff]"
              >
                Log out
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <label className="block text-sm font-black text-[#39352f]" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-[1.1rem] border-2 border-[#151515] bg-white px-4 text-sm font-bold text-[#151515] outline-none focus:bg-[#f6ff70]/20"
                required
              />
              {error && <p className="text-sm font-bold text-[#bf1f46]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="min-h-12 w-full rounded-[1.2rem] border-2 border-[#151515] bg-[#ff6bb5] px-5 text-sm font-black shadow-[4px_4px_0_#151515] transition hover:-translate-y-0.5 hover:bg-[#f6ff70] disabled:translate-y-0 disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
