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

    let hasPermission = false;
    let alpha = 0, beta = 0, gamma = 0;
    let isFlipped = false;

    const handleOrientation = (event) => {
      alpha = event.alpha || 0;
      beta = Math.max(-30, Math.min(30, event.beta || 0));
      gamma = Math.max(-30, Math.min(30, event.gamma || 0));
    };

    const requestPermission = async () => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === 'granted') {
            hasPermission = true;
            window.addEventListener('deviceorientation', handleOrientation);
          }
        } catch (err) {
          console.log('Gyroscope permission denied');
        }
      } else if (typeof DeviceOrientationEvent !== 'undefined') {
        hasPermission = true;
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
      const baseTransform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
      debitCard.style.transform = `perspective(1000px) ${baseTransform}`;
    });

    let ticking = false;
    const tick = () => {
      if (!hasPermission) {
        // Auto-rotating animation when no permission
        const rotX = (Math.sin(Date.now() / 3000) * 8);
        const rotY = (Math.cos(Date.now() / 2500) * 12);
        const baseRotation = isFlipped ? `rotateY(180deg) rotateX(${rotX}deg)` : `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        debitCard.style.transform = `perspective(1000px) ${baseRotation}`;

        const shine = debitCard.querySelector('.debit-card__shine');
        if (shine && !isFlipped) {
          const shinePos = ((Date.now() % 8000) / 8000) * 440 - 80;
          shine.style.setProperty('--shine-pos', `${shinePos}px`);
        }
      } else {
        // Gyroscope-controlled rotation (beta = tilt forward/back, gamma = tilt left/right)
        const rotX = (beta / 30) * 15;
        const rotY = (gamma / 30) * 15;
        const baseRotation = isFlipped ? `rotateY(180deg) rotateX(${rotX}deg)` : `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        debitCard.style.transform = `perspective(1000px) ${baseRotation}`;

        const shine = debitCard.querySelector('.debit-card__shine');
        if (shine && !isFlipped) {
          // Inverse shine effect: when tilted right (gamma > 0), shine goes left
          const shinePos = ((30 - gamma) / 60) * 440 - 80;
          shine.style.setProperty('--shine-pos', `${shinePos}px`);
          shine.classList.add('gyro-controlled');
        }
      }
      ticking = false;
    };

    const scheduleFrame = () => {
      if (!ticking) {
        requestAnimationFrame(tick);
        ticking = true;
      }
    };

    scheduleFrame();
    setInterval(scheduleFrame, 50);

    // Mouse fallback
    debitCard.addEventListener('mousemove', (e) => {
      if (hasPermission || isFlipped) return;
      const rect = debitCard.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotY = (x - 0.5) * 30;
      const rotX = (y - 0.5) * 20;
      debitCard.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });

    debitCard.addEventListener('mouseleave', () => {
      if (!hasPermission && !isFlipped) {
        debitCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
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
