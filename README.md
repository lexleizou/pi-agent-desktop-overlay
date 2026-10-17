# pi-agent-desktop-overlay

A drop-in UI enhancement layer for [pi-agent-desktop](https://github.com/abcwyc/pi-agent-desktop)
(the desktop client for the [Pi](https://github.com/earendil-works/pi-coding-agent) coding agent).

Everything here is an **additive overlay**: new files plus block-level insertions into a few
upstream files. It is designed so that syncing with upstream stays cheap — nothing is moved
across files, no upstream line is rewritten, and every mount point is an independent block.

## What it adds

| Feature | Description |
|---|---|
| **Follow-up suggestions** | After a reply finishes, 2–3 next-prompt suggestions are generated with a cheap model call and shown as a recommendation card above the composer. Clicking one fills the composer without sending. |
| **Ghost text** | Prefix-matched completion while typing, shown as a `Tab` hint beside the composer. Tab accepts. No model call — matched against your input history. |
| **Task panel** | A task list pinned to the chat area's top-right corner, driven by the `todo` tool: completion rail, per-row status badges, expandable long rows, live `Working · Ns` while a turn runs. Resizable (drag the left edge), collapsible, and closable; the state is remembered. It only opens as a card when the card actually fits in the gutter beside the message column — otherwise, and while the question is pinned to the top of the chat, it stays a small pill so an automatic popup cannot cover the text. No polling — state is replayed from the session branch. |
| **Usage footer** | Per-turn `Tokens: total(in/out/cache) | Cache Hit N% | TPS | Elapsed | Cost`, with threshold-based colouring. |
| **Context ring** | Always-visible `pct% / window` beside the context-usage ring, followed by the whole session's cost and average throughput (`$0.88 · 59.0 t/s`). Both totals come from the full session file, not the loaded page. |
| **Model selector** | Full model names (no 220px truncation) and a two-level provider → model menu. Usable **while a reply is streaming** — the in-flight request keeps its model and the switch lands on the next message, which the tooltip says out loud. |

## Two upstream behaviours this overlay fixes

Both were found by driving the real UI, not by reading the code:

- **The composer is an absolute overlay, but the prompt-anchor spacer was measured against the
  full scroll-container height.** The bottom `composerHeight` pixels are never visible, so the
  reserved space overshot by exactly one composer height, and anything that scrolled to the true
  bottom (streaming follow, the composer-spacer sync) parked the viewport in blank space with the
  just-sent message above it. The anchor is now measured against the visible height
  (`clientHeight - composerHeight`) and re-measured when the composer resizes.
- **The suggestion card used to sit in the composer's flow**, so a turn ending grew the composer
  from ~141px to ~292px and re-scrolled the chat to the bottom — pushing the question out of view.
  The card now floats above the composer, so the chat area's height no longer changes.

## Design language

Two token layers, both additive:

- `overlay/components/cds-overlay.css` — a subset of the Claude Design System tokens
  (four-layer surfaces, Clay accent, hairline ring, spring-ish easing), extracted from
  open-claude-ui. Deliberately **not** the full stylesheet: its global font-weight
  compensation would fight the upstream app's typography.
- `overlay/components/bui-overlay.css` — a `--bui-*` token layer plus component styles
  adapted from [beautifului.dev](https://www.beautifului.dev/) (oklch surface ramp, 6/8/10/14
  radius scale, layered hairline shadows, five easing curves, motion primitives) for the
  suggestion card, the task panel and the ghost-text hint.

The two are blended, not swapped: accent stays Clay, surfaces stay quiet, the panel keeps its
`Progress` / `Memory` section naming, and a suggestion still only *fills* the composer. No
confidence gauge is drawn for suggestions — the engine returns plain strings, so inventing a
score for them would be fiction.

## Repository layout

```
overlay/                       New and fork-modified files, by their path in the target checkout
upstream-file-patches.diff     Block-level edits to upstream-owned files
PATCHES.md                     Full change log: what changed, why, and what was verified
```

## Install

The overlay targets pi-agent-desktop **v0.7.1** — tag `v0.7.1`, commit
`9519ce4c1c2e504ba1d0aaaddcfed6ea8e49d0b3` (verified against the upstream repository with
`git ls-remote --tags origin v0.7.1`). Pin the commit, not just the tag: the overlay was
applied and tested at exactly this tree.

> The `6fcd7d4` commit quoted in earlier revisions of this README was wrong. It is the *pi-web*
> baseline this fork merged (pi-web v0.10.0, per `scripts/release-component-pins.json`) — a
> commit in the shared fork history, not a pi-agent-desktop release. Checking it out gives you
> pi-web, where `components/ContextUsageRing.tsx` and `components/SessionStatsPanel.tsx` do not
> exist and `upstream-file-patches.diff` does not apply.

```bash
git clone https://github.com/abcwyc/pi-agent-desktop.git
cd pi-agent-desktop
git checkout 9519ce4c1c2e504ba1d0aaaddcfed6ea8e49d0b3   # v0.7.1, the verified baseline

# 1. Apply the block-level edits to upstream files
git apply /path/to/upstream-file-patches.diff

# 2. Copy the overlay files in, preserving paths
cp -R /path/to/overlay/. .

# 3. Verify
npm install
npx tsc --noEmit
npm test                    # expect 2864 passing
```

The last two steps are the ones that matter: if `tsc` and `npm test` both come back clean,
the overlay applied correctly. Both were re-run on a clean worktree of `v0.7.1` for the
current revision — `tsc --noEmit` clean, **2864 tests passing, 0 failing**.

### Building the desktop app

```bash
export PATH="/path/to/official/node22/bin:$PATH"   # see caveat below
npm run desktop:build
```

Two build caveats worth knowing, both documented in `PATCHES.md`:

- **Use an official static Node 22 build.** Homebrew's Node links against a Cellar-local
  `libnode.*.dylib`; the packaging step only copies `process.execPath`, so the bundled Node
  cannot start. Download Node 22 from nodejs.org and put it first on `PATH`.
- **Unset `__NEXT_PRIVATE_STANDALONE_CONFIG` before building.** A running Pi Agent exports it,
  and Next.js then skips config defaulting, failing with `TypeError: generate is not a function`.
- **`tauri build` ends with a signing error when no updater private key is set.** The `.app`
  bundle is already produced at that point, so the build is usable; only the updater signature
  is skipped.

## Staying in sync with upstream

This overlay touches two kinds of files, and they need different handling:

| Kind | Files | Merge behaviour |
|---|---|---|
| **New files** | everything under `overlay/` that does not exist upstream | Never conflict — upstream has no counterpart |
| **Modified upstream files** | see `upstream-file-patches.diff` | All edits are block-level additions, so an upstream edit to the same region conflicts loudly rather than merging wrongly |

`PATCHES.md` lists the exact set of both, plus the upstream files that should be registered as
fork-owned in `scripts/fork-ownership.json`.

## License

MIT — see [LICENSE](LICENSE).

This overlay contains modified files from three MIT-licensed projects; their notices are
preserved in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
