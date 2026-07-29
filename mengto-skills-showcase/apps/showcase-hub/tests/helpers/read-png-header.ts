const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function readPngHeader(bytes: Buffer, filename = "PNG asset") {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${filename} has an invalid PNG signature`);
  }
  if (bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`${filename} is missing the leading IHDR chunk`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1) {
    throw new Error(`${filename} has invalid dimensions ${width}x${height}`);
  }
  return { width, height };
}
