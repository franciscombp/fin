# Respaldo

Código que la app ya no usa. Se guarda aquí (y no en `assets/`) para que no
compita con los estilos vigentes. **No se publica en Pages**: el workflow solo
copia la raíz y `assets/`.

| Carpeta | Qué hay |
| --- | --- |
| `asistente-candado-pia/` | Asistente 2D (Candado y PIA) antes del oso 3D. |
| `banners-fuente/` | Fuente de las ilustraciones de los banners. |
| `oso-fuente/` | Script del rig del oso. |
| `estilos-sin-uso/` | Reglas CSS cuyas clases ya no aparecen en ningún HTML ni JS, una por archivo de origen (`index.html.css` es el `<style>` de `index.html`). |
| `mis-finanzas-pagina/` | Mis finanzas como página completa (antes de ser sección de la barra inferior) y sus funciones. |
| `transiciones-anteriores/` | Morph de la tarjeta, apertura "creciendo" desde el botón y el primer bloque de transiciones: reemplazados por la navegación unificada (`assets/navegacion.js`). |
| `vistas/` | Vistas sin acceso desde la app (Tienda). |
| `codigo-sin-uso/` | Funciones JS que ya nadie llama, una por archivo de origen (p. ej. las secciones viejas del hub de Mis finanzas y la tarjeta de Solicitudes). |
| `sin-uso/` | Archivos que la app dejó de pedir (`sonda.txt`: la conexión ahora la dice el navegador). |
| (versión anterior de la app) | No es una carpeta: la versión anterior, con Mis finanzas, el buscador y la ayuda por separado, sigue publicada en `clasica.html` (`index.html?app=clasica`). La principal es la versión asistente con Uku (`assets/uku-app.js`). |

`tokens.css` y los nombres canónicos `bp-*` (y las utilidades `t-*`) de `componentes.css` no se
limpian: son el vocabulario del design system de Figma, aunque la app todavía no use algunos.
`solar.css` ya no existe: sus componentes pasaron a `componentes.css`.

Cómo se encuentran: `estilos-sin-uso` reúne los selectores cuyas clases no aparecen en ningún HTML ni
JS de la app (descontando las que el código arma con prefijos, como `'is-' + estado`), y
`codigo-sin-uso` las funciones declaradas que nadie llama. Antes de sacarlas se compara la app
pantalla por pantalla contra `main`.
