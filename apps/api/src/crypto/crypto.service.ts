import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Encrypts sensitive columns (*_enc) before they reach the database.
 *
 * Stored format:  [version 1 byte][iv 12 bytes][auth tag 16 bytes][ciphertext]
 * Algorithm:      AES-256-GCM (tampering is detected on decrypt)
 *
 * The key lives only in .env (DATA_ENCRYPTION_KEY, 32 bytes base64).
 * Lose the key = lose the data, so back it up somewhere safe.
 */
@Injectable()
export class CryptoService {
  private static readonly VERSION = 1;
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.getOrThrow<string>('DATA_ENCRYPTION_KEY');
    this.key = Buffer.from(raw, 'base64');
    if (this.key.length !== 32) {
      throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (base64)');
    }
  }

  encrypt(plain: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const out = Buffer.concat([
      Buffer.from([CryptoService.VERSION]),
      iv,
      cipher.getAuthTag(),
      ciphertext,
    ]);
    return Uint8Array.from(out);
  }

  decrypt(data: Uint8Array): string {
    const buf = Buffer.from(data);
    if (buf[0] !== CryptoService.VERSION) {
      throw new Error('Unknown encryption version');
    }
    const iv = buf.subarray(1, 13);
    const tag = buf.subarray(13, 29);
    const ciphertext = buf.subarray(29);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  encryptOptional(plain?: string | null): Uint8Array<ArrayBuffer> | null {
    return plain == null || plain === '' ? null : this.encrypt(plain);
  }

  decryptOptional(data?: Uint8Array | null): string | null {
    return data == null ? null : this.decrypt(data);
  }
}
