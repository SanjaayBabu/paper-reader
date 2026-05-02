import UploadArea from "@/components/UploadArea";
import { BookOpen, Network, Quote } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm px-6 py-4 flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-indigo-600" />
        <span className="font-semibold text-slate-800 tracking-tight">PaperReader</span>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl w-full text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-4">
            Read papers{" "}
            <span className="text-indigo-600">without the noise</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-lg mx-auto">
            Upload a research paper PDF. We&apos;ll move every in-text citation to a
            footnote so you can read the prose uninterrupted — and show you the
            full citation network.
          </p>
        </div>

        <UploadArea />

        {/* Feature pills */}
        <div className="mt-16 flex flex-wrap justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Quote className="w-4 h-4 text-indigo-400" />
            <span>Citations moved to footnotes</span>
          </div>
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-violet-400" />
            <span>Interactive citation graph</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Clean, readable typography</span>
          </div>
        </div>
      </section>
    </main>
  );
}
