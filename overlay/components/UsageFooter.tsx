"use client";

// Folder: components/UsageFooter.tsx (fork-owned, new file)
// Per-response usage line in the claude-mods statusline palette: token total
// in blue, cache hit in bold green (amber/red when it drops), cost in red,
// everything else muted. Colours live in cds-overlay.css (.usage-footer-*).

import { Fragment } from "react";
import { buildUsageFooter, type UsageLike } from "@/lib/usage-footer";

export function UsageFooter({ usage, durationMs }: { usage: UsageLike; durationMs?: number }) {
  const m = buildUsageFooter(usage, durationMs);
  const breakdown = [`in ${m.input}`, `out ${m.output}`, ...(m.cache ? [`cache ${m.cache}`] : [])].join(" / ");

  const segments = [
    <>Tokens: <span className="usage-footer-total">{m.total}</span> ({breakdown})</>,
    m.cacheHit && (
      <>Cache Hit <span className={`usage-footer-hit usage-footer-hit-${m.cacheHit.level}`}>{m.cacheHit.percent}%</span></>
    ),
    m.tps && <>TPS: {m.tps}</>,
    m.elapsed && <>Elapsed {m.elapsed}</>,
    m.cost && <>Cost: <span className="usage-footer-cost">{m.cost}</span></>,
  ].filter(Boolean);

  return (
    <div className="message-meta usage-footer">
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="usage-footer-sep"> | </span>}
          <span>{seg}</span>
        </Fragment>
      ))}
    </div>
  );
}
