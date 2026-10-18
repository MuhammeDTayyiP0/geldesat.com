declare module "heic-decode" {
  /** Decode the primary image of a HEIC/HEIF file to RGBA pixels (orientation already applied by libheif). */
  function decode(input: { buffer: Uint8Array | ArrayBuffer }): Promise<{ width: number; height: number; data: Uint8ClampedArray }>;
  export default decode;
}
