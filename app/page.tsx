"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const stats = [
  { value: "01", label: "Paste links" },
  { value: "02", label: "Stack the fit" },
  { value: "03", label: "Buy with proof" },
];

const closetItems = ["coral polo", "denim jacket", "olive culottes", "white sandals"];

const drops = ["Paste", "Upload", "Layer", "Generate"];

const howItWorks = [
  {
    number: "01",
    title: "Drop in the pieces",
    text: "Paste product links from stores or upload screenshots from your camera roll.",
  },
  {
    number: "02",
    title: "Tell FitMashr what each item is",
    text: "Tag tops, bottoms, shoes, jackets, dresses, and accessories so layers land in the right order.",
  },
  {
    number: "03",
    title: "Generate one full outfit",
    text: "FitMashr mashes the pieces together and builds a single model preview with the whole fit.",
  },
  {
    number: "04",
    title: "Compare, save, decide",
    text: "Download the result, share it with the group chat, or swap a piece before you buy.",
  },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("success");
      setMessage(data.message);
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f4ec] text-[#151515]">
      <section className="relative isolate px-4 pb-6 pt-5 sm:px-6 lg:px-8 lg:pb-8">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(120deg,#f8f4ec_0%,#f8f4ec_42%,#f6ff70_42%,#f6ff70_58%,#ff6bb5_58%,#ff6bb5_72%,#62d8ff_72%,#62d8ff_100%)] opacity-25" />

        <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-full border-2 border-[#151515] bg-[#fffaf0]/90 px-4 py-3 shadow-[6px_6px_0_#151515]">
          <Link href="/" className="text-lg font-black tracking-tight">
            FitMashr
          </Link>
          <div className="hidden items-center gap-2 text-xs font-bold uppercase sm:flex">
            {drops.map((drop) => (
              <span
                key={drop}
                className="rounded-full border border-[#151515]/20 bg-white px-3 py-1"
              >
                {drop}
              </span>
            ))}
          </div>
          <Link
            href="#waitlist"
            className="rounded-full border-2 border-[#151515] bg-[#151515] px-4 py-2 text-sm font-black text-white transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#ff6bb5]"
          >
            Join waitlist
          </Link>
        </nav>

        <div className="mx-auto grid max-w-7xl gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.86fr)] lg:items-center lg:pt-8">
          <div>
            <div className="inline-flex rotate-[-1deg] items-center gap-2 rounded-full border-2 border-[#151515] bg-[#f6ff70] px-4 py-2 text-xs font-black uppercase shadow-[4px_4px_0_#151515]">
              AI fit checks before cart regret
            </div>
            <h1 className="mt-6 max-w-4xl text-6xl font-black leading-[0.9] tracking-normal text-[#151515] sm:text-7xl lg:text-[5.25rem]">
              Stop guessing. Start mashing the whole look.
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-[#39352f] sm:text-xl">
              Paste clothes from any store, mash them into one outfit, and see the fit on a model
              before your cart starts acting delusional.
            </p>

            <form
              id="waitlist"
              onSubmit={handleSubmit}
              className="mt-8 max-w-2xl rounded-[2rem] border-2 border-[#151515] bg-white p-2 shadow-[8px_8px_0_#151515]"
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === "error") setStatus("idle");
                  }}
                  placeholder="drop your email"
                  required
                  className="min-h-14 min-w-0 flex-1 rounded-[1.4rem] border-0 bg-[#f4f1ea] px-5 text-base font-bold text-[#151515] outline-none placeholder:text-[#746f67] focus:ring-2 focus:ring-[#151515]"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="min-h-14 shrink-0 rounded-[1.4rem] bg-[#ff6bb5] px-6 text-base font-black text-[#151515] transition hover:bg-[#f6ff70] disabled:opacity-55"
                >
                  {status === "loading" ? "Joining..." : "Get the drop"}
                </button>
              </div>
              {message && (
                <p
                  className={`px-3 pt-3 text-sm font-bold ${
                    status === "success" ? "text-[#13795b]" : "text-[#bf1f46]"
                  }`}
                >
                  {message}
                </p>
              )}
            </form>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="#waitlist"
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-[#151515] bg-[#151515] px-6 text-sm font-black text-white shadow-[4px_4px_0_#62d8ff] transition hover:-translate-y-0.5"
              >
                Join waitlist
              </Link>
              <p className="text-sm font-bold text-[#514c44]">
                No spam. One invite when FitMashr is ready to cook.
              </p>
            </div>

            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
              {stats.map((stat) => (
                <div
                  key={stat.value}
                  className="border-t-2 border-[#151515] pt-3"
                >
                  <p className="font-mono text-sm font-black">{stat.value}</p>
                  <p className="mt-1 text-sm font-black uppercase leading-5 text-[#39352f]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <FitPreview />
        </div>
      </section>

      <section className="border-y-2 border-[#151515] bg-[#151515] px-4 py-4 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-black uppercase tracking-normal">
          <span>Store links</span>
          <span className="text-[#f6ff70]">Upload pics</span>
          <span>Layer pieces</span>
          <span className="text-[#62d8ff]">One model</span>
          <span className="text-[#ff6bb5]">Zero cart anxiety</span>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-6">
            <div className="inline-flex rotate-[-1deg] rounded-full border-2 border-[#151515] bg-[#62d8ff] px-4 py-2 text-xs font-black uppercase shadow-[4px_4px_0_#151515]">
              How it works
            </div>
            <h2 className="mt-4 max-w-xl text-4xl font-black leading-[0.95] sm:text-5xl">
              From cart chaos to one slay-or-nay fit check.
            </h2>
            <p className="mt-4 max-w-lg text-base font-bold leading-7 text-[#39352f]">
              FitMashr is built for the messy way people actually shop: half browser tabs,
              half screenshots, and one outfit idea that needs receipts.
            </p>
            <Link
              href="#waitlist"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full border-2 border-[#151515] bg-[#151515] px-6 text-sm font-black text-white shadow-[4px_4px_0_#ff6bb5] transition hover:-translate-y-0.5"
            >
              Join waitlist
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {howItWorks.map((step) => (
              <article
                key={step.number}
                className="min-h-48 border-2 border-[#151515] bg-[#fffaf0] p-5 shadow-[7px_7px_0_#151515]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-black">{step.number}</span>
                  <span className="rounded-full bg-[#f6ff70] px-3 py-1 text-[11px] font-black uppercase">
                    mash step
                  </span>
                </div>
                <h3 className="mt-6 text-2xl font-black leading-7">{step.title}</h3>
                <p className="mt-3 text-sm font-bold leading-6 text-[#39352f]">
                  {step.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          <Feature
            title="Fit before the feed sees it"
            text="Preview the whole outfit together, not as four lonely product shots."
            color="bg-[#62d8ff]"
          />
          <Feature
            title="For chaotic carts"
            text="Mix thrift finds, store links, uploads, and almost-buys in one place."
            color="bg-[#f6ff70]"
          />
          <Feature
            title="Screenshot-level receipts"
            text="Make the decision with a visual you can save, send, and compare."
            color="bg-[#ff6bb5]"
          />
        </div>
      </section>

      <footer className="px-4 pb-8 text-center text-xs font-bold text-[#746f67]">
        © {new Date().getFullYear()} FitMashr
      </footer>
    </main>
  );
}

function FitPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="absolute -left-3 top-24 z-20 rotate-[-6deg] rounded-2xl border-2 border-[#151515] bg-[#f6ff70] px-4 py-3 text-sm font-black shadow-[5px_5px_0_#151515] sm:-left-8 lg:top-28">
        cart mood: confirmed
      </div>
      <div className="absolute -bottom-3 -right-2 z-20 rotate-[5deg] rounded-2xl border-2 border-[#151515] bg-[#62d8ff] px-4 py-3 text-sm font-black shadow-[5px_5px_0_#151515] sm:-right-8">
        4 pieces synced
      </div>

      <div className="relative rounded-[2rem] border-2 border-[#151515] bg-[#fffaf0] p-4 shadow-[12px_12px_0_#151515]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase text-[#746f67]">Live preview</p>
            <p className="text-xl font-black">Weekend cart stack</p>
          </div>
          <div className="rounded-full border-2 border-[#151515] bg-[#ff6bb5] px-3 py-1 text-xs font-black">
            AI
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <div className="relative overflow-hidden rounded-[1.4rem] border-2 border-[#151515] bg-[#f4f1ea]">
            <div className="absolute inset-x-0 top-0 z-10 flex justify-center">
              <span className="rounded-b-2xl border-x-2 border-b-2 border-[#151515] bg-white px-4 py-2 text-xs font-black">
                before you buy
              </span>
            </div>
            <Image
              src="/landing-fit-preview-clean.png"
              alt="FitMashr outfit composite preview"
              width={864}
              height={1184}
              priority
              className="h-[360px] w-full bg-white object-contain"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            {closetItems.map((item, index) => (
              <div
                key={item}
                className="min-h-20 rounded-2xl border-2 border-[#151515] bg-white p-3 shadow-[3px_3px_0_#151515]"
              >
                <p className="font-mono text-xs font-black text-[#746f67]">
                  0{index + 1}
                </p>
                <p className="mt-2 text-sm font-black leading-4">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black uppercase">
          <span className="rounded-full bg-[#151515] px-3 py-2 text-white">link</span>
          <span className="rounded-full bg-[#f6ff70] px-3 py-2">layer</span>
          <span className="rounded-full bg-[#ff6bb5] px-3 py-2">mash</span>
        </div>
      </div>
    </div>
  );
}

function Feature({
  title,
  text,
  color,
}: {
  title: string;
  text: string;
  color: string;
}) {
  return (
    <article className={`${color} min-h-48 border-2 border-[#151515] p-6 shadow-[7px_7px_0_#151515]`}>
      <p className="text-xs font-black uppercase text-[#151515]/70">Why it hits</p>
      <h2 className="mt-4 text-2xl font-black leading-7">{title}</h2>
      <p className="mt-4 text-sm font-bold leading-6 text-[#2a2824]">{text}</p>
    </article>
  );
}
