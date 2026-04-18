/**
 * Lightweight WebAuthn helpers — replaces @simplewebauthn/browser
 * Uses the native navigator.credentials API directly.
 */

// ── Base64URL helpers ─────────────────────────────────────────────────────────

function base64URLToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64URL(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Registration (create a new passkey) ───────────────────────────────────────

export async function startRegistration(options) {
  // The server wraps options in { publicKey: { ... } }
  const publicKey = options.publicKey || options;

  // Decode challenge
  publicKey.challenge = base64URLToBuffer(publicKey.challenge);

  // Decode user.id
  if (publicKey.user?.id) {
    publicKey.user.id = base64URLToBuffer(publicKey.user.id);
  }

  // Decode excludeCredentials
  if (publicKey.excludeCredentials) {
    publicKey.excludeCredentials = publicKey.excludeCredentials.map((c) => ({
      ...c,
      id: base64URLToBuffer(c.id),
    }));
  }

  const credential = await navigator.credentials.create({ publicKey });

  // Serialize response for server
  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bufferToBase64URL(credential.response.attestationObject),
      clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

// ── Authentication (use existing passkey) ─────────────────────────────────────

export async function startAuthentication(options) {
  // The server wraps options in { publicKey: { ... } }
  const publicKey = options.publicKey || options;

  // Decode challenge
  publicKey.challenge = base64URLToBuffer(publicKey.challenge);

  // Decode allowCredentials
  if (publicKey.allowCredentials) {
    publicKey.allowCredentials = publicKey.allowCredentials.map((c) => ({
      ...c,
      id: base64URLToBuffer(c.id),
    }));
  }

  const credential = await navigator.credentials.get({ publicKey });

  // Serialize response for server
  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bufferToBase64URL(credential.response.authenticatorData),
      clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
      signature: bufferToBase64URL(credential.response.signature),
      userHandle: credential.response.userHandle
        ? bufferToBase64URL(credential.response.userHandle)
        : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}
