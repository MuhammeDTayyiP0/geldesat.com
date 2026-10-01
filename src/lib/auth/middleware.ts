import { createMiddleware } from "@tanstack/react-start";

/** Resolve the caller's verified account before a server function touches private data. */
export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { requireUserId } = await import("./verify.server");
    return next({ context: { userId: await requireUserId() } });
  },
);
