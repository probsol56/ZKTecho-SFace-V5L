import { API_BASE_URL } from "@/lib/api";

// Proxies the browser straight through to the backend's Server-Sent Events
// stream. This has to be a Route Handler, not a Server Action - a Server
// Action resolves to one value once, it can't push incremental per-employee
// progress to the client while the transfer is still running.
export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch(`${API_BASE_URL}/api/devices/transfer-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
