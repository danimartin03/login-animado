// El tema claro/oscuro y la mancha de tinta que lo cambia.
// La mancha usa la API de transiciones de vista: el navegador guarda una "foto" de la página
// con el tema viejo y otra con el tema nuevo, y yo voy descubriendo la nueva con una forma
// que crece desde el botón y se deforma como si fuera tinta.

const CLAVE_TEMA = 'login-animado:tema';
const DURACION_MANCHA = 1000;
// Cuántos puntos tiene la mancha: más puntos, borde más suave
const PUNTOS_MANCHA = 110;

function temaActual() {
  return document.documentElement.dataset.tema;
}

function ponerTema(tema) {
  document.documentElement.dataset.tema = tema;
  const boton = document.getElementById('botonTema');
  if (boton) boton.setAttribute('aria-label', tema === 'oscuro' ? textoDe('temaAClaro') : textoDe('temaAOscuro'));
  const color = document.querySelector('meta[name="theme-color"]');
  if (color) color.setAttribute('content', tema === 'oscuro' ? '#0b0c10' : '#f4f5f8');
}

function guardarTema(tema) {
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch (error) {
    // Sin localStorage el tema cambia igual, pero no se recuerda
  }
}

// Empieza despacio, acelera y termina frenando (como una gota que se extiende)
function suavizar(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// La forma de la mancha en un momento: un círculo cuyo radio sube y baja según el ángulo.
// Sumo varias ondas de distinto tamaño para que el borde sea irregular y "viva" mientras crece.
function formaDeMancha(x, y, radio, tiempo) {
  const puntos = [];
  for (let i = 0; i < PUNTOS_MANCHA; i++) {
    const angulo = (i / PUNTOS_MANCHA) * Math.PI * 2;
    const ruido =
      1 +
      0.1 * Math.sin(angulo * 3 + tiempo * 0.004) +
      0.07 * Math.sin(angulo * 5 - tiempo * 0.006 + 1.3) +
      0.04 * Math.sin(angulo * 9 + tiempo * 0.009 + 2.1);
    const r = radio * ruido;
    puntos.push((x + Math.cos(angulo) * r).toFixed(1) + 'px ' + (y + Math.sin(angulo) * r).toFixed(1) + 'px');
  }
  return 'polygon(' + puntos.join(',') + ')';
}

function menosMovimiento() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Dónde sale la mancha: del centro del botón que se ha pulsado
function origenDeLaMancha(boton) {
  const caja = boton.getBoundingClientRect();
  return { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 };
}

// La mancha tiene que cubrir hasta la esquina más lejana. El borde se mete hasta un 21 % hacia dentro
// en los puntos más "hundidos", así que pido un 30 % de más para que no deje un hueco en la esquina.
function radioFinal(x, y) {
  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  const lejos = Math.hypot(Math.max(x, ancho - x), Math.max(y, alto - y));
  return lejos * 1.3;
}

async function cambiarTema(boton) {
  const nuevo = temaActual() === 'oscuro' ? 'claro' : 'oscuro';
  guardarTema(nuevo);

  const raiz = document.documentElement;

  // Sin la API (o si prefiero menos movimiento) cambio los colores con un fundido corto
  if (!document.startViewTransition || menosMovimiento()) {
    raiz.classList.add('fundiendo');
    ponerTema(nuevo);
    setTimeout(function () { raiz.classList.remove('fundiendo'); }, 350);
    return;
  }

  const origen = origenDeLaMancha(boton);
  const radioMaximo = radioFinal(origen.x, origen.y);
  // La mancha empieza siendo un puntito (si no, la página nueva se vería entera un instante)
  raiz.style.setProperty('--tinta-clip', formaDeMancha(origen.x, origen.y, 1, 0));

  const transicion = document.startViewTransition(function () { ponerTema(nuevo); });
  try {
    await transicion.ready;
  } catch (error) {
    raiz.style.removeProperty('--tinta-clip');
    return;
  }

  const inicio = performance.now();
  function fotograma(ahora) {
    const progreso = Math.min(1, (ahora - inicio) / DURACION_MANCHA);
    raiz.style.setProperty('--tinta-clip', formaDeMancha(origen.x, origen.y, radioMaximo * suavizar(progreso), ahora));
    if (progreso < 1) requestAnimationFrame(fotograma);
  }
  requestAnimationFrame(fotograma);

  await transicion.finished;
  raiz.style.removeProperty('--tinta-clip');
}

function iniciarTema() {
  ponerTema(temaActual());
  const boton = document.getElementById('botonTema');
  let ocupado = false;
  boton.addEventListener('click', async function () {
    // Si pulso otra vez mientras se extiende, espero a que termine
    if (ocupado) return;
    ocupado = true;
    await cambiarTema(boton);
    ocupado = false;
  });
}
