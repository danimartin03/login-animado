// El panel: resumen con números y gráfica, notas y tareas, y perfil.
// Los datos salen de usuarios.js (que ya comprueba que cada persona solo toca lo suyo).
// Todo lo que escribe la persona se pone en la página con textContent, nunca como HTML.

const SECCIONES_DEL_PANEL = ['resumen', 'notas', 'perfil'];
const ERRORES_DE_NOTA = { NOTA_VACIA: 'errNotaVacia', NOTA_LARGA: 'errNotaLarga', DEMASIADAS_NOTAS: 'errDemasiadas' };

let seccionDelPanel = 'resumen';
let filtroDeNotas = 'todas';
let notasDelUsuario = [];
let temporizadorDeMensaje = null;

// En los formularios del panel solo se pide la contraseña, así que el error de "credenciales"
// se dice como "contraseña incorrecta"
function claveDeErrorEnPanel(codigo) {
  if (codigo === 'CREDENCIALES') return 'errClaveIncorrecta';
  return TEXTO_DE_ERROR[codigo] || 'errGeneral';
}

function panelVisible() {
  return !porId('vistaPanel').hidden;
}

// ---------- Datos de la persona (avatar, nombre, saludo) ----------

// Las iniciales: la primera letra de las dos primeras palabras (Array.from para no partir letras raras)
function inicialesDe(nombre) {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(function (palabra) { return Array.from(palabra)[0].toUpperCase(); }).join('');
}

function ponerDatosDeUsuario(usuario) {
  const avatar = porId('avatar');
  avatar.textContent = inicialesDe(usuario.nombre);
  avatar.style.background = usuario.color;
  porId('usuarioNombre').textContent = usuario.nombre;
  porId('usuarioCorreo').textContent = usuario.correo;
  const saludo = porId('tituloPanel');
  saludo.dataset.i18nVars = JSON.stringify({ nombre: usuario.nombre });
  saludo.textContent = textoDe('saludo', { nombre: usuario.nombre });
  porId('perfilNombre').value = usuario.nombre;
  pintarColores(usuario.color);
}

// ---------- Cambiar de sección ----------

function irASeccion(nombre, moverFoco) {
  if (!SECCIONES_DEL_PANEL.includes(nombre)) return;
  const cambia = nombre !== seccionDelPanel;
  seccionDelPanel = nombre;
  for (const seccion of SECCIONES_DEL_PANEL) {
    const elemento = porId('seccion' + seccion.charAt(0).toUpperCase() + seccion.slice(1));
    elemento.hidden = seccion !== nombre;
  }
  for (const boton of document.querySelectorAll('.nav-boton[data-seccion]')) {
    if (boton.dataset.seccion === nombre) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  }
  const mostrada = porId('seccion' + nombre.charAt(0).toUpperCase() + nombre.slice(1));
  if (cambia) {
    // Repito la animación de entrada quitando y poniendo la clase
    mostrada.classList.remove('entra-seccion');
    void mostrada.offsetWidth;
    mostrada.classList.add('entra-seccion');
  }
  if (nombre === 'resumen') {
    pintarEstadisticas(true);
    pintarGrafica(true);
    pintarRecientes();
  }
  if (moverFoco) mostrada.setAttribute('tabindex', '-1');
  if (moverFoco) mostrada.focus({ preventScroll: true });
}

// ---------- Resumen ----------

// Un número que sube de 0 hasta su valor (si no quiero movimiento, aparece ya puesto)
function animarNumero(elemento, valor, conAnimacion) {
  if (!conAnimacion || quiereMenosMovimiento() || valor === 0) {
    elemento.textContent = String(valor);
    return;
  }
  const inicio = performance.now();
  const duracion = 650;
  function paso(ahora) {
    const progreso = Math.min(1, (ahora - inicio) / duracion);
    // Empieza rápido y frena al final (ease-out cúbico)
    elemento.textContent = String(Math.round(valor * (1 - Math.pow(1 - progreso, 3))));
    if (progreso < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}

function crearTarjetaDeEstadistica(claveTexto, valor, orden, conAnimacion) {
  const tarjeta = document.createElement('div');
  tarjeta.className = 'tarjeta estadistica';
  tarjeta.style.setProperty('--orden', orden);
  const etiqueta = document.createElement('span');
  etiqueta.dataset.i18n = claveTexto;
  etiqueta.textContent = textoDe(claveTexto);
  const numero = document.createElement('strong');
  tarjeta.append(etiqueta, numero);
  animarNumero(numero, valor, conAnimacion);
  return tarjeta;
}

async function pintarEstadisticas(conAnimacion) {
  const resumen = resumirNotas(notasDelUsuario);
  const racha = calcularRacha(await accesosDeUsuario(usuarioActual.id), new Date());
  const cajas = porId('estadisticas');
  cajas.textContent = '';
  cajas.append(
    crearTarjetaDeEstadistica('statNotas', resumen.total, 0, conAnimacion),
    crearTarjetaDeEstadistica('statHechas', resumen.hechas, 1, conAnimacion),
    crearTarjetaDeEstadistica('statRacha', racha, 2, conAnimacion)
  );
}

// Los puntos de la gráfica unidos con una curva suave (cada tramo es una curva de Bézier)
function trazoSuave(puntos) {
  let trazo = 'M' + puntos[0][0].toFixed(1) + ' ' + puntos[0][1].toFixed(1);
  for (let i = 1; i < puntos.length; i++) {
    const medio = (puntos[i - 1][0] + puntos[i][0]) / 2;
    trazo += ' C' + medio.toFixed(1) + ' ' + puntos[i - 1][1].toFixed(1) + ' ' + medio.toFixed(1) + ' ' + puntos[i][1].toFixed(1) + ' ' + puntos[i][0].toFixed(1) + ' ' + puntos[i][1].toFixed(1);
  }
  return trazo;
}

function pintarGrafica(conAnimacion) {
  const dias = actividadDeLaSemana(notasDelUsuario, new Date());
  const maximo = Math.max(1, ...dias.map(function (dia) { return dia.cantidad; }));
  const puntos = dias.map(function (dia, i) {
    // Dejo un margen para que el trazo no toque los bordes
    return [10 + i * (280 / 6), 88 - (dia.cantidad / maximo) * 72];
  });
  const trazo = porId('graficaTrazo');
  trazo.setAttribute('d', trazoSuave(puntos));

  const nombresDeDia = dias.map(function (dia) {
    const partes = dia.fecha.split('-').map(Number);
    return new Intl.DateTimeFormat(idiomaActual(), { weekday: 'short' }).format(new Date(partes[0], partes[1] - 1, partes[2]));
  });
  const etiquetas = porId('graficaDias');
  etiquetas.textContent = '';
  for (const nombre of nombresDeDia) {
    const dia = document.createElement('span');
    dia.textContent = nombre;
    etiquetas.append(dia);
  }
  // El gráfico no se ve con un lector de pantalla, así que le pongo una descripción con los datos
  porId('graficaSvg').setAttribute('aria-label', textoDe('actividadResumen', { datos: dias.map(function (dia, i) { return nombresDeDia[i] + ' ' + dia.cantidad; }).join(', ') }));

  if (conAnimacion && !quiereMenosMovimiento()) {
    // El trazo se dibuja de izquierda a derecha, como si fuera una pluma
    const largo = trazo.getTotalLength();
    trazo.style.strokeDasharray = String(largo);
    trazo.animate([{ strokeDashoffset: largo }, { strokeDashoffset: 0 }], { duration: 900, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'both' });
  } else {
    trazo.style.strokeDasharray = 'none';
  }
}

function pintarRecientes() {
  const lista = porId('listaRecientes');
  lista.textContent = '';
  const recientes = notasDelUsuario.slice(0, 3);
  porId('sinRecientes').hidden = recientes.length > 0;
  for (const nota of recientes) {
    const elemento = document.createElement('li');
    elemento.className = nota.hecha ? 'hecha' : '';
    elemento.textContent = nota.texto;
    lista.append(elemento);
  }
}

// ---------- Notas ----------

function notasFiltradas() {
  if (filtroDeNotas === 'pendientes') return notasDelUsuario.filter(function (nota) { return !nota.hecha; });
  if (filtroDeNotas === 'hechas') return notasDelUsuario.filter(function (nota) { return nota.hecha; });
  return notasDelUsuario;
}

function crearElementoDeNota(nota, orden, esNueva) {
  const elemento = document.createElement('li');
  elemento.className = 'nota' + (nota.hecha ? ' hecha' : '') + (esNueva ? ' nueva' : '');
  elemento.dataset.id = nota.id;
  // Con --orden las notas aparecen una detrás de otra (solo las primeras, para no tardar)
  elemento.style.setProperty('--orden', Math.min(orden, 8));

  const etiqueta = document.createElement('label');
  etiqueta.className = 'nota-etiqueta';
  const casilla = document.createElement('input');
  casilla.type = 'checkbox';
  casilla.checked = nota.hecha;
  const texto = document.createElement('span');
  texto.className = 'nota-texto';
  texto.textContent = nota.texto;
  etiqueta.append(casilla, texto);

  const borrar = document.createElement('button');
  borrar.type = 'button';
  borrar.className = 'nota-borrar';
  borrar.setAttribute('aria-label', textoDe('borrarNota', { texto: nota.texto }));
  borrar.innerHTML = '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  elemento.append(etiqueta, borrar);
  return elemento;
}

function pintarNotas(idDeLaNueva) {
  const visibles = notasFiltradas();
  const lista = porId('listaNotas');
  lista.textContent = '';
  visibles.forEach(function (nota, i) { lista.append(crearElementoDeNota(nota, i, nota.id === idDeLaNueva)); });

  const vacio = porId('vacioNotas');
  vacio.hidden = visibles.length > 0;
  vacio.textContent = textoDe(notasDelUsuario.length === 0 ? 'vacioNotas' : 'vacioFiltro');
  porId('contadorNotas').textContent = textoDe('contadorNotas', { n: notasDelUsuario.length, max: MAXIMO_NOTAS });
}

async function cargarNotas() {
  notasDelUsuario = await listarNotas(usuarioActual.id);
}

// Un mensaje que se ve un rato (o un error que se queda hasta que escribes otra vez)
function decirEnPanel(idMensaje, clave, variables, esOk) {
  const caja = porId(idMensaje);
  caja.dataset.i18n = clave;
  caja.dataset.i18nVars = JSON.stringify(variables || {});
  caja.textContent = textoDe(clave, variables);
  caja.classList.toggle('mensaje-ok', !!esOk);
  clearTimeout(temporizadorDeMensaje);
  if (esOk) temporizadorDeMensaje = setTimeout(function () { limpiarMensajeDePanel(idMensaje); }, 3500);
}

function limpiarMensajeDePanel(idMensaje) {
  const caja = porId(idMensaje);
  delete caja.dataset.i18n;
  delete caja.dataset.i18nVars;
  caja.textContent = '';
  caja.classList.remove('mensaje-ok');
}

async function alEnviarNota(evento) {
  evento.preventDefault();
  limpiarMensajeDePanel('mensajeNota');
  const campo = porId('campoNota');
  const resultado = await crearNota(usuarioActual.id, campo.value);
  if (!resultado.ok) {
    decirEnPanel('mensajeNota', ERRORES_DE_NOTA[resultado.error] || 'errGeneral');
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
    return;
  }
  campo.removeAttribute('aria-invalid');
  campo.value = '';
  notasDelUsuario.unshift(resultado.nota);
  pintarNotas(resultado.nota.id);
  campo.focus();
}

async function alCambiarCasilla(evento) {
  const elemento = evento.target.closest('.nota');
  if (!elemento || evento.target.type !== 'checkbox') return;
  const resultado = await marcarNota(usuarioActual.id, elemento.dataset.id, evento.target.checked);
  if (!resultado.ok) return;
  notasDelUsuario = notasDelUsuario.map(function (nota) { return nota.id === resultado.nota.id ? resultado.nota : nota; });
  elemento.classList.toggle('hecha', resultado.nota.hecha);
  // Si estoy viendo solo las pendientes (o las hechas), la nota ya no pertenece a esta lista: la quito
  if (filtroDeNotas !== 'todas') {
    setTimeout(function () { pintarNotas(); }, quiereMenosMovimiento() ? 0 : 350);
  }
  porId('contadorNotas').textContent = textoDe('contadorNotas', { n: notasDelUsuario.length, max: MAXIMO_NOTAS });
}

async function alPulsarBorrar(evento) {
  const boton = evento.target.closest('.nota-borrar');
  if (!boton) return;
  const elemento = boton.closest('.nota');
  const id = elemento.dataset.id;
  // Antes de borrar la nota se desliza hacia fuera
  if (!quiereMenosMovimiento()) {
    elemento.classList.add('sale');
    await new Promise(function (resolver) { setTimeout(resolver, 200); });
  }
  const resultado = await borrarNota(usuarioActual.id, id);
  if (!resultado.ok) {
    elemento.classList.remove('sale');
    return;
  }
  notasDelUsuario = notasDelUsuario.filter(function (nota) { return nota.id !== id; });
  pintarNotas();
  porId('campoNota').focus();
}

// ---------- Perfil ----------

function pintarColores(colorActual) {
  const lista = porId('listaColores');
  lista.textContent = '';
  COLORES_DE_AVATAR.forEach(function (color, i) {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'color';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'colorAvatar';
    radio.value = color;
    radio.checked = color === colorActual;
    const muestra = document.createElement('span');
    muestra.className = 'color-muestra';
    muestra.style.background = color;
    const nombre = document.createElement('span');
    nombre.className = 'solo-lectores';
    nombre.dataset.i18n = 'color' + i;
    nombre.textContent = textoDe('color' + i);
    etiqueta.append(radio, muestra, nombre);
    lista.append(etiqueta);
  });
}

async function alGuardarPerfil(evento) {
  evento.preventDefault();
  limpiarMensajeDePanel('mensajePerfil');
  const color = document.querySelector('input[name="colorAvatar"]:checked');
  const resultado = await actualizarPerfil(usuarioActual.id, { nombre: porId('perfilNombre').value, color: color ? color.value : '' });
  if (!resultado.ok) {
    decirEnPanel('mensajePerfil', resultado.error === 'NOMBRE_INVALIDO' ? 'errNombre' : 'errGeneral');
    porId('perfilNombre').focus();
    return;
  }
  usuarioActual = resultado.usuario;
  ponerDatosDeUsuario(usuarioActual);
  decirEnPanel('mensajePerfil', 'guardado', null, true);
}

async function alCambiarClave(evento) {
  evento.preventDefault();
  limpiarMensajeDePanel('mensajeClave');
  const actual = porId('claveActual');
  const nueva = porId('claveNueva');
  const problema = validarClave(nueva.value);
  if (actual.value === '') {
    decirEnPanel('mensajeClave', 'errClaveFalta');
    actual.focus();
    return;
  }
  if (problema) {
    decirEnPanel('mensajeClave', TEXTO_DE_ERROR[problema]);
    nueva.focus();
    return;
  }
  const resultado = await cambiarClave(usuarioActual.id, actual.value, nueva.value);
  if (!resultado.ok) {
    decirEnPanel('mensajeClave', claveDeErrorEnPanel(resultado.error), resultado.segundos ? { s: resultado.segundos } : null);
    actual.focus();
    return;
  }
  actual.value = '';
  nueva.value = '';
  decirEnPanel('mensajeClave', 'claveCambiada', null, true);
}

async function alEliminarCuenta(evento) {
  evento.preventDefault();
  limpiarMensajeDePanel('mensajeEliminar');
  const campo = porId('claveEliminar');
  if (campo.value === '') {
    decirEnPanel('mensajeEliminar', 'errClaveFalta');
    campo.focus();
    return;
  }
  const resultado = await eliminarCuenta(usuarioActual.id, campo.value);
  if (!resultado.ok) {
    decirEnPanel('mensajeEliminar', claveDeErrorEnPanel(resultado.error));
    campo.focus();
    return;
  }
  campo.value = '';
  terminarSesionLocal();
  porId('avisoEliminada').hidden = false;
}

// ---------- Abrir y repintar el panel ----------

async function abrirPanel(usuario) {
  usuarioActual = usuario;
  ponerDatosDeUsuario(usuario);
  for (const id of ['mensajeNota', 'mensajePerfil', 'mensajeClave', 'mensajeEliminar']) limpiarMensajeDePanel(id);
  for (const formulario of ['formClave', 'formEliminar']) porId(formulario).reset();
  filtroDeNotas = 'todas';
  document.querySelector('input[name="filtroNotas"][value="todas"]').checked = true;
  await cargarNotas();
  pintarNotas();
  seccionDelPanel = '';
  irASeccion('resumen', false);
}

// Al cambiar de idioma repinto lo que lleva palabras generadas por mí (sin repetir las animaciones)
async function repintarPorIdioma() {
  if (!panelVisible() || !usuarioActual) return;
  ponerDatosDeUsuario(usuarioActual);
  pintarNotas();
  await pintarEstadisticas(false);
  pintarGrafica(false);
}

function iniciarPanel() {
  for (const boton of document.querySelectorAll('.nav-boton[data-seccion]')) {
    boton.addEventListener('click', function () { irASeccion(boton.dataset.seccion, false); });
  }
  porId('formNota').addEventListener('submit', alEnviarNota);
  porId('campoNota').addEventListener('input', function () {
    limpiarMensajeDePanel('mensajeNota');
    porId('campoNota').removeAttribute('aria-invalid');
  });
  porId('listaNotas').addEventListener('change', alCambiarCasilla);
  porId('listaNotas').addEventListener('click', alPulsarBorrar);
  for (const radio of document.querySelectorAll('input[name="filtroNotas"]')) {
    radio.addEventListener('change', function () {
      filtroDeNotas = radio.value;
      pintarNotas();
    });
  }
  porId('formPerfil').addEventListener('submit', alGuardarPerfil);
  porId('formClave').addEventListener('submit', alCambiarClave);
  porId('formEliminar').addEventListener('submit', alEliminarCuenta);
  document.addEventListener('idiomacambiado', repintarPorIdioma);
}
