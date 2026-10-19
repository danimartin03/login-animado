// El arranque de la página y el paso entre las dos pantallas (acceso y panel).
// Cada parte (tema, idioma, acceso, panel) tiene su archivo.

const CLAVE_SESION = 'login-animado:sesion';
const VISTAS = ['acceso', 'panel'];

let usuarioActual = null;
let fichaActual = '';
// Si el navegador no deja usar el almacenamiento, la ficha de sesión se queda aquí, en memoria
let fichaEnMemoria = '';

function porId(id) {
  return document.getElementById(id);
}

// ---------- La ficha de la sesión en el navegador ----------
// Si marqué "Recordarme" va a localStorage (dura días); si no, a sessionStorage (dura hasta cerrar la pestaña)

function leerFicha() {
  try {
    return localStorage.getItem(CLAVE_SESION) || sessionStorage.getItem(CLAVE_SESION) || fichaEnMemoria;
  } catch (error) {
    return fichaEnMemoria;
  }
}

function guardarFicha(sesion) {
  fichaEnMemoria = sesion.token;
  try {
    const dondeSi = sesion.recordar ? localStorage : sessionStorage;
    const dondeNo = sesion.recordar ? sessionStorage : localStorage;
    dondeSi.setItem(CLAVE_SESION, sesion.token);
    dondeNo.removeItem(CLAVE_SESION);
  } catch (error) {
    // Sin almacenamiento la sesión dura mientras no recargue la página
  }
}

function borrarFicha() {
  fichaEnMemoria = '';
  try {
    localStorage.removeItem(CLAVE_SESION);
    sessionStorage.removeItem(CLAVE_SESION);
  } catch (error) {
    // Nada que borrar
  }
}

// ---------- Cambiar de pantalla ----------

function mostrarVista(nombre, moverFoco) {
  for (const vista of VISTAS) {
    porId('vista' + vista.charAt(0).toUpperCase() + vista.slice(1)).hidden = vista !== nombre;
  }
  const mostrada = porId('vista' + nombre.charAt(0).toUpperCase() + nombre.slice(1));
  // Quito y vuelvo a poner la clase para que la animación de entrada se repita cada vez
  mostrada.classList.remove('entra');
  void mostrada.offsetWidth;
  mostrada.classList.add('entra');
  // Al cambiar de pantalla llevo el foco al título para que el lector de pantalla sepa dónde está
  if (moverFoco) mostrada.querySelector('h1').focus({ preventScroll: true });
}

function ponerNombreEnElPanel(nombre) {
  const titulo = porId('tituloPanel');
  titulo.dataset.i18nVars = JSON.stringify({ nombre: nombre });
  titulo.textContent = textoDe('saludo', { nombre: nombre });
}

// La llama acceso.js cuando alguien entra (o se registra) bien
function alEntrar(usuario, sesion) {
  usuarioActual = usuario;
  fichaActual = sesion.token;
  guardarFicha(sesion);
  ponerNombreEnElPanel(usuario.nombre);
  mostrarVista('panel', true);
}

async function salir() {
  try {
    await cerrarSesion(fichaActual);
  } catch (error) {
    // Aunque falle el borrado, la ficha se quita de este navegador
  }
  borrarFicha();
  usuarioActual = null;
  fichaActual = '';
  reiniciarAcceso();
  mostrarVista('acceso', true);
}

async function arrancar() {
  iniciarIdioma();
  iniciarTema();
  iniciarFondo();
  iniciarAcceso();
  porId('botonSalir').addEventListener('click', salir);

  // Si hay una ficha guardada, no enseño el acceso mientras compruebo que sigue valiendo
  const ficha = leerFicha();
  if (ficha) porId('vistaAcceso').hidden = true;

  try {
    await abrirBd();
    if (modoDeBd === 'memoria') porId('avisoMemoria').hidden = false;
    if (ficha) {
      const sesion = await usuarioDeSesion(ficha);
      if (sesion) {
        usuarioActual = sesion.usuario;
        fichaActual = ficha;
        ponerNombreEnElPanel(sesion.usuario.nombre);
        mostrarVista('panel', false);
        return;
      }
      borrarFicha();
    }
  } catch (error) {
    // Si algo falla al comprobar, se queda en el acceso
  }
  mostrarVista('acceso', false);
}

arrancar();
