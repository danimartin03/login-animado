// El arranque de la página. Cada parte (tema, idioma, acceso, panel) tiene su archivo.

function porId(id) {
  return document.getElementById(id);
}

function arrancar() {
  iniciarIdioma();
  iniciarTema();
}

arrancar();
