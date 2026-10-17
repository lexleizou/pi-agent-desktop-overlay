/**
 * ZoomShortcuts — ⌘+ / ⌘- / ⌘0 keyboard zoom for the chat area and the sidebar.
 *
 * Folder: components/ZoomShortcuts.tsx (new file — no upstream file touched)
 *
 * Why these two areas and not a blanket page zoom: the chat column already owns
 * a font-size setting (`useChatAppearance` → `--chat-content-font-size`, the
 * Settings → Chat "content font size" slider, 12–24px) and the sidebar is drawn
 * from the UI size tokens (`--fs-body` … `--fs-micro`). Driving those two means
 * the shortcut and the existing controls stay in agreement — moving the slider
 * updates the zoom level and pressing ⌘+ moves the slider, because both write
 * the same store and the same localStorage key.
 *
 * The sidebar factor is scoped: `bui-overlay.css` re-declares the `--fs-*`
 * tokens inside `.app-sidebar`, so the rest of the chrome keeps its own sizes.
 *
 * Steps are deliberately the same as the slider's (1px of chat text, 5% of
 * sidebar scale) so repeated presses land on the values the UI can show.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHAT_CONTENT_FONT_SIZE_DEFAULT,
  CHAT_CONTENT_FONT_SIZE_MAX,
  CHAT_CONTENT_FONT_SIZE_MIN,
  useChatAppearance,
} from "@/hooks/useChatAppearance";

const SIDEBAR_SCALE_STORAGE_KEY = "pi-sidebar-scale";
export const SIDEBAR_SCALE_DEFAULT = 1;
export const SIDEBAR_SCALE_MIN = 0.9;
export const SIDEBAR_SCALE_MAX = 1.3;
const SIDEBAR_SCALE_STEP = 0.05;

/** Quantise to the step so repeated presses cannot drift (0.9500000001). */
function clampSidebarScale(value: unknown): number {
  // Number(null) is 0 and Number("") is 0, so an unset preference would clamp
  // to the minimum instead of the default. Rule those out first.
  if (value === null || value === undefined || value === "") return SIDEBAR_SCALE_DEFAULT;
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale <= 0) return SIDEBAR_SCALE_DEFAULT;
  const stepped = Math.round(scale / SIDEBAR_SCALE_STEP) * SIDEBAR_SCALE_STEP;
  return Math.min(SIDEBAR_SCALE_MAX, Math.max(SIDEBAR_SCALE_MIN, Number(stepped.toFixed(2))));
}

function applySidebarScale(scale: number): void {
  document.documentElement.style.setProperty("--sidebar-scale", String(scale));
}

function readStoredSidebarScale(): number {
  try {
    return clampSidebarScale(window.localStorage.getItem(SIDEBAR_SCALE_STORAGE_KEY));
  } catch {
    return SIDEBAR_SCALE_DEFAULT;
  }
}

function writeSidebarScale(scale: number): void {
  try {
    window.localStorage.setItem(SIDEBAR_SCALE_STORAGE_KEY, String(scale));
  } catch {
    // Best-effort persistence; the in-memory value still applies.
  }
}

export function ZoomShortcuts() {
  const { fontSize, setFontSize } = useChatAppearance();
  const [sidebarScale, setSidebarScale] = useState(SIDEBAR_SCALE_DEFAULT);
  // The listener is installed once; read the live values through refs so it
  // does not have to be torn down and rebuilt on every step.
  const latest = useRef({ fontSize, sidebarScale });
  latest.current = { fontSize, sidebarScale };

  // Restore the stored sidebar scale on the first client render. The data
  // attribute is a cheap way to confirm from the DOM (or a test) that the
  // shortcut host actually mounted, since the component renders nothing.
  useEffect(() => {
    const stored = readStoredSidebarScale();
    setSidebarScale(stored);
    applySidebarScale(stored);
    document.documentElement.dataset.zoomShortcuts = "ready";
  }, []);

  const step = useCallback((direction: 1 | -1 | 0) => {
    const current = latest.current;
    const nextFontSize = direction === 0
      ? CHAT_CONTENT_FONT_SIZE_DEFAULT
      : Math.min(
          CHAT_CONTENT_FONT_SIZE_MAX,
          Math.max(CHAT_CONTENT_FONT_SIZE_MIN, current.fontSize + direction),
        );
    const nextScale = clampSidebarScale(
      direction === 0 ? SIDEBAR_SCALE_DEFAULT : current.sidebarScale + direction * SIDEBAR_SCALE_STEP,
    );
    if (nextFontSize !== current.fontSize) setFontSize(nextFontSize);
    if (nextScale !== current.sidebarScale) {
      setSidebarScale(nextScale);
      applySidebarScale(nextScale);
      writeSidebarScale(nextScale);
    }
  }, [setFontSize]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // ⌘ on macOS, Ctrl elsewhere. Alt is part of other shortcuts (⌥⌘…), so a
      // zoom chord never carries it, and an IME composition never triggers one.
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.isComposing || event.keyCode === 229) return;

      let direction: 1 | -1 | 0 | null = null;
      if (event.key === "=" || event.key === "+") direction = 1;
      else if (event.key === "-" || event.key === "_") direction = -1;
      else if (event.key === "0") direction = 0;
      if (direction === null) return;

      // Take the key: the WebView must not scroll, and nothing downstream
      // should see a half-handled chord.
      event.preventDefault();
      event.stopPropagation();
      step(direction);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [step]);

  return null;
}
