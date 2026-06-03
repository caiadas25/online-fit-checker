"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Entry {
  email: string;
  subscribedAt: string | null;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWaitlist = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/waitlist/admin");
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to load waitlist.");
      setCount(data.count);
      setEntries(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load waitlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((data) => {
        const isAuthenticated = Boolean(data.authenticated);
        setAuthenticated(isAuthenticated);
        if (isAuthenticated) void loadWaitlist();
      })
      .catch(() => setAuthenticated(false));
  }, [loadWaitlist]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      setPassword("");
      setAuthenticated(true);
      await loadWaitlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setAuthenticated(false);
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setCount(null);
    setEntries([]);
  }

  if (authenticated === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-gray-500">Checking session...</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900">Admin sign in</h1>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-gray-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-lg border border-black/15 px-3 text-sm text-gray-900 outline-none focus:border-gray-900"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-lg bg-gray-900 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">FitMashr Waitlist</h1>
        <div className="flex items-center gap-3">
          <Link href="/try" className="text-sm font-semibold text-gray-900 underline">
            Open try-on
          </Link>
          <button type="button" onClick={handleLogout} className="text-sm text-gray-500">
            Log out
          </button>
        </div>
      </div>

      {loading && <p className="mt-4 text-sm text-gray-500">Loading…</p>}
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {!loading && !error && (
        <>
          <p className="mt-3 text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{count}</span> email
            {count !== 1 ? "s" : ""} on the list
          </p>

          {entries.length === 0 ? (
            <p className="mt-6 text-sm text-gray-400">No entries yet.</p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-black/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-black/10 bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 font-medium text-gray-500">#</th>
                    <th className="px-4 py-2 font-medium text-gray-500">Email</th>
                    <th className="px-4 py-2 font-medium text-gray-500">Signed up</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={e.email} className="border-b border-black/5 last:border-0">
                      <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2 text-gray-900">{e.email}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {e.subscribedAt
                          ? new Date(e.subscribedAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
