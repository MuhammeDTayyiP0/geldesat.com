import { createMiddleware, createStart } from "@tanstack/react-start";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { publicErrorMessage } from "@/lib/server/errors";

/**
 * Every server function's errors reach the browser. Messages the app throws on
 * purpose pass through; database, system and programming errors are logged on
 * the server and replaced with a generic message.
 */
const hideInternalErrors = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isRedirect(error) || isNotFound(error)) throw error;
    const message = publicErrorMessage(error, "İşlem şu an tamamlanamadı. Lütfen tekrar deneyin.");
    if (error instanceof Error && error.message === message) throw error;
    throw new Error(message);
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [hideInternalErrors],
}));
