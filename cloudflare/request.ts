import { bodyTooLarge, MAX_BODY_BYTES } from "../server/request-limits";

export async function bufferApiRequest(
  request: Request,
): Promise<Request | Response> {
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return Response.json(bodyTooLarge, {
          status: 413,
          headers: { "Cache-Control": "no-store" },
        });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  // Forward a bounded, fully read body. Early DO responses (e.g. unknown parent)
  // must not leave an upstream request stream pumping after the response ends.
  return new Request(request, { body: new Blob(chunks) });
}
