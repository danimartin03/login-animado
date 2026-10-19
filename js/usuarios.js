// Cuentas, sesiones y notas. Aquí está la lógica de "quién eres y qué es tuyo". No toca la página.
// Usa cripto.js (contraseñas) y bd.js (guardar). Todas las funciones devuelven una promesa.
// Las que pueden fallar por culpa de lo que escribió la persona devuelven { ok: false, error: 'CODIGO' }
// en vez de lanzar un error; la página traduce el código a un mensaje en su idioma.

const MINIMO_CLAVE = 8;
const MAXIMO_CLAVE = 128;
const MAXIMO_NOMBRE = 40;
const MAXIMO_CORREO = 120;
const MAXIMO_NOTAS = 200;
const MAXIMO_TEXTO_NOTA = 200;
const FALLOS_MAXIMOS = 5;
const BLOQUEO_MS = 30000;
const HORAS_DE_SESION = 12;
const DIAS_DE_SESION_RECORDADA = 7;
const MAXIMO_ACCESOS_GUARDADOS = 60;
const COLORES_DE_AVATAR = ['#ff5a3c', '#f59e0b', '#22c55e', '#38bdf8', '#f472b6', '#94a3b8'];

// Cuántas vueltas de PBKDF2 uso. Las pruebas bajan este número para no tardar medio segundo por contraseña.
let iteracionesDeClave = ITERACIONES_PBKDF2;

function ponerIteracionesParaPruebas(numero) {
  iteracionesDeClave = numero;
  hashFalso = null;
}

// ---------- Comprobar lo que escribe la persona ----------

// OJO: solo acepto textos de verdad. Si no, una lista como ['a@b.co'] se convertiría en texto sin
// que nadie se diera cuenta y pasaría como un correo válido.
function soloTexto(valor) {
  return typeof valor === 'string' ? valor : '';
}

function normalizarCorreo(correo) {
  return soloTexto(correo).trim().toLowerCase();
}

function esCorreoValido(correo) {
  return correo.length <= MAXIMO_CORREO && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo);
}

function limpiarNombre(nombre) {
  return soloTexto(nombre).replace(/\s+/g, ' ').trim();
}

function esNombreValido(nombre) {
  // Sin caracteres de control (saltos raros, etc.)
  return nombre.length >= 1 && nombre.length <= MAXIMO_NOMBRE && !/[\u0000-\u001f\u007f]/.test(nombre);
}

// '' si la contraseña vale, o el código de por qué no vale
function validarClave(clave) {
  if (typeof clave !== 'string' || clave.length < MINIMO_CLAVE) return 'CLAVE_CORTA';
  if (clave.length > MAXIMO_CLAVE) return 'CLAVE_LARGA';
  return '';
}

const CLAVES_COMUNES = ['password', '12345678', '123456789', 'qwertyui', 'qwerty123', 'contraseña', 'abcd1234', 'iloveyou', '11111111'];

// Mido lo fuerte que es una contraseña de 0 a 3. Es una orientación, no una garantía:
// miro la longitud y cuántos tipos de caracteres mezcla, y descarto las más típicas.
function puntuarClave(clave) {
  if (!clave) return { puntos: 0, nivel: 'vacia' };
  const largo = clave.length;
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(function (patron) { return patron.test(clave); }).length;
  let puntos = 1;
  if (largo >= 8 && tipos >= 2) puntos = 2;
  if (largo >= 12 && tipos >= 3) puntos = 3;
  if (largo >= 16 && tipos >= 2) puntos = 3;
  // Una frase larga también vale, aunque sea toda en minúsculas
  if (largo >= 20) puntos = 3;
  const minuscula = clave.toLowerCase();
  const repetida = /^(.)\1+$/.test(clave);
  if (repetida || CLAVES_COMUNES.some(function (comun) { return minuscula.includes(comun); })) puntos = Math.min(puntos, 1);
  return { puntos: puntos, nivel: ['vacia', 'debil', 'media', 'fuerte'][puntos] };
}

// El usuario sin el hash de su contraseña: es lo único que enseña la página
function usuarioPublico(usuario) {
  return { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, color: usuario.color, creado: usuario.creado };
}

// ---------- Fechas ----------

// 2026-10-19 (de la hora local)
function fechaLocal(fecha) {
  return fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0') + '-' + String(fecha.getDate()).padStart(2, '0');
}

function restarDias(fecha, dias) {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  copia.setDate(copia.getDate() - dias);
  return copia;
}

// Cuántos días seguidos (terminando hoy) hay un acceso
function calcularRacha(accesos, hoy) {
  const conjunto = new Set(accesos);
  let racha = 0;
  while (conjunto.has(fechaLocal(restarDias(hoy, racha)))) racha++;
  return racha;
}

// ---------- Registro ----------

async function registrar(datos) {
  if (!hayCripto()) return { ok: false, error: 'NO_SOPORTADO' };
  const nombre = limpiarNombre(datos.nombre);
  const correo = normalizarCorreo(datos.correo);
  if (!esNombreValido(nombre)) return { ok: false, error: 'NOMBRE_INVALIDO' };
  if (!esCorreoValido(correo)) return { ok: false, error: 'CORREO_INVALIDO' };
  const problema = validarClave(datos.clave);
  if (problema) return { ok: false, error: problema };

  const usuario = {
    id: textoAlAzar(12),
    nombre: nombre,
    correo: correo,
    color: COLORES_DE_AVATAR[bytesAlAzar(1)[0] % COLORES_DE_AVATAR.length],
    creado: new Date().toISOString(),
    hash: await crearHashDeClave(datos.clave, iteracionesDeClave),
    accesos: []
  };
  try {
    await anadirObjeto('usuarios', usuario);
  } catch (fallo) {
    if (fallo.codigo === 'EXISTE') return { ok: false, error: 'EXISTE' };
    throw fallo;
  }
  return { ok: true, usuario: usuarioPublico(usuario) };
}

// ---------- Sesiones ----------

// La ficha (token) va a la página y en la base de datos solo guardo su hash, así que
// aunque alguien viera la base de datos no podría usar las fichas.
async function crearSesion(usuarioId, recordar) {
  const token = textoAlAzar(32);
  const ahora = Date.now();
  const duracion = recordar ? DIAS_DE_SESION_RECORDADA * 24 * 3600 * 1000 : HORAS_DE_SESION * 3600 * 1000;
  await guardarObjeto('sesiones', { tokenHash: await hashRapido(token), usuarioId: usuarioId, creada: ahora, expira: ahora + duracion });
  return { token: token, expira: ahora + duracion, recordar: !!recordar };
}

async function usuarioDeSesion(token) {
  if (typeof token !== 'string' || token === '' || token.length > 100 || !hayCripto()) return null;
  const tokenHash = await hashRapido(token);
  const sesion = await leerObjeto('sesiones', tokenHash);
  if (!sesion) return null;
  if (sesion.expira < Date.now()) {
    await borrarObjeto('sesiones', tokenHash);
    return null;
  }
  const usuario = await leerObjeto('usuarios', sesion.usuarioId);
  if (!usuario) {
    await borrarObjeto('sesiones', tokenHash);
    return null;
  }
  return { usuario: usuarioPublico(usuario), expira: sesion.expira };
}

async function cerrarSesion(token) {
  if (typeof token !== 'string' || token === '' || !hayCripto()) return;
  await borrarObjeto('sesiones', await hashRapido(token));
}

// ---------- Iniciar sesión (con bloqueo si fallo muchas veces) ----------

async function segundosDeBloqueo(clave) {
  const intento = await leerObjeto('intentos', clave);
  if (!intento || !intento.hasta || intento.hasta <= Date.now()) return 0;
  return Math.ceil((intento.hasta - Date.now()) / 1000);
}

async function anotarFallo(clave) {
  const intento = (await leerObjeto('intentos', clave)) || { correo: clave, fallos: 0, hasta: 0 };
  intento.fallos++;
  // Al llegar al máximo se bloquea un rato y se empieza de cero
  if (intento.fallos >= FALLOS_MAXIMOS) {
    intento.hasta = Date.now() + BLOQUEO_MS;
    intento.fallos = 0;
  }
  await guardarObjeto('intentos', intento);
}

// Cuando el correo no existe también hago la cuenta del hash, para que tarde lo mismo y
// no se pueda saber por el tiempo si una cuenta existe o no.
let hashFalso = null;

async function gastarTiempoDeHash(clave) {
  if (!hashFalso) hashFalso = await crearHashDeClave('relleno', iteracionesDeClave);
  await comprobarClave(clave, hashFalso);
}

async function registrarAcceso(usuario) {
  const hoy = fechaLocal(new Date());
  const accesos = usuario.accesos || [];
  if (accesos[accesos.length - 1] !== hoy) accesos.push(hoy);
  usuario.accesos = accesos.slice(-MAXIMO_ACCESOS_GUARDADOS);
  await guardarObjeto('usuarios', usuario);
}

async function iniciarSesion(datos) {
  if (!hayCripto()) return { ok: false, error: 'NO_SOPORTADO' };
  const correo = normalizarCorreo(datos.correo);
  const clave = typeof datos.clave === 'string' ? datos.clave : '';
  // Si el correo o la contraseña no tienen ni forma de valer, no gasto tiempo: es "credenciales" igual
  if (!esCorreoValido(correo) || clave === '' || clave.length > MAXIMO_CLAVE) return { ok: false, error: 'CREDENCIALES' };

  const espera = await segundosDeBloqueo(correo);
  if (espera > 0) return { ok: false, error: 'BLOQUEADO', segundos: espera };

  const usuario = await leerPorCorreo(correo);
  let correcta = false;
  if (usuario) correcta = await comprobarClave(clave, usuario.hash);
  else await gastarTiempoDeHash(clave);

  if (!correcta) {
    await anotarFallo(correo);
    const ahoraEspera = await segundosDeBloqueo(correo);
    if (ahoraEspera > 0) return { ok: false, error: 'BLOQUEADO', segundos: ahoraEspera };
    // El mensaje es el mismo si falla el correo o la contraseña: no digo cuál
    return { ok: false, error: 'CREDENCIALES' };
  }

  await borrarObjeto('intentos', correo);
  await registrarAcceso(usuario);
  const sesion = await crearSesion(usuario.id, !!datos.recordar);
  return { ok: true, usuario: usuarioPublico(usuario), sesion: sesion };
}

async function leerPorCorreo(correo) {
  const encontrados = await listarPorIndice('usuarios', 'correo', correo);
  return encontrados[0] || null;
}

// ---------- Perfil ----------

async function leerUsuarioCompleto(usuarioId) {
  return leerObjeto('usuarios', usuarioId);
}

async function actualizarPerfil(usuarioId, cambios) {
  const usuario = await leerUsuarioCompleto(usuarioId);
  if (!usuario) return { ok: false, error: 'NO_EXISTE' };
  const nombre = limpiarNombre(cambios.nombre);
  if (!esNombreValido(nombre)) return { ok: false, error: 'NOMBRE_INVALIDO' };
  if (!COLORES_DE_AVATAR.includes(cambios.color)) return { ok: false, error: 'COLOR_INVALIDO' };
  usuario.nombre = nombre;
  usuario.color = cambios.color;
  await guardarObjeto('usuarios', usuario);
  return { ok: true, usuario: usuarioPublico(usuario) };
}

// Para cambiar la contraseña hay que saber la actual. También cuenta los fallos, como al entrar.
async function cambiarClave(usuarioId, claveActual, claveNueva) {
  const usuario = await leerUsuarioCompleto(usuarioId);
  if (!usuario) return { ok: false, error: 'NO_EXISTE' };
  const clavePrueba = 'cambio:' + usuarioId;
  const espera = await segundosDeBloqueo(clavePrueba);
  if (espera > 0) return { ok: false, error: 'BLOQUEADO', segundos: espera };
  if (!(await comprobarClave(claveActual, usuario.hash))) {
    await anotarFallo(clavePrueba);
    return { ok: false, error: 'CREDENCIALES' };
  }
  const problema = validarClave(claveNueva);
  if (problema) return { ok: false, error: problema };
  usuario.hash = await crearHashDeClave(claveNueva, iteracionesDeClave);
  await guardarObjeto('usuarios', usuario);
  await borrarObjeto('intentos', clavePrueba);
  return { ok: true };
}

async function eliminarCuenta(usuarioId, clave) {
  const usuario = await leerUsuarioCompleto(usuarioId);
  if (!usuario) return { ok: false, error: 'NO_EXISTE' };
  if (!(await comprobarClave(clave, usuario.hash))) return { ok: false, error: 'CREDENCIALES' };
  await borrarPorIndice('notas', 'usuarioId', usuarioId);
  await borrarPorIndice('sesiones', 'usuarioId', usuarioId);
  await borrarObjeto('intentos', usuario.correo);
  await borrarObjeto('usuarios', usuarioId);
  return { ok: true };
}

async function accesosDeUsuario(usuarioId) {
  const usuario = await leerUsuarioCompleto(usuarioId);
  return usuario ? usuario.accesos || [] : [];
}

// ---------- Notas y tareas (cada una es de un usuario) ----------

async function listarNotas(usuarioId) {
  const notas = await listarPorIndice('notas', 'usuarioId', usuarioId);
  return notas.sort(function (a, b) { return b.creada - a.creada; });
}

async function crearNota(usuarioId, texto) {
  const limpio = soloTexto(texto).replace(/\s+/g, ' ').trim();
  if (limpio === '') return { ok: false, error: 'NOTA_VACIA' };
  if (limpio.length > MAXIMO_TEXTO_NOTA) return { ok: false, error: 'NOTA_LARGA' };
  const actuales = await listarPorIndice('notas', 'usuarioId', usuarioId);
  if (actuales.length >= MAXIMO_NOTAS) return { ok: false, error: 'DEMASIADAS_NOTAS' };
  const nota = { id: textoAlAzar(9), usuarioId: usuarioId, texto: limpio, hecha: false, creada: Date.now(), hechaEn: 0 };
  await anadirObjeto('notas', nota);
  return { ok: true, nota: nota };
}

// Solo puedo tocar mis propias notas: compruebo siempre que el usuario sea el dueño
async function leerNotaDe(usuarioId, notaId) {
  const nota = await leerObjeto('notas', notaId);
  return nota && nota.usuarioId === usuarioId ? nota : null;
}

async function marcarNota(usuarioId, notaId, hecha) {
  const nota = await leerNotaDe(usuarioId, notaId);
  if (!nota) return { ok: false, error: 'NO_EXISTE' };
  nota.hecha = !!hecha;
  nota.hechaEn = hecha ? Date.now() : 0;
  await guardarObjeto('notas', nota);
  return { ok: true, nota: nota };
}

async function borrarNota(usuarioId, notaId) {
  const nota = await leerNotaDe(usuarioId, notaId);
  if (!nota) return { ok: false, error: 'NO_EXISTE' };
  await borrarObjeto('notas', notaId);
  return { ok: true };
}

function resumirNotas(notas) {
  const hechas = notas.filter(function (nota) { return nota.hecha; }).length;
  return { total: notas.length, hechas: hechas, pendientes: notas.length - hechas };
}

// Para la gráfica: cuántas cosas pasaron cada uno de los últimos 7 días (crear o completar una nota)
function actividadDeLaSemana(notas, hoy) {
  const dias = [];
  for (let i = 6; i >= 0; i--) dias.push({ fecha: fechaLocal(restarDias(hoy, i)), cantidad: 0 });
  const indices = {};
  dias.forEach(function (dia, i) { indices[dia.fecha] = i; });
  for (const nota of notas) {
    const creada = fechaLocal(new Date(nota.creada));
    if (indices[creada] !== undefined) dias[indices[creada]].cantidad++;
    if (nota.hecha && nota.hechaEn) {
      const hecha = fechaLocal(new Date(nota.hechaEn));
      if (indices[hecha] !== undefined) dias[indices[hecha]].cantidad++;
    }
  }
  return dias;
}
