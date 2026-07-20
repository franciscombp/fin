# Banca Móvil POC - Banco Pichincha

POC (Proof of Concept) del rediseño de banca móvil de Banco Pichincha. Implementa micro interacciones, PWA, login biométrico y es completamente responsive.

## Características

✅ **PWA (Progressive Web App)**
- Instalable en dispositivos móviles y desktop
- Funciona offline con caching inteligente
- Splash screen personalizado con logo BP
- App shortcuts para acciones rápidas

✅ **Login Biométrico**
- Soporte para WebAuthn (huella dactilar y reconocimiento facial)
- Simulación de autenticación biométrica
- Fallback a métodos alternativos
- Almacenamiento seguro de credenciales

✅ **Micro Interacciones**
- Animaciones de botones y transiciones fluidas
- Toasts de feedback visual
- Efectos ripple en acciones
- Transiciones suaves entre vistas

✅ **Responsive**
- Diseño mobile-first
- Simulación de iPhone (390x844px)
- Compatible con todos los tamaños de pantalla
- Scroll fluido y optimizado

✅ **Personalizable con CSS Variables**
- Sistema de colores completamente personalizable
- Fácil de modificar espaciados y radiuses
- Variables semánticas para tipografía

## Estructura del Proyecto

```
/
├── index.html          # HTML principal con toda la estructura
├── app.js             # Lógica de PWA, biometric auth y micro interacciones
├── sw.js              # Service Worker para caché offline
├── manifest.json      # Manifest de PWA con iconos y metadatos
└── README.md          # Este archivo
```

## CSS Variables - Personalización

Todas las variables están definidas en el `:root` del `index.html`. Para personalizar colores y estilos:

```css
:root {
  --bp-surface-page: #f1f3f7;           /* Fondo de página */
  --bp-surface-container: #ffffff;      /* Fondo de cards */
  --bp-surface-brand: #ffdd00;          /* Color amarillo Banco Pichincha */
  --bp-brand-support: #0f265c;          /* Azul oscuro principal */
  --bp-text-primary: #252529;           /* Texto principal */
  --bp-text-secondary: #5e626f;         /* Texto secundario */
  --bp-text-helper: #7e8394;            /* Texto de ayuda */
  --bp-radius-md: 12px;                 /* Border radius medio */
  --bp-radius-sm: 8px;                  /* Border radius pequeño */
  
  /* Y muchas más... */
}
```

### Para cambiar el esquema de colores:

1. Abre `index.html` en un editor
2. Busca la sección `:root { ... }` en el `<style>`
3. Modifica los valores hexadecimales
4. Guarda y recarga la página

**Ejemplo de tema oscuro:**
```css
--bp-surface-page: #1a1a1e;
--bp-surface-container: #2a2a2e;
--bp-text-primary: #ffffff;
--bp-text-secondary: #b0b0b5;
```

## Uso Local

### 1. Desarrollo

```bash
# Servidor simple en Python 3
python3 -m http.server 8000

# O con Node.js
npx http-server

# O con Live Server en VSCode
# (extensión Live Server)
```

Accede a `http://localhost:8000` en tu navegador.

### 2. Instalar como PWA

**En dispositivos móviles:**
1. Abre la app en Chrome/Safari
2. Busca "Instalar app" o "Agregar a pantalla de inicio"
3. Elige un nombre y acepta

**En desktop:**
1. Abre en Chrome
2. Haz clic en el icono de instalación en la barra de direcciones
3. "Instalar"

### 3. Usar Login Biométrico

- En la pantalla de login, haz clic en "Ingresar"
- Selecciona "Huella dactilar" o "Reconocimiento facial"
- Se simula la autenticación en 2-3 segundos
- ¡Listo! Verás la pantalla de inicio

## Estructura de Pantallas

### 1. **Loading Screen** (2 segundos)
Muestra el logo de Banco Pichincha mientras carga

### 2. **Login Screen**
- Top bar con logo y acciones
- Sección de promoción (¡Vive la alegría del Mundial!)
- Acciones rápidas (QR, transferencias, etc.)
- Botones "Ingresar" y "Otro método"

### 3. **Biometric Modal**
- Selector de método (huella o facial)
- Indicador de carga durante autenticación
- Feedback visual de éxito/error

### 4. **Home Screen** (Después de login)
- Saldo disponible con toggle de visibilidad
- Acciones rápidas
- Transacciones recientes
- Información de cuenta flexible

## Datos de Prueba

### Credenciales por defecto:
- No se requieren credenciales - usa cualquier biométrico
- Se simula la autenticación exitosa

### Saldo:
- $5,245.50 (editable en `index.html`)

### Transacciones de ejemplo:
- Restaurante Los Andes - $45.00
- Uber - $12.50

Puedes editar estos valores directamente en el HTML.

## Micro Interacciones Implementadas

1. **Splash Screen**
   - Animación de entrada del logo
   - Transición suave a login

2. **Efectos de Botones**
   - Ripple animation al hacer click
   - Escala y opacidad en hover/active
   - Transitions suaves

3. **Toast Notifications**
   - Feedback visual de acciones
   - Auto-cierre en 2.5 segundos
   - Posicionado en la parte inferior

4. **Toggle de Saldo**
   - Oculta/muestra el saldo disponible
   - Animación suave
   - Útil para privacidad

5. **Transiciones de Pantalla**
   - Loading → Login → Home
   - Fade in/out suave
   - Sin saltos abruptos

## Offline & Caching

El Service Worker implementa estrategia "Cache First":
1. Intenta servir desde cache
2. Si no existe, fetch desde network
3. Actualiza el cache
4. Si no hay conexión, sirve página de cache

**Archivos en cache:**
- `index.html`
- `manifest.json`
- `app.js`
- `sw.js`

## Detalles Técnicos

### WebAuthn (Biometric)
- Fallback simulado para demo
- En producción: usar credenciales reales WebAuthn
- Requiere HTTPS en producción
- Compatible con: Touch ID, Face ID, Windows Hello, Android

### PWA Manifest
- Versión 1.0
- Orientación: Portrait
- Display: Standalone (como app nativa)
- Theme color: #fcd000

### Service Worker
- Estrategia: Cache First + Network Fallback
- Actualización automática
- Limpieza de caches antiguos

## Notas Importantes

⚠️ **Para GitHub Pages:**
- La app funciona perfectamente en GH Pages
- PWA requiere HTTPS (GH Pages lo proporciona)
- Service Worker funcionará automáticamente

⚠️ **En Desarrollo:**
- Si cambias `sw.js`, limpia el cache del navegador
- Devtools: Application > Service Workers > Unregister
- Luego recarga la página

## Próximos Pasos para Producción

- [ ] Implementar backend real para autenticación
- [ ] Conectar a APIs reales de transacciones
- [ ] Agregar análisis de uso (GA)
- [ ] Implementar biometric real con backend
- [ ] Tests automatizados
- [ ] Optimización de imágenes
- [ ] Compresión de assets

## Compatibilidad

✅ Chrome/Edge 79+
✅ Firefox 55+
✅ Safari 11+ (con limitaciones PWA en iOS)
✅ Samsung Internet 8+
✅ Opera 66+

## Licencia

POC para Banco Pichincha - 2024

## Autor

Creado por Claude Code para POC Banca Móvil Rediseño
