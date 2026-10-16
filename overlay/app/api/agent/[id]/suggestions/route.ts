import { NextResponse } from "next/server";
import { generateSuggestions } from "@/lib/suggestion-engine";
import { getRpcSession, startRpcSession } from "@/lib/rpc-manager";
import { resolveSessionPath } from "@/lib/session-reader";

/**
 * POST /api/agent/[id]/suggestions
 *
 * Generates follow-up suggestions for a settled session. Called by the
 * frontend right after a turn finishes (onAgentEnd), as a "ride along" call
 * on top of the turn that just completed — one small request per turn,
 * directly addressing the session's own model.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let clientSignal: AbortSignal | undefined;
  try {
    clientSignal = req.signal;
    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const existing = getRpcSession(id);
    const { session } = existing?.isAlive()
      ? { session: existing }
      : // A settled session's wrapper may have been released; restart it
        // read-only from disk for suggestion generation only.
        await startRpcSession(id, filePath, undefined, { toolNames: [] });

    await session.waitUntilReady?.();
    const agent = (session.inner as { agent?: unknown }).agent;
    if (!agent) {
      return NextResponse.json({ error: "Session agent unavailable" }, { status: 503 });
    }
    const result = await generateSuggestions(agent as Parameters<typeof generateSuggestions>[0]);
    return NextResponse.json({ suggestions: result.suggestions, usage: result.usage ?? null });
  } catch (error) {
    if (clientSignal?.aborted) {
      // The client moved on (new prompt, session switch); nothing to report.
      return new Response(null, { status: 499 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
