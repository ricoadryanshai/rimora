// Forward client disconnects and timeouts to every upstream provider request.
export const createRequestAbort = (req: Request, timeoutMs: number) => {
  const controller = new AbortController();
  const abort = () => controller.abort(req.signal.reason);
  if (req.signal.aborted) abort();
  else req.signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  return {
    controller,
    dispose() {
      clearTimeout(timeout);
      req.signal.removeEventListener("abort", abort);
      // Stop sibling requests if one parallel operation has failed.
      controller.abort();
    },
  };
};
