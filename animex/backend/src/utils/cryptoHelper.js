'use strict';

/*
═══════════════════════════════════════════════════════════════════
  CRYPTO HELPER — AES Decryption Template
  
  Many anime video hosts encrypt their sources array using
  AES-256-CBC or AES-128-CBC before sending it over the wire.
  
  How to find the key + IV:
  ─────────────────────────
  1. Open DevTools → Network tab
  2. Load an episode page on the target host
  3. Find the XHR call to getSources or equivalent
  4. The response will have "sources": "<base64_encrypted_string>"
  5. In the Sources tab, search the minified player JS for:
       - CryptoJS.AES.decrypt  ← key and IV are nearby
       - atob(  ← key might be base64-encoded
       - generateKey( or deriveKey(
  6. The key is often:
       - A hardcoded string in the JS
       - Derived from part of the episode ID or page URL
       - Fetched from a separate /getKeys or /e-1/keys endpoint
  7. Once found, set in your .env:
       AES_KEY_VIDSTREAMING=<the_key>
       AES_IV_VIDSTREAMING=<the_iv>

  Known host decryption patterns (as of 2024):
  ─────────────────────────────────────────────
  RapidCloud / Vidstreaming / MegaCloud:
    - Key and IV are fetched from a separate endpoint:
      GET https://megacloud.tv/embed-2/e-1/keys/e-1
      Returns: { key: [[cipherKey, decryptedKey], ...], ... }
    - The actual decryption key shifts periodically
    - Use the keyHelper() pattern below to handle rotation
    
  StreamSB:
    - Uses a custom XOR + base64 obfuscation (not standard AES)
    - Reverse engineer the sb_decode() function in their JS

  Filemoon:
    - Sources are inline in an eval()'d script block
    - No AES; just deobfuscate the JS using js-beautify
═══════════════════════════════════════════════════════════════════
*/

const CryptoJS = require('crypto-js');
const axios    = require('axios');

/*
  decryptAES — Standard AES-256-CBC decryption
  
  @param {string} encryptedB64  — Base64-encoded encrypted ciphertext
  @param {string} key           — Decryption key (plaintext string or hex)
  @param {string} iv            — Initialisation vector (plaintext string or hex)
  @param {string} [encoding]    — 'utf8' | 'hex' | 'base64' (default: 'utf8')
  @returns {string}             — Decrypted plaintext
*/
exports.decryptAES = function decryptAES(encryptedB64, key, iv, encoding = 'utf8') {
  try {
    // Parse key and IV — handles both plain strings and hex strings
    const keyParsed = encoding === 'hex'
      ? CryptoJS.enc.Hex.parse(key)
      : CryptoJS.enc.Utf8.parse(key);

    const ivParsed = encoding === 'hex'
      ? CryptoJS.enc.Hex.parse(iv)
      : CryptoJS.enc.Utf8.parse(iv);

    const decrypted = CryptoJS.AES.decrypt(encryptedB64, keyParsed, {
      iv:      ivParsed,
      mode:    CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (!result) throw new Error('Decryption produced empty string — wrong key/IV?');
    return result;
  } catch (err) {
    throw new Error(`AES decryption failed: ${err.message}`);
  }
};


/*
  decryptAES_ECB — Some older hosts use ECB mode (no IV needed)
  
  @param {string} encryptedB64 — Base64-encoded ciphertext
  @param {string} key          — Decryption key
*/
exports.decryptAES_ECB = function decryptAES_ECB(encryptedB64, key) {
  const keyParsed = CryptoJS.enc.Utf8.parse(key);
  const decrypted = CryptoJS.AES.decrypt(encryptedB64, keyParsed, {
    mode:    CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
};


/*
  decryptAES_CTR — Some streaming hosts use CTR mode
  
  @param {string} encryptedHex — Hex-encoded ciphertext
  @param {string} keyHex       — Hex-encoded key
  @param {string} nonceHex     — Hex-encoded nonce/counter
*/
exports.decryptAES_CTR = function decryptAES_CTR(encryptedHex, keyHex, nonceHex) {
  const key       = CryptoJS.enc.Hex.parse(keyHex);
  const nonce     = CryptoJS.enc.Hex.parse(nonceHex);
  const encrypted = CryptoJS.enc.Hex.parse(encryptedHex);
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: encrypted });

  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv:      nonce,
    mode:    CryptoJS.mode.CTR,
    padding: CryptoJS.pad.NoPadding,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
};


/*
  keyHelper — for hosts (MegaCloud/RapidCloud) that rotate their
  AES key by serving it from a dynamic endpoint.
  
  Usage:
    const { key, iv } = await keyHelper.fetchRapidCloudKeys();
    const sources = JSON.parse(decryptAES(encryptedSources, key, iv));

  ⚠ The endpoint URL and response format change when the host
    updates their obfuscation. Re-check periodically in DevTools.
*/
exports.keyHelper = {

  /*
    fetchRapidCloudKeys — fetches the rotating key pair from
    RapidCloud / MegaCloud's own endpoint.
    The response is an array of tuples: [[encKey, plainKey], ...]
  */
  fetchRapidCloudKeys: async function() {
    // This URL changes periodically — check DevTools XHR calls
    // when the key rotation breaks your decryption
    const KEYS_URL = 'https://raw.githubusercontent.com/enimax-anime/key/e6/key.txt';

    const res  = await axios.get(KEYS_URL, { timeout: 5000 });
    const data = res.data; // typically a JSON array

    // data format: [[encryptedKeySegment, indexToDecryptWith], ...]
    // Reconstruct the actual key from the tuple structure
    if (Array.isArray(data)) {
      let key = '';
      let iv  = '';

      // The first element array usually maps to the key,
      // second to the IV — adjust indices when the format changes
      try {
        const keyData = data[0];
        const ivData  = data[1];
        key = Array.isArray(keyData) ? keyData.map(n => String.fromCharCode(n)).join('') : String(keyData);
        iv  = Array.isArray(ivData)  ? ivData.map(n => String.fromCharCode(n)).join('')  : String(ivData);
      } catch (_) {}

      return { key, iv };
    }

    // Fallback: try string format "key:iv"
    if (typeof data === 'string' && data.includes(':')) {
      const [key, iv] = data.split(':');
      return { key: key.trim(), iv: iv.trim() };
    }

    throw new Error('Unexpected key format from RapidCloud key endpoint');
  },

  /*
    extractKeyFromJS — if the key is hardcoded in the player JS,
    use this to scrape it directly from the script source.
    
    @param {string} jsUrl — URL of the minified player script
    @param {RegExp} keyRegex  — regex to capture the key
    @param {RegExp} ivRegex   — regex to capture the IV
  */
  extractKeyFromJS: async function(jsUrl, keyRegex, ivRegex) {
    const res    = await axios.get(jsUrl, { timeout: 8000 });
    const jsText = res.data;

    const keyMatch = jsText.match(keyRegex);
    const ivMatch  = jsText.match(ivRegex);

    if (!keyMatch || !ivMatch) {
      throw new Error(`Could not find key/IV in JS at ${jsUrl}`);
    }

    return { key: keyMatch[1], iv: ivMatch[1] };
  },
};


/*
  xorDecode — for StreamSB-style custom XOR obfuscation
  
  @param {string} encoded — encoded string (often hex or base64)
  @param {number} xorKey  — XOR key byte (e.g. 0x02, 0xAB)
*/
exports.xorDecode = function xorDecode(encoded, xorKey) {
  const bytes = Buffer.from(encoded, 'hex');
  return Buffer.from(bytes.map(b => b ^ xorKey)).toString('utf8');
};


/*
  b64Decode — convenience wrapper for base64 decoding
  (some hosts double-encode)
*/
exports.b64Decode = function b64Decode(str) {
  return Buffer.from(str, 'base64').toString('utf8');
};
