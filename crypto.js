/**
 * Secure Chat App - Cryptography Module (crypto.js)
 * Implements client-side AES-GCM encryption/decryption using the Web Crypto API.
 * The key is derived from the daily password and exists only in-memory.
 */

class PrivacyCrypto {
  constructor() {
    this.key = null;
    this.salt = new TextEncoder().encode("PrivacyChatSecureSalt2026");
  }

  // Derive AES-GCM key from password string (returns key without modifying state)
  async deriveKey(password) {
    try {
      const encoder = new TextEncoder();
      const passwordBytes = encoder.encode(password);

      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        passwordBytes,
        'PBKDF2',
        false,
        ['deriveKey']
      );

      return await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: this.salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        baseKey,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (e) {
      console.error('Key derivation failed:', e);
      return null;
    }
  }

  // Derive AES-GCM key from password string and set it globally
  async initializeKey(password) {
    const k = await this.deriveKey(password);
    if (k) {
      this.key = k;
      return true;
    }
    return false;
  }

  // Encrypt string text using optional custom key
  async encryptText(text, customKey = null) {
    const activeKey = customKey || this.key;
    if (!activeKey) throw new Error("Cryptographic key not initialized. Please log in.");
    
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      activeKey,
      data
    );

    return {
      iv: this.bufToHex(iv),
      ciphertext: this.bufToHex(new Uint8Array(ciphertext))
    };
  }

  // Decrypt string text using optional custom key
  async decryptText(encryptedObj, customKey = null) {
    const activeKey = customKey || this.key;
    if (!activeKey) throw new Error("Cryptographic key not initialized. Please log in.");
    if (!encryptedObj || !encryptedObj.iv || !encryptedObj.ciphertext) return '';

    const iv = this.hexToBuf(encryptedObj.iv);
    const ciphertext = this.hexToBuf(encryptedObj.ciphertext);

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        activeKey,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error("Decryption failed:", e);
      throw new Error("Decryption failed. Invalid key or corrupted data.");
    }
  }

  // Encrypt an ArrayBuffer (for files/images/videos)
  async encryptBuffer(arrayBuffer) {
    if (!this.key) throw new Error("Cryptographic key not initialized. Please log in.");

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      this.key,
      arrayBuffer
    );

    return {
      iv: this.bufToHex(iv),
      ciphertext: new Uint8Array(ciphertext) // Keep ciphertext as Uint8Array for database blob storage
    };
  }

  // Decrypt an ArrayBuffer to a Blob
  async decryptBuffer(ciphertextUint8, ivHex, mimeType) {
    if (!this.key) throw new Error("Cryptographic key not initialized. Please log in.");

    const iv = this.hexToBuf(ivHex);

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.key,
        ciphertextUint8
      );

      return new Blob([decrypted], { type: mimeType });
    } catch (e) {
      console.error("Buffer decryption failed:", e);
      throw new Error("File decryption failed.");
    }
  }

  // Helper: ArrayBuffer/Uint8Array to Hex string
  bufToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Helper: Hex string to Uint8Array
  hexToBuf(hexString) {
    if (hexString.length % 2 !== 0) {
      console.warn("Invalid hex string length");
    }
    const numBytes = hexString.length / 2;
    const array = new Uint8Array(numBytes);
    for (let i = 0; i < numBytes; i++) {
      array[i] = parseInt(hexString.substr(i * 2, 2), 16);
    }
    return array;
  }
}

window.AppCrypto = new PrivacyCrypto();
