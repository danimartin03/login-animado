// La paleta de acciones (Ctrl+K): una ventanita para escribir lo que quieres hacer y saltar a ello.
// Es para usar con el teclado, y se usa muchas veces, así que NO tiene animación: aparece y desaparece al momento.

let accionActiva = 0;
let accionesMostradas = [];

function accionesDeLaPaleta() {
  return [
    { clave: 'accResumen', ejecutar: function () { irASeccion('resumen', true); } },
    { clave: 'accNotas', ejecutar: function () { irASeccion('notas', true); } },
    { clave: 'accPerfil', ejecutar: function () { irASeccion('perfil', true); } },
    { clave: 'accNuevaNota', ejecutar: function () { irASeccion('notas', false); porId('campoNota').focus(); } },
    { clave: 'accTema', ejecutar: function () { porId('botonTema').click(); } },
    { clave: 'accIdioma', ejecutar: function () { cambiarIdioma(idiomaActual() === 'es' ? 'en' : 'es'); } },
    { clave: 'accSalir', ejecutar: function () { salir(); } }
  ];
}

// Para comparar sin tildes ni mayúsculas: "Perfil" y "perfil" y "pérfil" se parecen
function simplificar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function pintarPaleta() {
  const buscado = simplificar(porId('paletaCampo').value.trim());
  accionesMostradas = accionesDeLaPaleta().filter(function (accion) {
    return buscado === '' || simplificar(textoDe(accion.clave)).includes(buscado);
  });
  accionActiva = Math.min(accionActiva, Math.max(0, accionesMostradas.length - 1));

  const lista = porId('paletaLista');
  lista.textContent = '';
  accionesMostradas.forEach(function (accion, i) {
    const elemento = document.createElement('li');
    elemento.id = 'accion-' + i;
    elemento.setAttribute('role', 'option');
    elemento.setAttribute('aria-selected', String(i === accionActiva));
    elemento.className = 'paleta-accion';
    elemento.textContent = textoDe(accion.clave);
    elemento.addEventListener('click', function () { ejecutarAccion(i); });
    lista.append(elemento);
  });
  porId('paletaVacia').hidden = accionesMostradas.length > 0;
  const campo = porId('paletaCampo');
  if (accionesMostradas.length > 0) campo.setAttribute('aria-activedescendant', 'accion-' + accionActiva);
  else campo.removeAttribute('aria-activedescendant');
}

function moverAccion(salto) {
  if (accionesMostradas.length === 0) return;
  accionActiva = (accionActiva + salto + accionesMostradas.length) % accionesMostradas.length;
  pintarPaleta();
  const activa = porId('accion-' + accionActiva);
  if (activa) activa.scrollIntoView({ block: 'nearest' });
}

function ejecutarAccion(indice) {
  const accion = accionesMostradas[indice];
  if (!accion) return;
  porId('paleta').close();
  accion.ejecutar();
}

function abrirPaleta() {
  const dialogo = porId('paleta');
  if (!panelVisible() || dialogo.open) return;
  porId('paletaCampo').value = '';
  accionActiva = 0;
  pintarPaleta();
  dialogo.showModal();
  porId('paletaCampo').focus();
}

function iniciarPaleta() {
  const dialogo = porId('paleta');
  const campo = porId('paletaCampo');
  porId('botonPaleta').addEventListener('click', abrirPaleta);
  campo.addEventListener('input', function () { accionActiva = 0; pintarPaleta(); });
  campo.addEventListener('keydown', function (evento) {
    if (evento.key === 'ArrowDown') { evento.preventDefault(); moverAccion(1); }
    else if (evento.key === 'ArrowUp') { evento.preventDefault(); moverAccion(-1); }
    else if (evento.key === 'Enter') { evento.preventDefault(); ejecutarAccion(accionActiva); }
  });
  // Si pulso en el fondo oscuro, se cierra
  dialogo.addEventListener('click', function (evento) { if (evento.target === dialogo) dialogo.close(); });
  document.addEventListener('keydown', function (evento) {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k' && panelVisible()) {
      evento.preventDefault();
      if (dialogo.open) dialogo.close();
      else abrirPaleta();
    }
  });
  document.addEventListener('idiomacambiado', function () { if (dialogo.open) pintarPaleta(); });
}
