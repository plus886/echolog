// View Transitions API の最小型定義と capability check。
// lightbox の単発 morph (GalleryLightbox / QuoteImages) で共有する。

export type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished?: Promise<void>;
  };
};

export const supportsViewTransition = (): boolean =>
  typeof (document as ViewTransitionDocument).startViewTransition ===
  "function";
