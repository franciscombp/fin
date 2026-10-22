        // ---------- Modo finanzas: resumen consolidado de productos ----------
        const financePage = document.getElementById('finance-page');
        setupCollapsingHeader(financePage, document.getElementById('finance-title'), document.getElementById('finance-topbar'));

        function openFinancePage() {
            financePage.classList.remove('scrolled');
            financePage.scrollTop = 0;
            document.body.style.overflow = 'hidden';
            financePage.classList.add('open');
        }
        function closeFinancePage() {
            if (!financePage.classList.contains('open')) return;
            financePage.classList.remove('open');
            document.body.style.overflow = '';
        }
        document.getElementById('finance-back').addEventListener('click', closeFinancePage);
        window.addEventListener('keydown', e => {
            if (e.key === 'Escape' && financePage.classList.contains('open')) closeFinancePage();
        });


/* productos.js */
    // Patrimonio neto de Modo finanzas: lo que tienes menos lo que debes (incluye lo que te deben)
    var nw = document.querySelector('.finance-networth strong');
    if (nw) Promise.all([Persona.cuentas(id), Persona.deudas(id)]).then(function (r) {
      var activos = suma(r[0]);
      var cobrar = r[1].filter(function (d) { return d.clase === 'cobrar'; }).reduce(function (t, d) { return t + Math.abs(d.saldo); }, 0);
      var deuda = suma(r[1].filter(function (d) { return d.clase !== 'cobrar'; }));
      var v = activos + cobrar - deuda;
      if (Persona.get() === id) nw.textContent = (v < 0 ? '-' : '') + money(v);
    });

/* asistente.js: la acción «Modo finanzas» abría Mis finanzas */
  /* ---------- Entradas: Inicio y Modo finanzas ----------
     Tarjeta aireada: ilustración centrada sobre un círculo neutro,
     un solo mensaje y un link. */
  function mountEntries() {
    // Mis finanzas reemplaza al antiguo "Modo finanzas" (activos/pasivos/
    // cuentas duplicaban esta vista): el acceso abre directamente el PFM.
    // En Inicio, Mis finanzas vive como un widget de Destacados.
    if (mountEntries._done) return; mountEntries._done = true;
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-action="Modo finanzas"]');
      if (!b) return;
      e.stopImmediatePropagation(); e.preventDefault();
      openPF();
    }, true);
  }
