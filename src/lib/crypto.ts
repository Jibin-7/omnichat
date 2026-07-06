// E2EE Utilities using Web Crypto API

// 1. Generate an ECDH Key Pair
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, ["deriveKey", "deriveBits"]
  );
}

// 2. Export Public Key to send to the other user
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(exported))));
}

// 3. Import Public Key received from the other user
export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const binaryDerString = atob(pem);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) binaryDer[i] = binaryDerString.charCodeAt(i);
  return await window.crypto.subtle.importKey(
    "spki", binaryDer, { name: "ECDH", namedCurve: "P-256" }, true, []
  );
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(exported))));
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const binaryDerString = atob(pem);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) binaryDer[i] = binaryDerString.charCodeAt(i);
  return await window.crypto.subtle.importKey(
    "pkcs8", binaryDer, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
  );
}

// 4. Derive Shared AES-GCM Secret
export async function deriveSecretKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    true, ["encrypt", "decrypt"]
  );
}

// --- GROUP MESSAGING CRYPTO ---

export async function generateGroupKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, ["encrypt", "decrypt"]
  );
}

export async function exportGroupKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(exported))));
}

export async function importGroupKey(base64Raw: string): Promise<CryptoKey> {
  const binaryString = atob(base64Raw);
  const binaryDer = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) binaryDer[i] = binaryString.charCodeAt(i);
  return await window.crypto.subtle.importKey(
    "raw", binaryDer, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]
  );
}

// ------------------------------

// Helper for converting ArrayBuffer/Uint8Array to Base64 safely (avoiding call stack size limits)
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000; // 32768 bytes
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(binary);
}

// Helper for converting Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// 5. Encrypt a message
export async function encryptMessage(text: string, secretKey: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const encoded = enc.encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    secretKey, encoded
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
  };
}

// 6. Decrypt a message
export async function decryptMessage(ciphertextBase64: string, ivBase64: string, secretKey: CryptoKey): Promise<string> {
  const dec = new TextDecoder();
  const ciphertextBytes = base64ToUint8Array(ciphertextBase64);
  const ivBytes = base64ToUint8Array(ivBase64);
  
  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      secretKey, ciphertextBytes
    );
    return dec.decode(decrypted);
  } catch (e) {
    console.error("Decryption failed", e);
    return "[Encrypted Message - Decryption Failed]";
  }
}

// ===============================================
// PHASE 8: PERSISTENT IDENTITY & PRIVATE KEY BACKUP
// ===============================================

// Derive an AES-GCM Backup Key from a PIN and Phone Number (Salt) using PBKDF2
export async function deriveBackupKey(pin: string, phone: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(pin), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("OmniChatSalt_" + phone), // Salted with phone
      iterations: 100000, // Secure iteration count
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, ["encrypt", "decrypt"]
  );
}

// Encrypt the ECDH Private Key using the derived Backup Key
export async function exportEncryptedPrivateKey(privateKey: CryptoKey, backupKey: CryptoKey): Promise<{ encrypted: string, iv: string }> {
  const exportedPriv = await window.crypto.subtle.exportKey("pkcs8", privateKey);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    backupKey, exportedPriv
  );
  
  return {
    encrypted: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv)
  };
}

// Decrypt and Import the ECDH Private Key using the Backup Key
export async function importEncryptedPrivateKey(encryptedBase64: string, ivBase64: string, backupKey: CryptoKey): Promise<CryptoKey> {
  const ciphertextBytes = base64ToUint8Array(encryptedBase64);
  const ivBytes = base64ToUint8Array(ivBase64);
  
  const decryptedPriv = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    backupKey, ciphertextBytes
  );
  
  return await window.crypto.subtle.importKey(
    "pkcs8", decryptedPriv, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
  );
}
