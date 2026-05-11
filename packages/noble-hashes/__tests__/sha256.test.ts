import crypto from 'crypto';

import { sha256 } from '../src/sha2';
import { bytesToHex, hexToBytes, utf8ToBytes } from '../src/utils';

// NIST test vectors from FIPS 180-4
// https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/SHA256.pdf
describe('sha256', () => {
  it('should hash empty string', () => {
    const hash = sha256(new Uint8Array(0));
    expect(bytesToHex(hash)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('should hash "abc"', () => {
    const hash = sha256(utf8ToBytes('abc'));
    expect(bytesToHex(hash)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('should hash "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"', () => {
    const hash = sha256(
      utf8ToBytes('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')
    );
    expect(bytesToHex(hash)).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
  });

  it('should hash "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"', () => {
    const hash = sha256(
      utf8ToBytes(
        'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu'
      )
    );
    expect(bytesToHex(hash)).toBe(
      'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1'
    );
  });

  it('should match Node.js crypto for random inputs', () => {
    const inputs = [
      '',
      'hello world',
      'The quick brown fox jumps over the lazy dog',
      'a'.repeat(1000),
      '\x00\x01\x02\x03\x04\x05',
    ];

    for (const input of inputs) {
      const data = utf8ToBytes(input);
      const noble = bytesToHex(sha256(data));
      const node = crypto.createHash('sha256').update(data).digest('hex');
      expect(noble).toBe(node);
    }
  });

  it('should work with incremental hashing via .create()', () => {
    const hasher = sha256.create();
    hasher.update(utf8ToBytes('hello'));
    hasher.update(utf8ToBytes(' '));
    hasher.update(utf8ToBytes('world'));
    const incremental = bytesToHex(hasher.digest());

    const oneshot = bytesToHex(sha256(utf8ToBytes('hello world')));
    expect(incremental).toBe(oneshot);
  });
});

describe('utils', () => {
  it('bytesToHex should convert bytes to hex', () => {
    expect(bytesToHex(new Uint8Array([0xca, 0xfe, 0x01, 0x23]))).toBe(
      'cafe0123'
    );
  });

  it('hexToBytes should convert hex to bytes', () => {
    const bytes = hexToBytes('cafe0123');
    expect(Array.from(bytes)).toEqual([0xca, 0xfe, 0x01, 0x23]);
  });

  it('hexToBytes and bytesToHex should round-trip', () => {
    const hex = 'deadbeef0123456789abcdef';
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });
});
