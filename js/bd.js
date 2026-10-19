// La "base de datos": IndexedDB, que viene dentro del navegador. No toca la página.
// Los datos viven SOLO en este navegador y en este equipo: no se envía nada a ningún sitio.
// Si el navegador no deja usar IndexedDB (por ejemplo en algunos modos privados), uso una copia
// en memoria: todo funciona igual, pero se pierde al cerrar la pestaña.

const NOMBRE_BD = 'login-animado';
const VERSION_BD = 1;

// Cada "almacén" es como una tabla. Pongo cuál es su clave y qué índices tiene
// (un índice permite buscar por otro campo; "unico" significa que no puede repetirse).
const ALMACENES = {
  usuarios: { clave: 'id', indices: [{ nombre: 'correo', campo: 'correo', unico: true }] },
  sesiones: { clave: 'tokenHash', indices: [{ nombre: 'usuarioId', campo: 'usuarioId', unico: false }] },
  notas: { clave: 'id', indices: [{ nombre: 'usuarioId', campo: 'usuarioId', unico: false }] },
  intentos: { clave: 'correo', indices: [] }
};

let conexion = null;
let modoDeBd = 'memoria';
let aperturaEnCurso = null;
const enMemoria = {};
for (const nombre of Object.keys(ALMACENES)) enMemoria[nombre] = new Map();

function error(codigo) {
  const fallo = new Error(codigo);
  fallo.codigo = codigo;
  return fallo;
}

function esperar(peticion) {
  return new Promise(function (resolver, rechazar) {
    peticion.onsuccess = function () { resolver(peticion.result); };
    peticion.onerror = function () { rechazar(peticion.error); };
  });
}

// Abro la base de datos (solo la primera vez; las siguientes devuelvo lo mismo)
function abrirBd() {
  if (aperturaEnCurso) return aperturaEnCurso;
  aperturaEnCurso = new Promise(function (resolver) {
    let peticion = null;
    try {
      // OJO: en algunos navegadores, solo mirar indexedDB ya lanza un error de seguridad
      // (por ejemplo si se bloquean los datos del sitio), así que todo va dentro del try
      if (typeof indexedDB === 'undefined' || indexedDB === null) throw new Error('sin indexedDB');
      peticion = indexedDB.open(NOMBRE_BD, VERSION_BD);
    } catch (fallo) {
      modoDeBd = 'memoria';
      resolver(modoDeBd);
      return;
    }
    peticion.onupgradeneeded = function () {
      const bd = peticion.result;
      for (const nombre of Object.keys(ALMACENES)) {
        const almacen = bd.createObjectStore(nombre, { keyPath: ALMACENES[nombre].clave });
        for (const indice of ALMACENES[nombre].indices) almacen.createIndex(indice.nombre, indice.campo, { unique: indice.unico });
      }
    };
    peticion.onsuccess = function () {
      conexion = peticion.result;
      modoDeBd = 'indexeddb';
      resolver(modoDeBd);
    };
    peticion.onerror = peticion.onblocked = function () {
      modoDeBd = 'memoria';
      resolver(modoDeBd);
    };
  });
  return aperturaEnCurso;
}

function almacenDeTransaccion(nombre, escribir) {
  return conexion.transaction(nombre, escribir ? 'readwrite' : 'readonly').objectStore(nombre);
}

// ---------- Las operaciones. Todas devuelven una promesa y funcionan igual en los dos modos ----------

// Añado un objeto nuevo. Si ya existe uno con la misma clave o con el mismo valor único, falla con "EXISTE".
async function anadirObjeto(almacen, objeto) {
  await abrirBd();
  if (modoDeBd === 'memoria') {
    const mapa = enMemoria[almacen];
    const configuracion = ALMACENES[almacen];
    if (mapa.has(objeto[configuracion.clave])) throw error('EXISTE');
    for (const indice of configuracion.indices) {
      if (indice.unico && [...mapa.values()].some(function (otro) { return otro[indice.campo] === objeto[indice.campo]; })) throw error('EXISTE');
    }
    mapa.set(objeto[configuracion.clave], JSON.parse(JSON.stringify(objeto)));
    return;
  }
  try {
    await esperar(almacenDeTransaccion(almacen, true).add(objeto));
  } catch (fallo) {
    if (fallo && fallo.name === 'ConstraintError') throw error('EXISTE');
    throw fallo;
  }
}

// Guardo un objeto: si ya existía lo cambio y si no lo creo
async function guardarObjeto(almacen, objeto) {
  await abrirBd();
  if (modoDeBd === 'memoria') {
    enMemoria[almacen].set(objeto[ALMACENES[almacen].clave], JSON.parse(JSON.stringify(objeto)));
    return;
  }
  await esperar(almacenDeTransaccion(almacen, true).put(objeto));
}

async function leerObjeto(almacen, clave) {
  await abrirBd();
  if (modoDeBd === 'memoria') {
    const objeto = enMemoria[almacen].get(clave);
    return objeto ? JSON.parse(JSON.stringify(objeto)) : null;
  }
  const resultado = await esperar(almacenDeTransaccion(almacen, false).get(clave));
  return resultado || null;
}

// Todos los objetos que tienen cierto valor en un índice (por ejemplo, las notas de un usuario)
async function listarPorIndice(almacen, indice, valor) {
  await abrirBd();
  if (modoDeBd === 'memoria') {
    const campo = ALMACENES[almacen].indices.find(function (i) { return i.nombre === indice; }).campo;
    return [...enMemoria[almacen].values()].filter(function (o) { return o[campo] === valor; }).map(function (o) { return JSON.parse(JSON.stringify(o)); });
  }
  return esperar(almacenDeTransaccion(almacen, false).index(indice).getAll(valor));
}

async function borrarObjeto(almacen, clave) {
  await abrirBd();
  if (modoDeBd === 'memoria') {
    enMemoria[almacen].delete(clave);
    return;
  }
  await esperar(almacenDeTransaccion(almacen, true).delete(clave));
}

async function borrarPorIndice(almacen, indice, valor) {
  const objetos = await listarPorIndice(almacen, indice, valor);
  const clave = ALMACENES[almacen].clave;
  for (const objeto of objetos) await borrarObjeto(almacen, objeto[clave]);
}

// Solo para las pruebas: vacío la copia en memoria
function vaciarMemoria() {
  for (const nombre of Object.keys(enMemoria)) enMemoria[nombre].clear();
}
