export type LocalImage = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

/**
 * File part accepted by Expo SDK 58's `expo/fetch` FormData serializer
 * (`expo/src/winter/fetch/convertFormData.ts`), which rejects React Native's
 * legacy `{ uri, name, type }` object.
 */
export type NativeFilePart = {
  name: string;
  type: string;
  bytes: () => Promise<Uint8Array<ArrayBuffer>>;
};

export type BuildImageFormOptions = {
  extra?: Record<string, string>;
  isWeb?: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  FormDataCtor?: new () => FormData;
};

/**
 * Reads a local photo URI into bytes and builds a `FormData` compatible with
 * both native `expo/fetch` and standard browser `fetch`.
 */
export async function buildImageForm(image: LocalImage, options: BuildImageFormOptions = {}): Promise<FormData> {
  const { extra, isWeb = false, signal, fetchImpl = fetch, FormDataCtor = FormData } = options;
  const type = image.mimeType || 'image/jpeg';
  const ext = type.split('/')[1] ?? 'jpg';
  const fileName = image.fileName || `foto.${ext}`;

  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const localRes = await fetchImpl(image.uri, signal ? { signal } : undefined);
    if (!localRes.ok) {
      throw new Error('Fotoğraf dosyası okunamadı. Lütfen tekrar seçin.');
    }
    bytes = new Uint8Array(await localRes.arrayBuffer());
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error('Fotoğraf dosyası okunamadı. Lütfen tekrar seçin.');
  }

  if (bytes.byteLength < 1) {
    throw new Error('Fotoğraf dosyası boş. Lütfen tekrar seçin.');
  }

  const form = new FormDataCtor();
  if (isWeb) {
    form.append('file', new Blob([bytes], { type }), fileName);
  } else {
    const part: NativeFilePart = { name: fileName, type, bytes: async () => bytes };
    form.append('file', part as unknown as Blob);
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      form.append(key, value);
    }
  }

  return form;
}
