"use client";

interface Props {
  image: string | null;
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

export default function ResultPanel({ image, loading, error, hasGarments }: Props) {
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
