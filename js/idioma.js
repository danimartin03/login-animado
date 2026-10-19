// El cambio de idioma (español e inglés).
// Cada texto de la página lleva data-i18n="clave" y aquí lo relleno desde textos.js.
// Al cambiar de idioma los textos se "escriben" letra a letra, como si la tinta los fuera trazando.

const CLAVE_IDIOMA = 'login-animado:idioma';
const IDIOMAS = ['es', 'en'];
const LETRAS_DE_PRUEBA = 'abcdefghijklmnopqrstuvwxyz';

function idiomaActual() {
  return document.documentElement.lang;
}

// El texto de una clave en el idioma actual. Las {variables} se cambian por su valor.
function textoDe(clave, variables, idioma) {
  const diccionario = TEXTOS[idioma || idiomaActual()] || TEXTOS.es;
  let texto = diccionario[clave];
  // Si falta la clave en este idioma uso el español, y si tampoco está, la propia clave
  if (texto === undefined) texto = TEXTOS.es[clave] !== undefined ? TEXTOS.es[clave] : clave;
  if (variables) {
    for (const nombre of Object.keys(variables)) {
      texto = texto.split('{' + nombre + '}').join(variables[nombre]);
    }
  }
  return texto;
}

function menosMovimientoIdioma() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Escribo el texto nuevo letra a letra: lo que ya está "escrito" se ve bien y el resto son letras al azar
function escribirConEfecto(elemento, texto) {
  clearInterval(elemento._efecto);
  const anterior = elemento.textContent;
  if (anterior === texto) return;
  if (menosMovimientoIdioma() || anterior === '') {
    elemento.textContent = texto;
    return;
  }

  // Los textos largos avanzan más letras por paso, para que todo dure parecido (unos 400 ms)
  const porPaso = Math.max(1, Math.ceil(texto.length / 16));
  let escritas = 0;
  elemento._efecto = setInterval(function () {
    escritas += porPaso;
    if (escritas >= texto.length) {
      elemento.textContent = texto;
      clearInterval(elemento._efecto);
      return;
    }
    let resultado = texto.slice(0, escritas);
    // Detrás de lo escrito pongo letras al azar (los espacios se quedan como están)
    for (let i = escritas; i < texto.length; i++) {
      resultado += texto[i] === ' ' ? ' ' : LETRAS_DE_PRUEBA[Math.floor(Math.random() * LETRAS_DE_PRUEBA.length)];
    }
    elemento.textContent = resultado;
  }, 25);
}

// data-i18n-attr="aria-label:clave;placeholder:otra" cambia atributos en vez del texto
function aplicarAtributos(raiz) {
  for (const elemento of raiz.querySelectorAll('[data-i18n-attr]')) {
    for (const par of elemento.dataset.i18nAttr.split(';')) {
      const partes = par.split(':');
      if (partes.length === 2) elemento.setAttribute(partes[0].trim(), textoDe(partes[1].trim()));
    }
  }
}

function aplicarTextos(raiz, conEfecto) {
  for (const elemento of raiz.querySelectorAll('[data-i18n]')) {
    const texto = textoDe(elemento.dataset.i18n);
    if (conEfecto) escribirConEfecto(elemento, texto);
    else elemento.textContent = texto;
  }
  aplicarAtributos(raiz);
}

// Lo de la cabecera del documento (título y descripción) cambia sin efecto
function aplicarCabecera() {
  document.title = textoDe('tituloPagina');
  const descripcion = document.querySelector('meta[name="description"]');
  if (descripcion) descripcion.setAttribute('content', textoDe('descripcion'));
}

function marcarBotonesDeIdioma() {
  for (const boton of document.querySelectorAll('.idioma')) {
    boton.setAttribute('aria-pressed', String(boton.dataset.idioma === idiomaActual()));
  }
}

function cambiarIdioma(nuevo) {
  if (!IDIOMAS.includes(nuevo) || nuevo === idiomaActual()) return;
  document.documentElement.lang = nuevo;
  try {
    localStorage.setItem(CLAVE_IDIOMA, nuevo);
  } catch (error) {
    // Cambia igual, pero no se recuerda
  }
  marcarBotonesDeIdioma();
  aplicarCabecera();
  aplicarTextos(document, true);
  // Aviso a las demás partes (el botón del tema, el panel...) para que se actualicen
  document.dispatchEvent(new CustomEvent('idiomacambiado'));
}

function iniciarIdioma() {
  marcarBotonesDeIdioma();
  aplicarCabecera();
  aplicarTextos(document, false);
  for (const boton of document.querySelectorAll('.idioma')) {
    boton.addEventListener('click', function () { cambiarIdioma(boton.dataset.idioma); });
  }
}
