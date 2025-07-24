import crypto from 'crypto';

/**
 * Cryptographic utilities for secure operations
 */

export interface HashOptions {
  algorithm?: string;
  encoding?: BufferEncoding;
  salt?: string;
  iterations?: number;
}

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag?: string;
}

/**
 * Generate cryptographically secure random values
 */
export function generateRandomBytes(length: number): Buffer {
  return crypto.randomBytes(length);
}

export function generateRandomString(length: number, charset?: string): string {
  const defaultCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const chars = charset || defaultCharset;
  const randomBytes = crypto.randomBytes(length);
  
  return Array.from(randomBytes)
    .map(byte => chars[byte % chars.length])
    .join('');
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function generateApiKey(prefix?: string): string {
  const key = generateRandomString(32);
  return prefix ? `${prefix}_${key}` : key;
}

/**
 * Hashing utilities
 */
export function hashString(input: string, options: HashOptions = {}): string {
  const {
    algorithm = 'sha256',
    encoding = 'hex',
    salt
  } = options;
  
  const hash = crypto.createHash(algorithm);
  if (salt) {
    hash.update(salt);
  }
  hash.update(input);
  
  return hash.digest(encoding);
}

export function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || generateRandomString(16);
  const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512');
  
  return `${actualSalt}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  try {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
    
    return hash === verifyHash.toString('hex');
  } catch {
    return false;
  }
}

export function hashObject(obj: any): string {
  const jsonString = JSON.stringify(obj, Object.keys(obj).sort());
  return hashString(jsonString);
}

/**
 * HMAC utilities
 */
export function createHMAC(data: string, secret: string, algorithm: string = 'sha256'): string {
  return crypto.createHmac(algorithm, secret)
    .update(data)
    .digest('hex');
}

export function verifyHMAC(data: string, secret: string, expectedHmac: string, algorithm: string = 'sha256'): boolean {
  const actualHmac = createHMAC(data, secret, algorithm);
  return crypto.timingSafeEqual(
    Buffer.from(expectedHmac, 'hex'),
    Buffer.from(actualHmac, 'hex')
  );
}

/**
 * Symmetric encryption utilities
 */
export function encrypt(text: string, key: string, algorithm: string = 'aes-256-gcm'): EncryptionResult {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const result: EncryptionResult = {
    encrypted,
    iv: iv.toString('hex')
  };
  
  // Add authentication tag for GCM mode
  if (algorithm.includes('gcm')) {
    result.tag = (cipher as any).getAuthTag()?.toString('hex');
  }
  
  return result;
}

export function decrypt(encryptedData: EncryptionResult, key: string, algorithm: string = 'aes-256-gcm'): string {
  const decipher = crypto.createDecipher(algorithm, key);
  
  // Set authentication tag for GCM mode
  if (algorithm.includes('gcm') && encryptedData.tag) {
    (decipher as any).setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
  }
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Key derivation utilities
 */
export function deriveKey(password: string, salt: string, iterations: number = 10000, keyLength: number = 32): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
}

export function generateSalt(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Digital signature utilities (requires key pairs)
 */
export function generateKeyPair(type: 'rsa' | 'ec' = 'rsa'): { publicKey: string; privateKey: string } {
  let keyPair;
  
  if (type === 'rsa') {
    keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
  } else {
    keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
  }
  
  return keyPair;
}

export function signData(data: string, privateKey: string, algorithm: string = 'sha256'): string {
  const sign = crypto.createSign(algorithm);
  sign.update(data);
  sign.end();
  
  return sign.sign(privateKey, 'hex');
}

export function verifySignature(data: string, signature: string, publicKey: string, algorithm: string = 'sha256'): boolean {
  const verify = crypto.createVerify(algorithm);
  verify.update(data);
  verify.end();
  
  return verify.verify(publicKey, signature, 'hex');
}

/**
 * Secure comparison utilities
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(a, 'utf8'),
    Buffer.from(b, 'utf8')
  );
}

/**
 * Token generation utilities
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

export function generateAccessToken(): string {
  return generateSecureToken(32);
}

export function generateRefreshToken(): string {
  return generateSecureToken(48);
}

export function generateCSRFToken(): string {
  return generateSecureToken(24);
}

/**
 * Checksum utilities
 */
export function calculateChecksum(data: string | Buffer, algorithm: string = 'md5'): string {
  return crypto.createHash(algorithm)
    .update(data)
    .digest('hex');
}

export function verifyChecksum(data: string | Buffer, expectedChecksum: string, algorithm: string = 'md5'): boolean {
  const actualChecksum = calculateChecksum(data, algorithm);
  return constantTimeCompare(actualChecksum, expectedChecksum);
}

/**
 * Utility functions for secure random operations
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  
  for (let i = result.length - 1; i > 0; i--) {
    const randomBytes = crypto.randomBytes(4);
    const randomIndex = randomBytes.readUInt32BE(0) % (i + 1);
    
    [result[i], result[randomIndex]] = [result[randomIndex], result[i]];
  }
  
  return result;
}

export function selectRandomElement<T>(array: T[]): T {
  const randomBytes = crypto.randomBytes(4);
  const randomIndex = randomBytes.readUInt32BE(0) % array.length;
  return array[randomIndex];
}

export function generateNonce(length: number = 16): string {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * Rate limiting token bucket using crypto random
 */
export class CryptoTokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillRate: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(): boolean {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}