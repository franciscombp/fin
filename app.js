// PWA - Register Service Worker for offline support
// Service worker: busca versión nueva al abrir y al volver a la app; si
// hay una, toma el control y la página se recarga sola una vez.
// Service worker: busca versión nueva al abrir y al volver a la app. La
// recarga nunca interrumpe nada: si hay una verificación biométrica en
// curso o la persona está dentro de la app, se aplica la próxima vez que
// la app pase a segundo plano (fuera de Face ID).
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let pendingReload = false;
  const safeToReload = () => !window.__authBusy && document.getElementById('login-screen')?.classList.contains('active');
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || pendingReload) return;
    pendingReload = true;
    if (safeToReload()) location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (pendingReload && document.visibilityState === 'hidden' && !window.__authBusy) location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    const check = () => { if (!window.__authBusy) reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 5 * 60 * 1000);
    if (reg.waiting) reg.waiting.postMessage('skipWaiting');
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage('skipWaiting'); });
    });
  }).catch(err => {
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

  // Login biométrico real (WebAuthn) con fallback simulado.
  // iOS sólo muestra Face ID si navigator.credentials se llama enseguida
  // del toque: la disponibilidad se averigua al cargar, no en el click.
  const auth = window.BPAuth;
  let platformOk = !!(auth && auth.supported); // optimista mientras responde
  if (auth && auth.supported) auth.platformAvailable().then(ok => { platformOk = ok; });

  if (btnLoginBiometric) {
    btnLoginBiometric.addEventListener('click', async () => {
      const original = btnLoginBiometric.textContent;
      const useReal = auth && auth.supported && platformOk;
      const hadCred = useReal && auth.hasCredential();
      const t0 = Date.now();
      window.__authBusy = true;
      // Sin audio vivo durante Face ID: iOS interrumpe la sesión de audio
      // y un contexto a medio sonar queda colgado emitiendo ruido.
      if (useReal && window.Haptics_killAudio) window.Haptics_killAudio();
      // La llamada a WebAuthn va primero, todavía dentro del gesto.
      const pending = useReal ? auth.verify() : new Promise(r => setTimeout(r, 1600));
      btnLoginBiometric.disabled = true;
      btnLoginBiometric.textContent = useReal ? (hadCred ? 'Verificando…' : 'Registrando…') : 'Autenticando...';
      // Pantalla amarilla de bienvenida mientras autentica
      if (welcomeSplash) welcomeSplash.classList.add('show');
      if (loadingSpinner) loadingSpinner.style.display = 'inline-block';

      try {
        await pending;
        // El sonido de ingreso suena recién al autenticar, nunca antes de Face ID
        if (window.Haptics) window.Haptics.welcome();
        showHome();
      } catch (err) {
        console.warn('Biometría cancelada/fallida:', err);
        if (welcomeSplash) welcomeSplash.classList.remove('show');
        // Falla inmediata con passkey guardada = esa passkey ya no existe en
        // este iPhone (se borró o cambió el sitio). Se olvida y el próximo
        // toque registra una nueva.
        if (hadCred && Date.now() - t0 < 1500) {
          auth.reset();
          alert('No encontramos tu Face ID registrado en este dispositivo. Toca Ingresar otra vez para registrarlo.');
        } else {
          alert('No se pudo verificar tu identidad. Inténtalo de nuevo.');
        }
      } finally {
        window.__authBusy = false;
        btnLoginBiometric.disabled = false;
        btnLoginBiometric.textContent = original || 'Ingresar';
        if (loadingSpinner) loadingSpinner.style.display = 'none';
      }
    });
  }

  // Otro método de ingreso: entra directo, sin pedir identificación,
  // pero con la misma pantalla de bienvenida que el login biométrico
  // para que la transición se sienta igual de intencional.
  if (btnLoginOther) {
    btnLoginOther.addEventListener('click', () => {
      if (welcomeSplash) welcomeSplash.classList.add('show');
      if (window.Haptics) window.Haptics.welcome();
      setTimeout(showHome, 1400);
    });
  }

  // Cerrar sesión
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('¿Deseas cerrar sesión?')) showLogin();
    });
  }
});
