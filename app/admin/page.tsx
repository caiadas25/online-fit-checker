"use client";

import { useEffect, useState } from "react";

interface Entry {
  email: string;
  subscribedAt: string | null;
}

export default function AdminPage() {
  const [count, setCount] = useState<number | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/waitlist/admin")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCount(data.count);
        setEntries(data.entries);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Lookloop Waitlist</h1>

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
