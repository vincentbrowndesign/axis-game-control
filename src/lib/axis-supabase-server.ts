import type { SupabaseClientOptions } from "@supabase/supabase-js";

class AxisDisabledRealtimeTransport {
  readonly CLOSED = 3;
  readonly CLOSING = 2;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  binaryType = "arraybuffer";
  bufferedAmount = 0;
  extensions = "";
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: unknown) => void) | null = null;
  onopen: ((event: unknown) => void) | null = null;
  protocol = "";
  readyState = 3;
  url: string;

  constructor(url: string | URL) {
    this.url = String(url);
  }

  close() {
    this.readyState = 3;
  }

  addEventListener() {
    return undefined;
  }

  dispatchEvent() {
    return false;
  }

  removeEventListener() {
    return undefined;
  }

  send() {
    throw new Error("SUPABASE_REALTIME_DISABLED");
  }
}

export const axisServerSupabaseOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: AxisDisabledRealtimeTransport,
  },
} satisfies SupabaseClientOptions<"public">;
