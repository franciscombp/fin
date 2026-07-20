// PWA - Register Service Worker for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.log('Service Worker registration failed:', err);
  });
}

// Screen management
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function transitionToLogin() {
  showScreen('login-screen');
}

// Login functionality
function loginWithBiometric() {
  const btn = document.getElementById('btn-login-biometric');
  const spinner = document.getElementById('loading-spinner');

  btn.disabled = true;
  btn.textContent = 'Autenticando...';
  spinner.style.display = 'block';

  // Simulate biometric authentication
  setTimeout(() => {
    showScreen('home-screen');
    btn.disabled = false;
    btn.textContent = 'Ingresar';
    spinner.style.display = 'none';
  }, 2000);
}

// Logout
function logout() {
  if (confirm('¿Deseas cerrar sesión?')) {
    showScreen('welcome-screen');
  }
}

// Card Modal
let cardVerified = false;

function openCardModal() {
  // Require biometric verification first
  const btn = document.getElementById('btn-login-biometric');
  const spinner = document.getElementById('loading-spinner');

  cardVerified = false;
  btn.disabled = true;
  btn.textContent = 'Verificando identidad...';
  spinner.style.display = 'block';

  setTimeout(() => {
    cardVerified = true;
    spinner.style.display = 'none';
    btn.disabled = false;
    btn.textContent = 'Ingresar';
    document.getElementById('card-modal').classList.add('active');
  }, 1500);
}

function closeCardModal() {
  document.getElementById('card-modal').classList.remove('active');
  cardVerified = false;
  resetCardFlip();
}

// Card flip
function flipCard() {
  if (!cardVerified) {
    alert('Debes verificar tu identidad primero');
    return;
  }
  const inner = document.getElementById('card-flip-inner');
  inner.classList.toggle('flipped');
}

function resetCardFlip() {
  const inner = document.getElementById('card-flip-inner');
  inner.classList.remove('flipped');
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Copiado: ' + text);
  }).catch(() => {
    alert('Error al copiar');
  });
}

// CVV toggle
let cvvVisible = false;
function toggleCVV() {
  const display = document.getElementById('cvv-display');
  cvvVisible = !cvvVisible;
  display.textContent = cvvVisible ? '123' : '***';
}

// Stories
function openStories() {
  document.getElementById('stories-container').classList.add('active');
  startStoryTimer();
}

function closeStories() {
  document.getElementById('stories-container').classList.remove('active');
}

function startStoryTimer() {
  setTimeout(() => {
    closeStories();
  }, 5000);
}

// Action feedback
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', function() {
      const action = this.getAttribute('data-action');
      // Uncomment to see action feedback
      // console.log('Action:', action);
    });
  });
});
