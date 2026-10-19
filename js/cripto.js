// Lo que tiene que ver con contraseñas y números al azar. No toca la página.
// Las contraseñas NUNCA se guardan: se guarda un "hash", que es el resultado de una cuenta que no se
// puede deshacer. Uso PBKDF2 con SHA-256, que viene en el propio navegador (Web Crypto).
// Cada contraseña lleva su "sal" (bytes al azar) para que dos personas con la misma contraseña
// no tengan el mismo hash. 600.000 vueltas es lo que recomienda OWASP para PBKDF2-SHA256.

const ITERACIONES_PBKDF2 = 600000;
const BYTES_DE_SAL = 16;
const BYTES_DE_HASH = 32;
const ALGORITMO_DE_CLAVE = 'PBKDF2-SHA256';

function hayCripto() {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.getRandomValues === 'function';
}

// bytes -> texto en base64 (para poder guardarlos como texto)
function bytesABase64(bytes) {
  let texto = '';
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto);
}

function base64ABytes(base64) {
  const texto = atob(base64);
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
  return bytes;
}

function bytesAlAzar(cantidad) {
  return crypto.getRandomValues(new Uint8Array(cantidad));
}

// Un texto al azar seguro para usar como identificador o como ficha de sesión
function textoAlAzar(bytes) {
  return bytesABase64(bytesAlAzar(bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function derivarHash(clave, sal, iteraciones) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, material, BYTES_DE_HASH * 8);
  return new Uint8Array(bits);
}

// Comparo dos textos mirando SIEMPRE todos los caracteres. Si parara en la primera diferencia,
// el tiempo que tarda daría pistas de cuánto se parece lo que se escribió al hash guardado.
function compararSinPrisa(a, b) {
  const largo = Math.max(a.length, b.length);
  let diferencia = a.length ^ b.length;
  for (let i = 0; i < largo; i++) {
    diferencia |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diferencia === 0;
}

// Lo que guardo de una contraseña: el hash, la sal, y con qué algoritmo y cuántas vueltas
async function crearHashDeClave(clave, iteraciones) {
  const vueltas = iteraciones || ITERACIONES_PBKDF2;
  const sal = bytesAlAzar(BYTES_DE_SAL);
  const hash = await derivarHash(clave, sal, vueltas);
  return { algoritmo: ALGORITMO_DE_CLAVE, iteraciones: vueltas, sal: bytesABase64(sal), hash: bytesABase64(hash) };
}

async function comprobarClave(clave, guardado) {
  if (!guardado || guardado.algoritmo !== ALGORITMO_DE_CLAVE) return false;
  const calculado = await derivarHash(clave, base64ABytes(guardado.sal), guardado.iteraciones);
  return compararSinPrisa(bytesABase64(calculado), guardado.hash);
}

// El hash (SHA-256) de un texto: lo uso para no guardar la ficha de sesión tal cual
async function hashRapido(texto) {
  const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return bytesABase64(new Uint8Array(resumen));
}
