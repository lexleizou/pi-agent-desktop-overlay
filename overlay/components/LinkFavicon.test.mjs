import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const { LinkFavicon, faviconHost, faviconSources } = await jiti.import("./LinkFavicon.tsx");
const { MarkdownBody } = await jiti.import("./MarkdownBody.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");

function renderMarkdown(markdown, props = {}) {
  return renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(MarkdownBody, {
        cwd: "/home/me/project",
        onOpenFile() {},
        ...props,
      }, markdown),
    ),
  );
}

test("faviconHost returns the host of http(s) links only", () => {
  assert.equal(faviconHost("https://github.com/Ephemeral-AI-Lab/layerfs"), "github.com");
  assert.equal(faviconHost("http://example.com/a?b=1#c"), "example.com");
  assert.equal(faviconHost("https://raw.githubusercontent.com/a/b/main/c.ts"), "raw.githubusercontent.com");
  // A non-ASCII host is sent to the icon service as punycode, which is what
  // `new URL` already does for us.
  assert.equal(faviconHost("https://用户.中国/路径"), "xn--zouo53b.xn--fiqs8s");
});

test("faviconHost skips everything that is not a web page", () => {
  for (const href of [
    "components/MarkdownBody.tsx",
    "file:///home/me/project/report.html",
    "mailto:someone@example.com",
    "tel:+8613800000000",
    "#section",
    "javascript:alert(1)",
    "vscode://file/tmp/a.ts",
    "",
  ]) {
    assert.equal(faviconHost(href), null, href);
  }
  assert.equal(faviconHost(undefined), null);
  assert.equal(faviconHost(null), null);
});

test("faviconHost skips hosts that cannot have an icon", () => {
  assert.equal(faviconHost("http://localhost:4321/preview"), null);
  assert.equal(faviconHost("http://127.0.0.1:8000/api"), null);
  assert.equal(faviconHost("http://192.168.1.10/admin"), null);
  assert.equal(faviconHost("http://[::1]:3000/"), null);
});

test("faviconSources tries DuckDuckGo first and Google second", () => {
  const sources = faviconSources("github.com");
  assert.equal(sources.length, 2);
  assert.match(sources[0], /^https:\/\/icons\.duckduckgo\.com\/ip3\/github\.com\.ico$/);
  assert.match(sources[1], /^https:\/\/www\.google\.com\/s2\/favicons\?domain=github\.com&sz=64$/);
});

test("LinkFavicon renders one lazy, decorative image for a web link", () => {
  const html = renderToStaticMarkup(React.createElement(LinkFavicon, { href: "https://github.com/a/b" }));

  assert.match(html, /^<span class="md-link-favicon" aria-hidden="true"><img /);
  assert.match(html, /src="https:\/\/icons\.duckduckgo\.com\/ip3\/github\.com\.ico"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /referrerPolicy="no-referrer"/i);
  assert.match(html, /alt=""/);
});

test("LinkFavicon renders nothing for a non-web href", () => {
  for (const href of [undefined, "", "mailto:a@b.com", "components/x.tsx", "file:///tmp/a.html"]) {
    assert.equal(renderToStaticMarkup(React.createElement(LinkFavicon, { href })), "", String(href));
  }
});

test("markdown links keep upstream's anchor markup and gain a sibling mark", () => {
  const html = renderMarkdown("[docs](https://example.com/docs)");

  // Upstream contract: the anchor itself is unchanged, so the em dash of link
  // tests that match `>text</a>` in MarkdownBody.test.mjs still hold.
  assert.match(
    html,
    /<a (?=[^>]*href="https:\/\/example\.com\/docs")(?=[^>]*target="_blank")(?=[^>]*rel="noopener noreferrer")[^>]*>docs<\/a>/,
  );
  // …and the mark comes before it, not inside it.
  assert.match(
    html,
    /<span class="md-link-favicon" aria-hidden="true"><img [^>]*icons\.duckduckgo\.com\/ip3\/example\.com\.ico[^>]*><\/span><a /,
  );
});

test("bare autolinks get a mark too, local file links do not", () => {
  const autolink = renderMarkdown("看 https://github.com/abcwyc/pi-agent-desktop/issues/48 这里");
  assert.match(autolink, /<span class="md-link-favicon"[^>]*>.*<\/span><a [^>]*href="https:\/\/github\.com\/abcwyc\/pi-agent-desktop\/issues\/48"/);

  const local = renderMarkdown("[file](components/MarkdownBody.tsx)");
  assert.doesNotMatch(local, /md-link-favicon/);
  assert.match(local, /<a href="components\/MarkdownBody\.tsx">file<\/a>/);

  const fileUrl = renderMarkdown("[report](file:///home/me/project/report.html)");
  assert.doesNotMatch(fileUrl, /md-link-favicon/);
  assert.match(fileUrl, /<a href="file:\/\/\/home\/me\/project\/report\.html">report<\/a>/);
});

test("links without an in-app file handler still get their mark", () => {
  const html = renderMarkdown("[docs](https://example.com/docs)", { onOpenFile: undefined });

  assert.match(html, /<span class="md-link-favicon"[^>]*>/);
  assert.match(html, /<a href="https:\/\/example\.com\/docs" target="_blank" rel="noopener noreferrer">docs<\/a>/);
});
