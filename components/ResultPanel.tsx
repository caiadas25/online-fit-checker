"use client";

interface Usage {
  requests: number;
  totalTokens: number;
  mocked: boolean;
}

interface Props {
  image: string | null;
  usage: Usage | null;
  loading: boolean;
  error: string | null;
  hasGarments: boolean;
}

function download(image: string) {
  const a = document.createElement("a");
  a.href = image;
  a.download = image.startsWith("data:image/svg") ? "fit-check.svg" : "fit-check.png";
  a.click();
}

function UsageNote({ usage }: { usage: Usage }) {
  const tokenLabel = usage.totalTokens
    ? `~${usage.totalTokens.toLocaleString()} tokens`
    : null;
  return (
    <div className="w-full max-w-md rounded-lg bg-gray-50 px-4 py-3 text-center text-xs text-gray-500">
      <p className="font-medium text-gray-700">
        This test used {usage.requests} API request{usage.requests === 1 ? "" : "s"}
        {usage.mocked ? " (estimated — mock mode)" : ""}
        {tokenLabel ? ` · ${tokenLabel}` : ""}
      </p>
      <p className="mt-1">
        Rate limits count requests, and these fire back-to-back, so a {usage.requests}-item outfit
        spends {usage.requests} of your per-minute allowance at once.{" "}
        <a
          href="https://aistudio.google.com/rate-limit"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700"
        >
          Check your live quota
        </a>
        .
      </p>
    </div>
  );
}

export default function ResultPanel({ image, usage, loading, error, hasGarments }: Props) {
  return (
    <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-2xl border border-black/10 bg-gradient-to-b from-gray-50 to-white p-6">
      {loading ? (
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          <p className="text-sm">Dressing the model… this can take up to a minute.</p>
        </div>
      ) : error ? (
        <p className="max-w-sm text-center text-sm text-red-600">{error}</p>
      ) : image ? (
        <div className="flex w-full flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt="Outfit on model"
            className="max-h-[32rem] rounded-xl border border-black/5 object-contain shadow"
          />
          <button
            onClick={() => download(image)}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download image
          </button>
          {usage && <UsageNote usage={usage} />}
        </div>
      ) : (
        <p className="max-w-xs text-center text-sm text-gray-400">
          {hasGarments
            ? 'Click "Generate outfit" to see your items on the model.'
            : "Add some clothing items to get started."}
        </p>
      )}
    </div>
  );
}
