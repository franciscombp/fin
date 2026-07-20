// PWA - Register Service Worker for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.log('Service Worker registration failed:', err);
  });
}

// Login / Home navigation.
// NOTA: todas las interacciones del home (giroscopio, saldo, tabs, vistas,
// bottom sheet, detalle de tarjeta y stories) las maneja el <script> inline
// de index.html. Aquí sólo controlamos el flujo de autenticación para evitar
// duplicar listeners sobre los mismos elementos.
document.addEventListener('DOMContentLoaded', () => {
  const loginScreen = document.getElementById('login-screen');
  const homePage = document.getElementById('home-page');
  const welcomeSplash = document.getElementById('welcome-splash');
  const btnLoginBiometric = document.getElementById('btn-login-biometric');
  const btnLoginOther = document.getElementById('btn-login-other');
  const btnLogout = document.getElementById('btn-logout');
  const loadingSpinner = document.getElementById('loading-spinner');

  function showHome() {
    // Vuelve siempre a la página Destacado/Inicio
    if (typeof window.__resetHomeView === 'function') window.__resetHomeView();
    loginScreen.classList.remove('active');
    homePage.classList.remove('hidden');
    if (welcomeSplash) welcomeSplash.classList.remove('show');
  }

  function showLogin() {
    loginScreen.classList.add('active');
    homePage.classList.add('hidden');
    if (welcomeSplash) welcomeSplash.classList.remove('show');
    window.scrollTo({ top: 0 });
  }

  // Home oculto hasta autenticarse
  if (homePage) homePage.classList.add('hidden');

  // Login biométrico real (WebAuthn) con fallback simulado
  if (btnLoginBiometric) {
    btnLoginBiometric.addEventListener('click', async () => {
      const original = btnLoginBiometric.textContent;
      btnLoginBiometric.disabled = true;
      // Pantalla amarilla de bienvenida mientras autentica
      if (welcomeSplash) welcomeSplash.classList.add('show');
      if (loadingSpinner) loadingSpinner.style.display = 'inline-block';

      try {
        const auth = window.BPAuth;
        if (auth && auth.supported && await auth.platformAvailable()) {
          // Biometría real del dispositivo (Touch ID / Face ID / Windows Hello / huella)
          btnLoginBiometric.textContent = auth.hasCredential()
            ? 'Verificando huella…'
            : 'Registrando huella…';
          await auth.verify();
        } else {
          // Sin autenticador de plataforma: caemos al simulado
          btnLoginBiometric.textContent = 'Autenticando...';
          await new Promise(r => setTimeout(r, 1600));
        }
        showHome();
      } catch (err) {
        // El usuario canceló o el autenticador falló
        console.warn('Biometría cancelada/fallida:', err);
        if (welcomeSplash) welcomeSplash.classList.remove('show');
        alert('No se pudo verificar tu identidad. Inténtalo de nuevo.');
      } finally {
        btnLoginBiometric.disabled = false;
        btnLoginBiometric.textContent = original || 'Ingresar';
        if (loadingSpinner) loadingSpinner.style.display = 'none';
      }
    });
  }

  // Otro método de ingreso
  if (btnLoginOther) {
    btnLoginOther.addEventListener('click', () => {
      alert('Otros métodos: Usuario y contraseña (próximamente)');
    });
  }

  // Cerrar sesión
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('¿Deseas cerrar sesión?')) showLogin();
    });
  }
});
