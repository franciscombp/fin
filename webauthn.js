/*
 * Biometría real con la Web Authentication API (WebAuthn).
 * Basado en:
 *   - https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
 *   - https://whatpwacando.today/authentication/
 *
 * Es una demo *client-only* (sin backend, como esta PWA en GitHub Pages):
 * el reto (challenge) se genera en el cliente y el "éxito" se determina
 * porque el autenticador de plataforma (Touch ID / Face ID / Windows Hello /
 * huella Android) resolvió la verificación del usuario. En producción el
 * challenge y la firma de la aserción deben validarse en el servidor.
 *
 * Requisitos del navegador: contexto seguro (HTTPS o localhost) y un gesto
 * del usuario (click) para invocar navigator.credentials.*.
 */
(function () {
  'use strict';

  var CRED_KEY = 'bp_webauthn_credential';

  // ---- Helpers base64url <-> ArrayBuffer (los buffers no se serializan) ----
  function bufToB64url(buf) {
    var bytes = new Uint8Array(buf);
    var str = '';
    for (var i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlToBuf(b64url) {
    var b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    var pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    var str = atob(b64 + pad);
    var bytes = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
    return bytes.buffer;
  }

  function randomBytes(len) {
    var b = new Uint8Array(len);
    crypto.getRandomValues(b);
    return b;
  }

  var supported =
    typeof window.PublicKeyCredential !== 'undefined' &&
    !!(navigator.credentials && navigator.credentials.create && navigator.credentials.get);

  // ¿Hay un autenticador de plataforma (biometría del dispositivo) disponible?
  function platformAvailable() {
    if (!supported || typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return Promise.resolve(false);
    }
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () {
      return false;
    });
  }

  function storedCredential() {
    try { return JSON.parse(localStorage.getItem(CRED_KEY)); } catch (e) { return null; }
  }

  function hasCredential() {
    return !!storedCredential();
  }

  // ---- Registro: crea una passkey de plataforma y guarda su id ----
  function register(opts) {
    opts = opts || {};
    if (!supported) return Promise.reject(new Error('WebAuthn no soportado'));

    var displayName = opts.displayName || 'Cliente Banco Pichincha';
    var publicKey = {
      challenge: randomBytes(32),
      // rp.id se omite: el navegador usa el dominio actual automáticamente.
      rp: { name: 'Banco Pichincha' },
      user: {
        id: randomBytes(16),
        name: opts.username || 'cliente@pichincha.com',
        displayName: displayName
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // biometría del propio dispositivo
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    };

    return navigator.credentials.create({ publicKey: publicKey }).then(function (cred) {
      if (!cred) throw new Error('No se creó la credencial');
      var rec = { id: cred.id, rawId: bufToB64url(cred.rawId), createdAt: Date.now() };
      localStorage.setItem(CRED_KEY, JSON.stringify(rec));
      return rec;
    });
  }

  // ---- Autenticación: pide la biometría contra la passkey guardada ----
  function authenticate() {
    if (!supported) return Promise.reject(new Error('WebAuthn no soportado'));
    var rec = storedCredential();

    var publicKey = {
      challenge: randomBytes(32),
      timeout: 60000,
      userVerification: 'required'
      // rpId se omite: por defecto es el dominio del origen actual.
    };

    if (rec && rec.rawId) {
      publicKey.allowCredentials = [{
        type: 'public-key',
        id: b64urlToBuf(rec.rawId),
        transports: ['internal']
      }];
    }

    return navigator.credentials.get({ publicKey: publicKey }).then(function (assertion) {
      if (!assertion) throw new Error('Sin aserción');
      // Demo client-only: la aserción resuelta implica biometría verificada.
      return true;
    });
  }

  /*
   * Flujo de alto nivel para la app: si aún no hay passkey registrada en este
   * dispositivo, la registra (primer uso); si ya existe, autentica. Ambos
   * caminos disparan el prompt biométrico real del sistema operativo.
   */
  function verify() {
    if (!hasCredential()) {
      return register().then(function () { return { method: 'registered' }; });
    }
    return authenticate().then(function () { return { method: 'authenticated' }; });
  }

  window.BPAuth = {
    supported: supported,
    platformAvailable: platformAvailable,
    hasCredential: hasCredential,
    register: register,
    authenticate: authenticate,
    verify: verify,
    reset: function () { localStorage.removeItem(CRED_KEY); }
  };
})();
