// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { crc32, unzipStored, zipStored } from '../src/export/zip';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('zip writer', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
  it('round-trips entries in order, with UTF-8 names and binary data', () => {
    const entries = [
      { name: '[Content_Types].xml', data: bytes('<a/>') },
      { name: 'word/Dokument ć.xml', data: bytes('Wörds ✓') },
      { name: 'bin', data: new Uint8Array([0, 1, 2, 255, 254]) },
    ];
    const back = unzipStored(zipStored(entries, new Date(2026, 9, 2, 12, 30, 10)));
    expect(back.map(e => e.name)).toEqual(entries.map(e => e.name));
    expect(back.map(e => Array.from(e.data))).toEqual(entries.map(e => Array.from(e.data)));
  });
  it('starts with a zip file header, which is how a .docx is recognised', () => {
    const zip = zipStored([{ name: 'a', data: bytes('x') }]);
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
  it('detects damage', () => {
    const zip = zipStored([{ name: 'a', data: bytes('hello') }]);
    zip[30 + 1] ^= 0xff; // corrupt the stored data
    expect(() => unzipStored(zip)).toThrow();
    expect(() => unzipStored(new Uint8Array(10))).toThrow();
  });
  it('handles an empty archive', () => {
    expect(unzipStored(zipStored([]))).toEqual([]);
  });
});
