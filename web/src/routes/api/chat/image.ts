import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { newId } from "@/lib/utils";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";
import { limitedFormData } from "@/lib/server/request-body";
import { rateLimit } from "@/lib/server/helpers";
import { assertImageBytes, MAX_UPLOAD_BYTES } from "@/lib/server/upload.server";
import { authorizeUpload, json } from "@/lib/server/upload-auth.server";
import { myConversation, sendChatPhoto } from "@/lib/server/chat";

export const Route = createFileRoute("/api/chat/image")({
  server: {
    handlers: {
      /** Send a photo in a chat: multipart `file` + `conversationId`. Replies with the new message. */
      POST: async ({ request }) => {
        const auth = await authorizeUpload(request);
        if (auth instanceof Response) return auth;
        try {
          rateLimit(`chatimg:${auth.userId}`, 20, 10 * 60_000);
          const form = await limitedFormData(request, MAX_UPLOAD_BYTES + 64 * 1024, "Fotoğraf en fazla 12 MB olabilir.");
          const file = form.get("file");
          const conversationId = form.get("conversationId");
          if (!(file instanceof File) || typeof conversationId !== "string") return json({ error: "Fotoğraf bulunamadı." }, 400);
          // Decoding a photo is expensive; do it only for someone in that chat.
          await myConversation(await getSql(), conversationId, auth.userId);
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { isHeif, processChatPhoto } = await import("@/lib/server/image-pipeline.server");
          if (!isHeif(bytes)) assertImageBytes(bytes, MAX_UPLOAD_BYTES);
          let data: Buffer;
          try {
            data = await processChatPhoto(bytes);
          } catch (err) {
            if (err instanceof Error && /^Fotoğraf/.test(err.message)) throw err;
            console.error("[chat-image] processing failed", err);
            throw new Error("Fotoğraf işlenemedi. Farklı bir fotoğraf deneyin.");
          }
          const message = await sendChatPhoto(await getSql(), auth.userId, conversationId, newId("img"), data);
          return json({ message });
        } catch (err) {
          return json({ error: publicErrorMessage(err, "Fotoğraf gönderilemedi") }, errorStatus(err, 400));
        }
      },
    },
  },
});
