"use client";

import { useEffect } from "react";

// Toggles `.is-scrolled` on the .k-shell wrapper once the user has
// scrolled past ~40% of the first viewport. The CSS uses that class to
// slide the top nav into view and fade out the scroll cue.
export function ScrollState() {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".k-shell");
    if (!shell) return;

    const update = () => {
      const threshold = window.innerHeight * 0.4;
      shell.classList.toggle("is-scrolled", window.scrollY > threshold);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return null;
}
