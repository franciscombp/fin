// PWA - Register Service Worker for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.log('Service Worker registration failed:', err);
  });
}

// Login/Home navigation
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
  }

  // Biometric login (simulated)
  if (btnLoginBiometric) {
    btnLoginBiometric.addEventListener('click', () => {
      btnLoginBiometric.disabled = true;
      btnLoginBiometric.textContent = 'Autenticando...';
      if (loadingSpinner) {
        loadingSpinner.style.display = 'block';
      }
      setTimeout(() => {
        showHome();
        btnLoginBiometric.disabled = false;
        btnLoginBiometric.textContent = 'Ingresar con Huella';
        if (loadingSpinner) {
          loadingSpinner.style.display = 'none';
        }
      }, 1500);
    });
  }

  // Other login method
  if (btnLoginOther) {
    btnLoginOther.addEventListener('click', () => {
      alert('Otros métodos: Usuario y contraseña (próximamente)');
    });
  }

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      showLogin();
    });
  }
});
