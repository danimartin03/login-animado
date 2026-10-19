// El fondo: gotas de tinta que se mueven por la pantalla siguiendo al puntero, con un poco de retraso.
// Cada gota va "persiguiendo" su objetivo: en cada fotograma recorre una parte de la distancia que le falta,
// y así parece que tiene inercia (como un muelle suave).

const NUMERO_DE_GOTAS = 5;

function iniciarFondo() {
  const contenedor = document.getElementById('fondo');
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gotas = [];

  for (let i = 0; i < NUMERO_DE_GOTAS; i++) {
    const elemento = document.createElement('div');
    elemento.className = 'gota';
    const tamano = 160 + Math.random() * 200;
    elemento.style.width = tamano + 'px';
    elemento.style.height = tamano + 'px';
    contenedor.append(elemento);
    gotas.push({
      elemento: elemento,
      tamano: tamano,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      // Cuanto más pequeño es "agilidad", más tarda en llegar: así cada gota va a su ritmo
      agilidad: 0.012 + i * 0.008
    });
  }

  // Hacia dónde se dirigen: por defecto, a la derecha del centro (donde está la tarjeta)
  let objetivoX = window.innerWidth * 0.65;
  let objetivoY = window.innerHeight * 0.45;
  document.addEventListener('pointermove', function (evento) {
    objetivoX = evento.clientX;
    objetivoY = evento.clientY;
  });

  function colocar(gota) {
    gota.elemento.style.transform = 'translate(' + (gota.x - gota.tamano / 2).toFixed(1) + 'px, ' + (gota.y - gota.tamano / 2).toFixed(1) + 'px)';
  }

  let animando = false;
  function fotograma(tiempo) {
    if (document.hidden || sinMovimiento.matches) {
      animando = false;
      return;
    }
    gotas.forEach(function (gota, i) {
      // Cada gota orbita un poco alrededor del objetivo, para que no se amontonen todas en el mismo punto
      const destinoX = objetivoX + Math.sin(tiempo / 1500 + i * 2) * 140 + (i - 2) * 50;
      const destinoY = objetivoY + Math.cos(tiempo / 1900 + i) * 110;
      gota.x += (destinoX - gota.x) * gota.agilidad;
      gota.y += (destinoY - gota.y) * gota.agilidad;
      colocar(gota);
    });
    requestAnimationFrame(fotograma);
  }

  function arrancar() {
    if (animando) return;
    if (sinMovimiento.matches) {
      // Sin movimiento: las gotas se quedan quietas donde empezaron
      gotas.forEach(colocar);
      return;
    }
    animando = true;
    requestAnimationFrame(fotograma);
  }

  // Si la pestaña no se ve, paro el bucle para no gastar batería
  document.addEventListener('visibilitychange', arrancar);
  sinMovimiento.addEventListener('change', arrancar);
  arrancar();
}
