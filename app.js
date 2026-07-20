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
  const btnLoginBiometric = document.getElementById('btn-login-biometric');
  const btnLoginOther = document.getElementById('btn-login-other');
  const btnLogout = document.getElementById('btn-logout');
  const loadingSpinner = document.getElementById('loading-spinner');

  function showHome() {
    loginScreen.classList.remove('active');
    homePage.classList.remove('hidden');
  }

  function showLogin() {
    loginScreen.classList.add('active');
    homePage.classList.add('hidden');
    window.scrollTo({ top: 0 });
  }

  // Home oculto hasta autenticarse
  if (homePage) homePage.classList.add('hidden');

  // Login biométrico (simulado)
  if (btnLoginBiometric) {
    btnLoginBiometric.addEventListener('click', () => {
      btnLoginBiometric.disabled = true;
      btnLoginBiometric.textContent = 'Autenticando...';
      if (loadingSpinner) loadingSpinner.style.display = 'inline-block';
      setTimeout(() => {
        showHome();
        btnLoginBiometric.disabled = false;
        btnLoginBiometric.textContent = 'Ingresar';
        if (loadingSpinner) loadingSpinner.style.display = 'none';
      }, 2000);
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
