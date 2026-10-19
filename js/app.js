// El arranque de la página. Cada parte (tema, idioma, acceso, panel) tiene su archivo.

// Los textos por ahora los pongo aquí; en la fase del idioma pasarán a un diccionario
const TEXTOS_PROVISIONALES = {
  temaAClaro: 'Cambiar a tema claro',
  temaAOscuro: 'Cambiar a tema oscuro'
};

function textoDe(clave) {
  return TEXTOS_PROVISIONALES[clave] || clave;
}

function porId(id) {
  return document.getElementById(id);
}

function arrancar() {
  iniciarTema();
}

arrancar();
