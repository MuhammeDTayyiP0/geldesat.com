/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildImageForm, type NativeFilePart } from './uploadForm';

class FakeExpoFormData {
  private readonly items: [string, unknown][] = [];

  append(name: string, value: unknown) {
    this.items.push([name, value]);
  }

  entries(): [string, unknown][] {
    return this.items;
  }
}

describe('buildImageForm', () => {
  it('builds a native ExpoFetch file part with name, type, bytes, and extra fields', async () => {
    const sampleBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    let seenUri = '';
    const mockFetch = (async (input: string | URL | Request) => {
      seenUri = String(input);
      return new Response(sampleBytes, { status: 200 });
    }) as typeof fetch;

    const form = await buildImageForm(
      { uri: 'file:///cache/photo.jpg', mimeType: 'image/jpeg', fileName: 'foto-test.jpg' },
      {
        extra: { conversationId: 'conv-123' },
        isWeb: false,
        fetchImpl: mockFetch,
        FormDataCtor: FakeExpoFormData as unknown as new () => FormData,
      },
    );

    assert.equal(seenUri, 'file:///cache/photo.jpg');
    const entries = (form as unknown as FakeExpoFormData).entries();
    assert.equal(entries.length, 2);

    const [fileKey, fileValue] = entries[0]!;
    assert.equal(fileKey, 'file');
    const part = fileValue as NativeFilePart;
    assert.equal(part.name, 'foto-test.jpg');
    assert.equal(part.type, 'image/jpeg');
    const partBytes = await part.bytes();
    assert.deepEqual(Array.from(partBytes), Array.from(sampleBytes));

    assert.deepEqual(entries[1], ['conversationId', 'conv-123']);
  });

  it('builds a Blob entry in web mode', async () => {
    const sampleBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const mockFetch = (async () => new Response(sampleBytes, { status: 200 })) as typeof fetch;

    const form = await buildImageForm(
      { uri: 'blob:http://localhost/123', mimeType: 'image/png' },
      { isWeb: true, fetchImpl: mockFetch },
    );

    const file = form.get('file');
    assert.ok(file instanceof Blob);
    assert.equal(file.type, 'image/png');
    if ('name' in file) {
      assert.equal(file.name, 'foto.png');
    }
    assert.deepEqual(Array.from(new Uint8Array(await file.arrayBuffer())), Array.from(sampleBytes));
  });

  it('throws readable Turkish errors for missing, empty, or failed reads and preserves aborts', async () => {
    await assert.rejects(
      () =>
        buildImageForm(
          { uri: 'file:///missing.jpg' },
          { fetchImpl: (async () => new Response(null, { status: 404 })) as typeof fetch },
        ),
      /Fotoğraf dosyası okunamadı/,
    );

    await assert.rejects(
      () =>
        buildImageForm(
          { uri: 'file:///empty.jpg' },
          { fetchImpl: (async () => new Response(new Uint8Array(0), { status: 200 })) as typeof fetch },
        ),
      /Fotoğraf dosyası boş/,
    );

    await assert.rejects(
      () =>
        buildImageForm(
          { uri: 'file:///unreadable.jpg' },
          { fetchImpl: (async () => { throw new Error('EACCES'); }) as typeof fetch },
        ),
      /Fotoğraf dosyası okunamadı/,
    );

    const controller = new AbortController();
    const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    controller.abort(abortErr);
    await assert.rejects(
      () =>
        buildImageForm(
          { uri: 'file:///aborted.jpg' },
          {
            signal: controller.signal,
            fetchImpl: (async () => {
              throw abortErr;
            }) as typeof fetch,
          },
        ),
      (err) => err === abortErr,
    );
  });
});
