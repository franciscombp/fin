// PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Simple login biometric simulation
function showBiometricLogin() {
  const modal = document.getElementById('biometric-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeBiometricLogin() {
  const modal = document.getElementById('biometric-modal');
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
  document.getElementById('auth-status').innerHTML = '';
}

async function startBiometricAuth() {
  const loading = document.getElementById('loading-indicator');
  const status = document.getElementById('auth-status');
  const icon = document.getElementById('biometric-icon');

  loading.style.display = 'block';

  // Simulate biometric auth
  await new Promise(r => setTimeout(r, 2000));

  loading.style.display = 'none';
  icon.textContent = '✓';
  icon.style.color = '#1e9e5a';
  status.innerHTML = '<p style="color: #1e9e5a; text-align: center;">¡Autenticación exitosa!</p>';

  setTimeout(() => {
    closeBiometricLogin();
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('home-screen').style.display = 'flex';
  }, 1000);
}

function logout() {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  closeBiometricLogin();
}

// Init
window.addEventListener('DOMContentLoaded', () => {
  // Loading screen
  setTimeout(() => {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }, 2000);

  // Quick actions feedback
  document.querySelectorAll('.quick-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const txt = btn.textContent.trim();
      if (txt) alert(txt);
    });
  });
});
