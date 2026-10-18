import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const uploadImageFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { image: string }) => d)
  .handler(async ({ data, context }) => {
    const { saveImageToDisk } = await import("./upload.server");
    const url = await saveImageToDisk(data.image, context.userId);
    return { url };
  });
