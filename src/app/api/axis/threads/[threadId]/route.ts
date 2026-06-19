import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import {
  getAxisThread,
  saveAxisThreadMessages,
  type AxisThreadMessageInput,
} from "../../../../../lib/axis-thread-persistence";

export const runtime = "nodejs";

type SaveMessagesBody = {
  messages?: unknown;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const { threadId } = await params;
  const result = await getAxisThread({ ownerId: auth.userId, threadId });
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.error === "Thread not found." ? 404 : 502 },
    );
  }

  return Response.json({ thread: result.value });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const body = (await request.json().catch(() => null)) as SaveMessagesBody | null;
  if (!body) return Response.json({ error: "JSON body is required." }, { status: 400 });

  const { threadId } = await params;
  const messages = parseMessages(body.messages);
  const result = await saveAxisThreadMessages({
    messages,
    ownerId: auth.userId,
    threadId,
  });
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.error === "Thread not found." ? 404 : 502 },
    );
  }

  return Response.json({ saved: true });
}

function parseMessages(value: unknown): AxisThreadMessageInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((message): AxisThreadMessageInput | null => {
      if (!message || typeof message !== "object") return null;
      const record = message as Record<string, unknown>;
      const ordinal = typeof record.ordinal === "number" ? record.ordinal : null;
      const role = record.role === "user" || record.role === "assistant" ? record.role : null;
      const content = typeof record.content === "string" ? record.content : null;
      const threadBoard = record.threadBoard && typeof record.threadBoard === "object"
        ? record.threadBoard as AxisThreadMessageInput["threadBoard"]
        : null;

      if (!ordinal || !role || content === null) return null;
      return { content, ordinal, role, threadBoard };
    })
    .filter((message): message is AxisThreadMessageInput => message !== null);
}
