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

  // Toast system
  function showToast(message, actionText, actionCallback) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    if (actionText && actionCallback) {
      const action = document.createElement('button');
      action.textContent = actionText;
      action.className = 'toast__action';
      action.addEventListener('click', actionCallback);
      toast.appendChild(action);
    }

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast--show');
      setTimeout(() => {
        toast.classList.remove('toast--show');
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    }, 100);
  }

  // Loading state
  function simulateLoad() {
    const skeletons = document.querySelectorAll('.skeleton-loader');
    skeletons.forEach(skeleton => {
      setTimeout(() => {
        skeleton.classList.add('loaded');
      }, 800);
    });
  }

  // Tabs
  function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    });
  }

  // Bottom navigation + views
  function initViews() {
    const navItems = document.querySelectorAll('.bottom-nav__item');
    const views = document.querySelectorAll('.view');

    navItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        switchView(index);
      });
    });

    function switchView(viewIndex) {
      views.forEach((view, idx) => {
        if (idx === viewIndex) {
          view.classList.add('view--active');
          view.classList.remove('view--hidden');
          const direction = idx > currentView ? 'enter-right' : 'enter-left';
          view.style.animation = `${direction} 0.4s cubic-bezier(0.4, 0, 0.2, 1)`;
        } else {
          view.classList.remove('view--active');
          view.classList.add('view--hidden');
        }
      });
      currentView = viewIndex;
    }

    initTabs();
    simulateLoad();
  }

  let currentView = 0;

  // Balance toggle
  function initBalanceToggle() {
    const balanceToggle = document.getElementById('balance-toggle');
    const balanceAmount = document.getElementById('balance');
    let isHidden = false;

    if (balanceToggle && balanceAmount) {
      balanceToggle.addEventListener('click', () => {
        isHidden = !isHidden;
        balanceAmount.textContent = isHidden ? '$ ••••••' : '$ 1.906,04';
        const icon = balanceToggle.querySelector('.material-symbols-rounded');
        if (icon) {
          icon.textContent = isHidden ? 'visibility_off' : 'visibility';
        }
      });
    }
  }

  // Gyroscope card effects
  function initGyroscope() {
    const debitCard = document.getElementById('debit-card');
    if (!debitCard) return;

    let gyroActive = false;
    let isFlipped = false;
    let curX = 0, curY = 0;
    let targetX = 0, targetY = 0;
    const SHINE_FROM = -80;
    const SHINE_TO = 360;

    const handleOrientation = (event) => {
      if (event.gamma === null && event.beta === null) return;
      gyroActive = true;
      // Solo gamma (inclinación izq/der) para el shine inverso
      targetX = Math.max(-1, Math.min(1, (event.gamma || 0) / 40));
      targetY = 0;
    };

    const requestPermission = async () => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        } catch (err) {
          console.log('Gyroscope permission denied');
        }
      } else if (typeof DeviceOrientationEvent !== 'undefined') {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    const gyroModal = document.querySelector('.gyro-permission-modal');
    const gyroButton = gyroModal ? gyroModal.querySelector('button') : null;
    if (gyroButton) {
      gyroButton.addEventListener('click', requestPermission);
    }

    // Card flip functionality
    debitCard.addEventListener('click', (e) => {
      e.preventDefault();
      isFlipped = !isFlipped;
      const baseTransform = isFlipped ? 'perspective(1000px) rotateY(180deg)' : 'perspective(1000px) rotateY(0deg)';
      debitCard.style.transform = baseTransform;
    });

    const shineEl = debitCard.querySelector('.debit-card__shine');

    const tick = () => {
      // Smooth interpolation to prevent jitter
      curX += (targetX - curX) * 0.12;
      const effectiveY = gyroActive ? 0 : targetY;
      curY += (effectiveY - curY) * 0.12;

      debitCard.style.setProperty('--gx', curX.toFixed(4));
      debitCard.style.setProperty('--gy', curY.toFixed(4));

      if (gyroActive) {
        // Gyroscope mode: only horizontal shine movement
        debitCard.style.transform = isFlipped ? 'perspective(1000px) rotateY(180deg) scale(1)' : 'perspective(1000px) scale(1)';
        if (shineEl && !isFlipped) {
          shineEl.classList.add('gyro-controlled');
          // Inverse shine: when tilted right (targetX > 0), shine goes left
          const shinePos = SHINE_FROM + ((-curX + 1) / 2) * (SHINE_TO - SHINE_FROM);
          shineEl.style.setProperty('--shine-pos', `${shinePos.toFixed(1)}px`);
        }
      } else {
        // Desktop/mouse mode: 3D rotation
        if (!isFlipped) {
          const tiltX = curX * 4;
          const tiltY = curY * -4;
          debitCard.style.transform = `perspective(1000px) rotateY(${tiltX}deg) rotateX(${tiltY}deg) scale(1)`;

          if (shineEl) {
            const shinePos = SHINE_FROM + ((curX + 1) / 2) * (SHINE_TO - SHINE_FROM);
            shineEl.style.setProperty('--shine-pos', `${shinePos.toFixed(1)}px`);
          }
        }
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

    // Mouse fallback
    debitCard.addEventListener('mousemove', (e) => {
      if (gyroActive) return;
      const rect = debitCard.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      targetX = (x - 0.5) * 2;
      targetY = (y - 0.5) * 2;
    });

    debitCard.addEventListener('mouseleave', () => {
      if (!gyroActive) {
        targetX = 0;
        targetY = 0;
      }
    });
  }

  // Bottom sheet
  function initBottomSheet() {
    const sheetBackdrop = document.querySelector('.sheet-backdrop');
    const sheet = document.querySelector('.sheet');
    const sheetHandle = document.querySelector('.sheet__handle');
    let startY = 0;
    let currentY = 0;

    if (sheet && sheetBackdrop) {
      const close = () => {
        sheet.style.transform = 'translateY(0)';
        sheet.style.opacity = '1';
        sheetBackdrop.style.display = 'none';
      };

      if (sheetHandle) {
        sheetHandle.addEventListener('touchstart', (e) => {
          startY = e.touches[0].clientY;
        });

        document.addEventListener('touchmove', (e) => {
          if (sheetBackdrop.style.display !== 'none') {
            currentY = e.touches[0].clientY - startY;
            if (currentY > 0) {
              sheet.style.transform = `translateY(${currentY}px)`;
              sheet.style.opacity = `${Math.max(0, 1 - currentY / 300)}`;
            }
          }
        });

        document.addEventListener('touchend', () => {
          if (currentY > 90) {
            close();
          } else {
            sheet.style.transform = 'translateY(0)';
            sheet.style.opacity = '1';
          }
          currentY = 0;
        });
      }

      sheetBackdrop.addEventListener('click', close);
    }
  }

  // Card detail modal
  function initCardModal() {
    const modal = document.querySelector('.card-detail-modal');
    if (!modal) return;

    let startY = 0;
    let currentY = 0;

    const close = () => {
      modal.style.transform = 'translateY(0)';
      modal.style.opacity = '1';
      modal.style.pointerEvents = 'auto';
    };

    modal.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    });

    modal.addEventListener('touchmove', (e) => {
      currentY = e.touches[0].clientY - startY;
      if (currentY > 0) {
        modal.style.transform = `translateY(${currentY}px)`;
        modal.style.opacity = `${Math.max(0, 1 - currentY / 300)}`;
      }
    });

    modal.addEventListener('touchend', () => {
      if (currentY > 100) {
        modal.style.transform = 'translateY(100%)';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
      } else {
        close();
      }
      currentY = 0;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.opacity !== '0') {
        close();
      }
    });
  }

  function initializeHomeFeatures() {
    initViews();
    initBalanceToggle();
    initGyroscope();
    initBottomSheet();
    initCardModal();
  }

  // Biometric login
  if (btnLoginBiometric) {
    btnLoginBiometric.addEventListener('click', () => {
      btnLoginBiometric.disabled = true;
      btnLoginBiometric.textContent = 'Autenticando...';
      if (loadingSpinner) {
        loadingSpinner.style.display = 'flex';
      }
      setTimeout(() => {
        showHome();
        btnLoginBiometric.disabled = false;
        btnLoginBiometric.textContent = 'Ingresar con Huella';
        if (loadingSpinner) {
          loadingSpinner.style.display = 'none';
        }
        initializeHomeFeatures();
      }, 2000);
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
      if (confirm('¿Deseas cerrar sesión?')) {
        showLogin();
      }
    });
  }

  // Keyboard escape for modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.querySelector('.card-detail-modal');
      if (modal && modal.style.opacity !== '0') {
        modal.style.transform = 'translateY(100%)';
        modal.style.opacity = '0';
      }
    }
  });

  // Initialize styles for home page
  if (homePage) {
    homePage.classList.add('hidden');
  }
});
