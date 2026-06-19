import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import {
  createAxisThread,
  listAxisThreads,
  makeThreadTitle,
  type AxisThreadMessageInput,
} from "../../../../lib/axis-thread-persistence";

export const runtime = "nodejs";

type CreateThreadBody = {
  messages?: unknown;
  title?: unknown;
};

export async function GET(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const result = await listAxisThreads(auth.userId);
  if (!result.ok) return Response.json({ error: result.error }, { status: 502 });

  return Response.json({ threads: result.value });
}

export async function POST(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const body = (await request.json().catch(() => null)) as CreateThreadBody | null;
  if (!body) return Response.json({ error: "JSON body is required." }, { status: 400 });

  const messages = parseMessages(body.messages);
  const firstUserMessage = messages.find((message) => message.role === "user");
  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim()
    : makeThreadTitle(firstUserMessage?.content ?? "");

  const result = await createAxisThread({
    messages,
    ownerId: auth.userId,
    title,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 502 });

  return Response.json({ thread: result.value });
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
