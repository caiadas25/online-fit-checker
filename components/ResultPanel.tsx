"use client";

interface Usage {
  requests: number;
  totalTokens: number;
  costUsd: number | null;
  modelLabel: string;
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
    <div className="w-full max-w-md rounded-2xl border-2 border-[#151515] bg-[#f6ff70] px-4 py-3 text-center text-xs font-bold text-[#39352f]">
      <p className="font-black text-[#151515]">
        {usage.modelLabel} · {usage.requests} image request{usage.requests === 1 ? "" : "s"}
        {usage.mocked ? " (mock mode, no real call made)" : ""}
        {tokenLabel ? ` · ${tokenLabel}` : ""}
      </p>
      <p className="mt-1">
        {usage.mocked
          ? "Mock mode makes no real API calls and costs nothing."
          : usage.costUsd != null
            ? `Billed to your OpenRouter credits: about $${usage.costUsd.toFixed(4)} this generation.`
            : "Billed to your OpenRouter credits for the selected model."}
      </p>
    </div>
  );
}

export default function ResultPanel({ image, usage, loading, error, hasGarments }: Props) {
  return (
    <section className="relative flex min-h-[38rem] flex-col items-center justify-center rounded-[2rem] border-2 border-[#151515] bg-[#fffaf0] p-4 shadow-[10px_10px_0_#151515] sm:p-6">
      <div className="absolute left-5 top-5 rounded-full border-2 border-[#151515] bg-[#62d8ff] px-3 py-1 text-xs font-black uppercase">
        Fit preview
      </div>
      {loading ? (
        <div className="flex flex-col items-center gap-4 text-center text-[#39352f]">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#f6ff70] border-t-[#151515]" />
          <p className="max-w-xs text-sm font-black">
            Dressing the model... this can take up to a minute.
          </p>
        </div>
      ) : error ? (
        error.startsWith("BILLING_REQUIRED:") ? (
          <div className="max-w-sm rounded-2xl border-2 border-[#151515] bg-[#f6ff70] p-5 text-center shadow-[5px_5px_0_#151515]">
            <p className="text-sm font-black text-[#151515]">Out of OpenRouter credits</p>
            <p className="mt-2 text-xs font-bold leading-relaxed text-[#39352f]">
              This generation was rejected because your OpenRouter balance can&apos;t cover the
              selected model. Top up your credits (or pick a cheaper model) and try again.
            </p>
            <a
              href="https://openrouter.ai/credits"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-full border-2 border-[#151515] bg-[#151515] px-4 py-2 text-xs font-black text-white hover:bg-[#ff6bb5] hover:text-[#151515]"
            >
              Manage OpenRouter credits
            </a>
          </div>
        ) : (
          <p className="max-w-sm rounded-2xl border-2 border-[#151515] bg-[#ff6bb5] p-4 text-center text-sm font-black text-[#151515] shadow-[5px_5px_0_#151515]">
            {error}
          </p>
        )
      ) : image ? (
        <div className="flex w-full flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt="Outfit on model"
            className="max-h-[36rem] rounded-[1.4rem] border-2 border-[#151515] bg-white object-contain shadow-[6px_6px_0_#151515]"
          />
          <button
            onClick={() => download(image)}
            className="rounded-full border-2 border-[#151515] bg-[#151515] px-5 py-2 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#62d8ff] hover:text-[#151515]"
          >
            Download image
          </button>
          {usage && <UsageNote usage={usage} />}
        </div>
      ) : (
        <div className="w-full max-w-md rounded-[1.5rem] border-2 border-dashed border-[#151515] bg-white/80 px-6 py-12 text-center">
          <p className="text-5xl font-black leading-none">?</p>
          <p className="mt-4 text-lg font-black text-[#151515]">
            {hasGarments ? "Ready for the reveal." : "No fit yet."}
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-[#746f67]">
            {hasGarments
              ? 'Click "Generate fit" to see your items on the model.'
              : "Add clothing items to start building the preview."}
          </p>
        </div>
      )}
    </section>
  );
}
