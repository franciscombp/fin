// Enlace de los botones data-fx-test que estaba en haptics.js
    // Menú "Probar efectos" del perfil
    var status = document.getElementById('fx-test-status');
    if (status) {
      var hap = canVibrate ? 'vibración nativa (Android)' : (/iP(hone|ad)/.test(navigator.userAgent) ? 'iOS no permite vibración web (sólo sonido)' : 'sin vibración en este dispositivo');
      status.textContent = 'Soporte: ' + hap + ' · audio ' + ((window.AudioContext || window.webkitAudioContext) ? 'sí' : 'no');
    }
    document.querySelectorAll('[data-fx-test]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.dataset.fxTest;
        lastAt = 0; // que el anti-rebote no se coma la prueba
        unlock();
        if (k === 'welcome') window.Haptics.welcome(); else fire(k);
        btn.classList.remove('fx-test--play'); void btn.offsetWidth; btn.classList.add('fx-test--play');
        if (k === 'error') { btn.classList.remove('fx-shake'); void btn.offsetWidth; btn.classList.add('fx-shake'); }
      });
    });

