"use client";

import { useEffect, useState } from "react";
import type { ContentBlock } from "@/types";

interface Props {
  blocks: ContentBlock[];
}

export default function TableOfContents({ blocks }: Props) {
  const headings = blocks.filter((b) => b.type === "heading");
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0) return;

    // Use the bounded scroll container (data-scroll-root) as the IntersectionObserver
    // root so scroll-spy works relative to the actual scrolling element, not the viewport.
    const scrollRoot =
      document.querySelector<HTMLElement>("[data-scroll-root]") ?? null;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root: scrollRoot,
        rootMargin: "-8px 0px -60% 0px",
        threshold: 0,
      }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headings.map((h) => h.id).join(",")]);

  if (headings.length === 0) return null;

  function scrollTo(id: string) {
    const scrollRoot = document.querySelector<HTMLElement>("[data-scroll-root]");
    const el = document.getElementById(id);
    if (el && scrollRoot) {
      // Scroll within the bounded container, not the page
      const elTop = el.getBoundingClientRect().top;
      const rootTop = scrollRoot.getBoundingClientRect().top;
      scrollRoot.scrollBy({ top: elTop - rootTop - 16, behavior: "smooth" });
    } else if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    // self-start + sticky top-6: the nav takes its natural height and sticks
    // to the top of the scroll container as the user reads down.
    <nav className="w-56 shrink-0 hidden lg:block self-start sticky top-6">
      <div className="max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3 px-2">
          Contents
        </p>
        <ul className="space-y-0.5">
          {headings.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => scrollTo(h.id)}
                className={`
                  w-full text-left rounded px-2 py-1.5 text-sm leading-snug transition-colors
                  ${h.level === 3 ? "pl-5" : ""}
                  ${
                    activeId === h.id
                      ? "text-indigo-700 bg-indigo-50 font-medium"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }
                `}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
