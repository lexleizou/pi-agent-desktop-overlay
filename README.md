# pi-agent-desktop-overlay

A drop-in UI enhancement layer for [pi-agent-desktop](https://github.com/abcwyc/pi-agent-desktop)
(the desktop client for the [Pi](https://github.com/earendil-works/pi-coding-agent) coding agent).

Everything here is an **additive overlay**: new files plus block-level insertions into a few
upstream files. It is designed so that syncing with upstream stays cheap — nothing is moved
across files, no upstream line is rewritten, and every mount point is an independent block.

## What it adds

| Feature | Description |
|---|---|
| **Follow-up suggestions** | After a reply finishes, 2–3 next-prompt chips are generated with a cheap model call. Clicking one fills the composer without sending. |
| **Ghost text** | Inline, prefix-matched completion while typing. Tab accepts. No model call — matched against your input history. |
| **Task panel** | A Co-Work style task list pinned to the chat area's top-right corner, driven by the `todo` tool. No polling: state is replayed from the session branch. |
| **Usage footer** | Per-turn `Tokens: total(in/out/cache) | Cache Hit N% | TPS | Elapsed | Cost`, with threshold-based colouring. |
| **Context ring** | Always-visible `pct% / window` beside the context-usage ring. |
| **Model selector** | Full model names (no 220px truncation) and a two-level provider → model menu. |

## Repository layout

```
overlay/                       New and fork-modified files, by their path in the target checkout
upstream-file-patches.diff     Block-level edits to upstream-owned files
PATCHES.md                     Full change log: what changed, why, and what was verified
```

## Install

The overlay targets pi-agent-desktop **v0.7.1** (`main@6fcd7d4`, pi-web v0.10.0).

```bash
git clone https://github.com/abcwyc/pi-agent-desktop.git
cd pi-agent-desktop
git checkout 6fcd7d4        # the verified baseline

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
the overlay applied correctly.

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

This overlay contains modified files from two MIT-licensed projects; their notices are
preserved in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
