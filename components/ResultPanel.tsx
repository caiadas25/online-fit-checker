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
        This test used {usage.requests} image request{usage.requests === 1 ? "" : "s"}
        {usage.mocked ? " (estimated — mock mode, no real call made)" : ""}
        {tokenLabel ? ` · ${tokenLabel}` : ""}
      </p>
      <p className="mt-1">
        {usage.mocked
          ? "Mock mode makes no real API calls and costs nothing."
          : `Gemini 2.5 Flash Image has no free tier — each image bills about $0.039, so this generation cost roughly $${(usage.requests * 0.039).toFixed(2)}.`}
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
        error.startsWith("BILLING_REQUIRED:") ? (
          <div className="max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="text-sm font-semibold text-amber-900">Gemini billing required</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-800">
              The image model (Gemini 2.5 Flash Image) has no free tier, so real generation needs
              billing enabled on your Google AI Studio / Cloud project. It&apos;s pay-as-you-go at
              about <span className="font-medium">$0.039 per image</span>.
            </p>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800"
            >
              Enable billing in AI Studio
            </a>
          </div>
        ) : (
          <p className="max-w-sm text-center text-sm text-red-600">{error}</p>
        )
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
