import type { DeviceUser, TemplateTransferOutcome } from "@/lib/api";

// Reads the Server-Sent Events stream from /api/transfer-templates and invokes
// onOutcome once per employee, in the order the backend reports them, so the UI
// can show live per-employee progress instead of waiting for the whole batch.
export async function runTemplateTransfer(
  input: { sourceDeviceId: number; targetDeviceId: number; employees: DeviceUser[] },
  onOutcome: (outcome: TemplateTransferOutcome) => void,
): Promise<void> {
  const response = await fetch("/api/transfer-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Transfer request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      handleSseEvent(buffer.slice(0, boundary), onOutcome);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function handleSseEvent(rawEvent: string, onOutcome: (outcome: TemplateTransferOutcome) => void): void {
  const eventType = /^event: (.+)$/m.exec(rawEvent)?.[1] ?? "message";
  const data = /^data: (.+)$/m.exec(rawEvent)?.[1];
  if (!data) return;

  if (eventType === "outcome") {
    onOutcome(JSON.parse(data) as TemplateTransferOutcome);
  } else if (eventType === "error") {
    throw new Error((JSON.parse(data) as { message: string }).message);
  }
}
