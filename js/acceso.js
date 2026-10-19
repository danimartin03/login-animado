// La pantalla de acceso: la tarjeta que gira, los formularios de entrar y de registrarse,
// el vial de tinta que mide la contraseña, los mensajes de error, el temblor y el confeti.

// El código de error de usuarios.js -> la clave del texto que se enseña
const TEXTO_DE_ERROR = {
  CORREO_INVALIDO: 'errCorreo',
  CLAVE_CORTA: 'errClaveCorta',
  CLAVE_LARGA: 'errClaveLarga',
  NOMBRE_INVALIDO: 'errNombre',
  CREDENCIALES: 'errCredenciales',
  EXISTE: 'errExiste',
  BLOQUEADO: 'errBloqueado',
  NO_SOPORTADO: 'errNoSoportado'
};

const TEXTO_DE_FUERZA = { vacia: 'fuerzaVacia', debil: 'fuerzaDebil', media: 'fuerzaMedia', fuerte: 'fuerzaFuerte' };

let caraVisible = 'entrar';

function quiereMenosMovimiento() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------- Mensajes de error ----------

// Escribo el mensaje con data-i18n, así si cambias de idioma se traduce solo
function mostrarMensaje(idMensaje, clave, variables, campo) {
  const caja = porId(idMensaje);
  caja.dataset.i18n = clave;
  caja.dataset.i18nVars = JSON.stringify(variables || {});
  caja.textContent = textoDe(clave, variables);
  if (campo) {
    campo.setAttribute('aria-invalid', 'true');
    campo.setAttribute('aria-describedby', idMensaje);
    campo.focus();
  }
}

function quitarMensaje(formulario) {
  const caja = formulario.querySelector('.mensaje');
  delete caja.dataset.i18n;
  delete caja.dataset.i18nVars;
  caja.textContent = '';
  for (const campo of formulario.querySelectorAll('[aria-invalid]')) campo.removeAttribute('aria-invalid');
}

// Si falla algo, la tarjeta tiembla un momento (menos si prefiero menos movimiento)
function temblar() {
  if (quiereMenosMovimiento()) return;
  porId('giro').animate(
    [{ translate: '0' }, { translate: '-10px' }, { translate: '9px' }, { translate: '-6px' }, { translate: '4px' }, { translate: '0' }],
    { duration: 340, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
  );
}

// ---------- La tarjeta que gira ----------

function primerCampoDe(formulario) {
  return formulario.querySelector('input:not([type="checkbox"])');
}

// "inert" hace que lo que no se ve no se pueda enfocar ni leer con el teclado o el lector de pantalla
function ponerCara(cara, sinFoco) {
  caraVisible = cara;
  const aRegistro = cara === 'registro';
  const entrar = porId('formEntrar');
  const registro = porId('formRegistro');
  porId('giro').classList.toggle('volteado', aRegistro);
  entrar.inert = aRegistro;
  registro.inert = !aRegistro;
  entrar.setAttribute('aria-hidden', String(aRegistro));
  registro.setAttribute('aria-hidden', String(!aRegistro));
  if (!sinFoco) primerCampoDe(aRegistro ? registro : entrar).focus({ preventScroll: true });
}

function girar() {
  ponerCara(caraVisible === 'entrar' ? 'registro' : 'entrar');
}

// ---------- Mostrar u ocultar la contraseña ----------

function etiquetaDelOjo(boton) {
  boton.setAttribute('aria-label', textoDe(boton.getAttribute('aria-pressed') === 'true' ? 'ocultarClave' : 'mostrarClave'));
}

function alternarClave(boton) {
  const campo = porId(boton.dataset.ojo);
  const visible = campo.type === 'password';
  campo.type = visible ? 'text' : 'password';
  boton.setAttribute('aria-pressed', String(visible));
  etiquetaDelOjo(boton);
}

// ---------- El vial de tinta ----------

function actualizarVial() {
  const puntuacion = puntuarClave(porId('registroClave').value);
  porId('vialRelleno').dataset.nivel = puntuacion.nivel;
  const texto = porId('fuerzaTexto');
  texto.dataset.i18n = TEXTO_DE_FUERZA[puntuacion.nivel];
  texto.textContent = textoDe(TEXTO_DE_FUERZA[puntuacion.nivel]);
}

// ---------- Confeti al registrarse ----------

function lanzarConfeti() {
  if (quiereMenosMovimiento()) return;
  const caja = porId('giro').getBoundingClientRect();
  const colores = ['var(--acento)', '#f59e0b', '#22c55e', '#38bdf8', '#f472b6', 'var(--tinta)'];
  for (let i = 0; i < 36; i++) {
    const pieza = document.createElement('span');
    pieza.className = 'confeti';
    pieza.setAttribute('aria-hidden', 'true');
    pieza.style.background = colores[i % colores.length];
    pieza.style.left = caja.left + caja.width / 2 + 'px';
    pieza.style.top = caja.top + caja.height / 2 + 'px';
    document.body.append(pieza);
    const dx = (Math.random() - 0.5) * 520;
    const dy = -120 - Math.random() * 260;
    const giro = Math.random() * 720 - 360;
    // Sube rápido y cae despacio, como el confeti de verdad (la gravedad hace que baje más que sube)
    pieza.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + dx * 0.7 + 'px, ' + dy + 'px) rotate(' + giro * 0.6 + 'deg)', opacity: 1, offset: 0.45 },
      { transform: 'translate(' + dx + 'px, ' + (dy + 420) + 'px) rotate(' + giro + 'deg)', opacity: 0 }
    ], { duration: 1300 + Math.random() * 500, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }).onfinish = function () { pieza.remove(); };
  }
}

// ---------- Botón ocupado ----------

// Mientras el navegador hace la cuenta de la contraseña (puede tardar) el botón avisa
function ocuparBoton(boton, claveOcupado) {
  const texto = boton.querySelector('span');
  boton.disabled = true;
  boton.dataset.claveOriginal = texto.dataset.i18n;
  texto.dataset.i18n = claveOcupado;
  texto.textContent = textoDe(claveOcupado);
}

function liberarBoton(boton) {
  const texto = boton.querySelector('span');
  boton.disabled = false;
  texto.dataset.i18n = boton.dataset.claveOriginal;
  texto.textContent = textoDe(boton.dataset.claveOriginal);
}

function claveDeResultado(resultado) {
  return TEXTO_DE_ERROR[resultado.error] || 'errGeneral';
}

// ---------- Enviar los formularios ----------

async function alEnviarEntrar(evento) {
  evento.preventDefault();
  const formulario = porId('formEntrar');
  quitarMensaje(formulario);
  const campoCorreo = porId('entrarCorreo');
  const campoClave = porId('entrarClave');

  if (!esCorreoValido(normalizarCorreo(campoCorreo.value))) {
    mostrarMensaje('mensajeEntrar', 'errCorreo', null, campoCorreo);
    temblar();
    return;
  }
  if (campoClave.value === '') {
    mostrarMensaje('mensajeEntrar', 'errClaveFalta', null, campoClave);
    temblar();
    return;
  }

  const boton = porId('botonEntrar');
  ocuparBoton(boton, 'entrando');
  let resultado = null;
  try {
    resultado = await iniciarSesion({ correo: campoCorreo.value, clave: campoClave.value, recordar: porId('entrarRecordar').checked });
  } catch (fallo) {
    resultado = { ok: false, error: 'GENERAL' };
  }
  liberarBoton(boton);

  if (!resultado.ok) {
    mostrarMensaje('mensajeEntrar', claveDeResultado(resultado), resultado.segundos ? { s: resultado.segundos } : null, resultado.error === 'CREDENCIALES' ? campoClave : null);
    temblar();
    return;
  }
  alEntrar(resultado.usuario, resultado.sesion);
}

async function alEnviarRegistro(evento) {
  evento.preventDefault();
  const formulario = porId('formRegistro');
  quitarMensaje(formulario);
  const campoNombre = porId('registroNombre');
  const campoCorreo = porId('registroCorreo');
  const campoClave = porId('registroClave');

  // Compruebo aquí lo básico para avisar rápido; usuarios.js lo vuelve a comprobar por si acaso
  const problemaDeClave = validarClave(campoClave.value);
  let aviso = null;
  if (!esNombreValido(limpiarNombre(campoNombre.value))) aviso = ['errNombre', campoNombre];
  else if (!esCorreoValido(normalizarCorreo(campoCorreo.value))) aviso = ['errCorreo', campoCorreo];
  else if (problemaDeClave) aviso = [TEXTO_DE_ERROR[problemaDeClave], campoClave];
  if (aviso) {
    mostrarMensaje('mensajeRegistro', aviso[0], null, aviso[1]);
    temblar();
    return;
  }

  const boton = porId('botonCrear');
  ocuparBoton(boton, 'creando');
  let resultado = null;
  try {
    resultado = await registrar({ nombre: campoNombre.value, correo: campoCorreo.value, clave: campoClave.value });
    if (resultado.ok) resultado = await abrirSesionNueva(resultado.usuario.id, false);
  } catch (fallo) {
    resultado = { ok: false, error: 'GENERAL' };
  }
  liberarBoton(boton);

  if (!resultado.ok) {
    mostrarMensaje('mensajeRegistro', claveDeResultado(resultado), null, resultado.error === 'EXISTE' ? campoCorreo : null);
    temblar();
    return;
  }
  // Confeti y, un momento después, al panel (para que dé tiempo a verlo)
  lanzarConfeti();
  setTimeout(function () { alEntrar(resultado.usuario, resultado.sesion); }, quiereMenosMovimiento() ? 0 : 900);
}

// Vuelvo a dejar el acceso como nuevo (al salir de la cuenta)
function reiniciarAcceso() {
  for (const formulario of [porId('formEntrar'), porId('formRegistro')]) {
    formulario.reset();
    quitarMensaje(formulario);
  }
  for (const boton of document.querySelectorAll('.ojo')) {
    porId(boton.dataset.ojo).type = 'password';
    boton.setAttribute('aria-pressed', 'false');
    etiquetaDelOjo(boton);
  }
  // Sin animación: que no se vea girar la tarjeta mientras aparece la pantalla
  const giro = porId('giro');
  giro.classList.add('sin-giro');
  ponerCara('entrar', true);
  void giro.offsetWidth;
  giro.classList.remove('sin-giro');
  actualizarVial();
}

function iniciarAcceso() {
  for (const boton of document.querySelectorAll('[data-girar]')) boton.addEventListener('click', girar);
  for (const boton of document.querySelectorAll('.ojo')) boton.addEventListener('click', function () { alternarClave(boton); });
  porId('formEntrar').addEventListener('submit', alEnviarEntrar);
  porId('formRegistro').addEventListener('submit', alEnviarRegistro);
  porId('registroClave').addEventListener('input', actualizarVial);
  // Al escribir se quita el mensaje de error: ya no vale
  for (const formulario of [porId('formEntrar'), porId('formRegistro')]) {
    formulario.addEventListener('input', function () { quitarMensaje(formulario); });
  }
  document.addEventListener('idiomacambiado', function () {
    for (const boton of document.querySelectorAll('.ojo')) etiquetaDelOjo(boton);
  });
  for (const boton of document.querySelectorAll('.ojo')) etiquetaDelOjo(boton);
  actualizarVial();
}
