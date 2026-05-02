"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ParseApiResponse } from "@/types";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export default function UploadArea() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("File is too large. Maximum size is 20 MB.");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to parse PDF.");
        return;
      }

      const result: ParseApiResponse = json;
      if (typeof window !== "undefined") {
        sessionStorage.setItem("paperReader:result", JSON.stringify(result));
      }
      router.push("/reader");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 p-12 text-center cursor-pointer
          ${isDragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50"}
          ${isLoading ? "pointer-events-none opacity-60" : ""}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onFileChange}
        />

        {isLoading ? (
          <div className="space-y-4">
            <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-600 font-medium">Parsing your paper…</p>
            <Progress className="h-1.5" value={null} />
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
              {isDragging ? (
                <FileText className="w-7 h-7 text-indigo-600" />
              ) : (
                <Upload className="w-7 h-7 text-indigo-500" />
              )}
            </div>
            <p className="text-slate-700 font-semibold text-lg mb-1">
              {isDragging ? "Drop to upload" : "Upload a research paper"}
            </p>
            <p className="text-slate-400 text-sm mb-5">
              Drag & drop a PDF, or click to browse
            </p>
            <Button variant="outline" className="pointer-events-none">
              Choose PDF
            </Button>
            <p className="text-slate-300 text-xs mt-4">Max 20 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
