// Lazy-load highlight.js from cdnjs. Shared across all CodeBlock instances.
let loadPromise: Promise<any> | null = null;

const CDN_BASE = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0";
const LANGS = ["javascript", "css", "xml", "json"];

export function loadHighlightJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if ((window as any).hljs) return Promise.resolve((window as any).hljs);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // CSS theme
    if (!document.getElementById("hljs-theme")) {
      const link = document.createElement("link");
      link.id = "hljs-theme";
      link.rel = "stylesheet";
      link.href = `${CDN_BASE}/styles/atom-one-dark.min.css`;
      document.head.appendChild(link);
    }

    const core = document.createElement("script");
    core.src = `${CDN_BASE}/highlight.min.js`;
    core.async = true;
    core.onload = async () => {
      try {
        await Promise.all(
          LANGS.map(
            l =>
              new Promise<void>((res, rej) => {
                const s = document.createElement("script");
                s.src = `${CDN_BASE}/languages/${l}.min.js`;
                s.async = true;
                s.onload = () => res();
                s.onerror = () => rej(new Error(`Failed loading ${l}`));
                document.head.appendChild(s);
              }),
          ),
        );
        resolve((window as any).hljs);
      } catch (e) {
        reject(e);
      }
    };
    core.onerror = () => reject(new Error("Failed loading highlight.js"));
    document.head.appendChild(core);
  });
  return loadPromise;
}

export function normalizeLang(lang?: string | null): string {
  const l = (lang || "").toLowerCase();
  if (l === "html") return "xml";
  if (l === "js" || l === "javascript") return "javascript";
  if (l === "css") return "css";
  if (l === "json") return "json";
  if (l === "liquid") return "xml"; // close-enough highlighting
  return "plaintext";
}
