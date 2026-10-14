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

`solar.css` y `tokens.css` no se limpian: son la librería del design system
compartido de Figma y traen componentes que la app todavía no usa.
