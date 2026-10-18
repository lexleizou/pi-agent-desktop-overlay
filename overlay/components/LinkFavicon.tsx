/**
 * LinkFavicon — the site mark drawn in front of every web link in markdown.
 *
 * Folder: components/LinkFavicon.tsx (new file — no upstream file touched)
 *
 * Why a sibling element instead of a child of <a>
 * ----------------------------------------------
 * The icon is rendered as a `<span>` *before* the anchor, never inside it.
 * Two consequences, both deliberate:
 *
 *   1. The anchor's markup is byte-for-byte what upstream produces
 *      (`<a href=... target="_blank" rel="noopener noreferrer">text</a>`), so
 *      none of upstream's link tests — which match `>text</a>` — have to be
 *      rewritten. An overlay that edits upstream's test expectations gets
 *      conflicts for free on every upstream release.
 *   2. The icon never becomes part of the link's clickable text, so selecting
 *      or copying a link copies the text, not the image.
 *
 * Where the icon comes from
 * -------------------------
 * Two public favicon endpoints, tried in order, then nothing: DuckDuckGo's
 * icon service first (it returns the site's real icon at a usable size) and
 * Google's `s2` service second (same call shape as ChatGPT/Codex). Both are
 * plain `<img>` requests over https, which the desktop build's CSP already
 * allows (`img-src 'self' data: blob: http://127.0.0.1:* https:`). Nothing is
 * proxied through the app, so the browser's own cache does the work: one
 * request per host per session, not one per link.
 *
 * Trade-off worth stating out loud: the request carries the hostname to a
 * third party. That is the same trade ChatGPT makes for the same effect. If
 * that ever becomes unacceptable, the fix is one entry in `faviconSources` —
 * a self-hosted endpoint — not a change to the layout.
 *
 * Only http(s) links get an icon. `mailto:`, `tel:`, fragments, relative
 * paths, `file://` links and VSCode-style schemes resolve to no host and
 * render nothing, so local-file links (which the app opens in its own viewer)
 * keep exactly the look they had.
 */
"use client";

import { useState } from "react";

/** Hosts that never have a meaningful favicon: loopback and bare IPs. */
const SKIP_HOSTS = /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|\[?::1\]?)$/i;

/**
 * The host whose favicon should stand in front of `href`, or null when the
 * href is not a web URL. Exported for tests; the component is the only caller.
 */
export function faviconHost(href: string | undefined | null): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    // Relative path, bare fragment, or anything else with no scheme.
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname;
  if (!host || SKIP_HOSTS.test(host)) return null;
  // IPv6 arrives bracketed; a literal address has no icon service entry.
  if (host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  return host;
}

/** Icon endpoints for one host, in the order they are tried. */
export function faviconSources(host: string): string[] {
  return [
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
  ];
}

/**
 * A small site mark, or nothing at all: when every source fails the span is
 * removed rather than left as a blank gap, so a link with no icon looks
 * exactly like a link that never had one.
 */
export function LinkFavicon({ href }: { href?: string }) {
  const [attempt, setAttempt] = useState(0);
  const host = faviconHost(href);

  if (!host) return null;
  const sources = faviconSources(host);
  if (attempt >= sources.length) return null;

  return (
    <span className="md-link-favicon" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources[attempt]}
        alt=""
        width={16}
        height={16}
        loading="lazy"
        decoding="async"
        draggable={false}
        referrerPolicy="no-referrer"
        onError={() => setAttempt((current) => current + 1)}
      />
    </span>
  );
}
