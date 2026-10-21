/* =====================================================================
   DemoPersona — la persona de la demo, sacada de la base de usuarios
   (assets/pfm/datos.json): sus cuentas, tarjetas, deudas, inversiones,
   con quién se mueve dinero, qué servicios paga y, con eso, qué atajos
   le convienen y qué le conviene ver primero. Todo se deriva de sus
   movimientos: nada está escrito a mano por persona.
   ===================================================================== */
(function () {
  'use strict';
  var KEY = 'kbdemo_usuario', base = null, actual = null, cache = {};
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function money(v) { var s = Math.abs(+v || 0).toFixed(2).split('.'); return '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1]; }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function fechaL(iso) { var m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], p = String(iso).split('-'); return p.length === 3 ? (+p[2]) + ' ' + m[+p[1] - 1] : iso; }
  function mediana(xs) { if (!xs.length) return 0; var s = xs.slice().sort(function (a, b) { return a - b; }); return s[Math.floor(s.length / 2)]; }

  function cargar(url) {
    return fetch(url || '../assets/pfm/datos.json').then(function (r) { return r.json(); }).then(function (d) {
      base = d;
      var g = null; try { g = localStorage.getItem(KEY); } catch (e) {}
      actual = g && d.usuarios.some(function (u) { return u.usuario === g; }) ? g : d.usuarios[0].usuario;
      return api;
    });
  }
  function lista() { return base ? base.usuarios.map(function (u) { return { id: u.usuario, nombre: u.nombre, tipo: u.tipo, ciudad: u.ciudad, edad: u.edad }; }) : []; }
  function set(id) { if (!base || !base.usuarios.some(function (u) { return u.usuario === id; })) return; actual = id; try { localStorage.setItem(KEY, id); } catch (e) {} }
  function get() { return actual; }

  // Quién es una persona (y no una empresa, una cooperativa o uno mismo) en una descripción de movimiento
  var EMPRESA = /c[ií]a|s\.a|s\.a\.s|ltda|cooperativa|universidad|unidad educativa|distribuidora|hnos|banco|municipio|cuota|matr[ií]cula|pensi[oó]n|cr[eé]dito|intermex|western/i;
  var ENVIO = [[/^Transf\. Directa a (.+)$/, 'Pichibank'], [/^Transf\. Interbancaria a (.+)$/, 'Otro banco'], [/^Pago a persona (.+)$/, 'Deuna']];
  var RECIBO = [[/^Transf\. Directa de (.+)$/, 'Pichibank'], [/^Transferencia recibida de (.+)$/, 'Pichibank'], [/^Transf\. Interbancaria de (.+)$/, 'Otro banco'], [/^Transf\. Deuna de .+? \((.+)\)$/, 'Deuna'], [/^Transferencia internacional recibida .*?[-–] (.+)$/, 'Exterior'], [/^Transferencia internacional recibida desde (.+?) - (.+)$/, 'Exterior']];
  var SERVICIO = [[/^Pago por servicio de (.+)$/], [/^D[eé]bito autom[aá]tico (.+)$/], [/^(CLARO|MOVISTAR|CNT) (PLAN .+)$/], [/^Pago a comercio (Claro recargas)$/], [/^(CLARO RECARGA ONLINE)$/]];
  function limpiarEmpresa(s) { return s.replace(/\s+(pensi[oó]n|matr[ií]cula|tarjeta.*|cr[eé]dito.*|impuesto predial|recarga prepago)$/i, '').trim(); }

  function derivar(id) {
    if (cache[id]) return cache[id];
    var d = base, D = d.dic, u = d.usuarios.filter(function (x) { return x.usuario === id; })[0], mov = d.movimientos[id] || [], yo = norm(u.nombre);
    var cuentasB = (d.cuentas && d.cuentas[id]) || [], deudas = d.deudas.filter(function (x) { return x.usuario === id; });
    var cuentas = cuentasB.filter(function (c) { return c.tipo === 'transaccional' || c.tipo === 'ahorro'; }).map(function (c) { return { nombre: c.nombre, numero: c.numero, saldo: c.saldo, etiqueta: c.nombre + ' ···' + c.numero + ' · ' + money(c.saldo) }; });
    var metas = cuentasB.filter(function (c) { return c.tipo === 'meta'; }), inversiones = cuentasB.filter(function (c) { return c.tipo === 'inversion'; });
    var cupo = (u.productos_bp.match(/cupo \$\s?([\d.]+)/i) || [])[1];
    var tarjetas = deudas.filter(function (x) { return x.clase === 'tarjeta' && !/cr[eé]dito directo|etafashion|de prati|la ganga/i.test(x.producto + ' ' + x.institucion); }).map(function (x) {
      var mvp = /^S/.test(String(x.en_mvp)), lim = mvp && cupo ? parseFloat(cupo.replace('.', '')) : (mvp ? 2000 : 1500);
      return { nombre: x.producto, banco: x.institucion, saldo: x.saldo, minimo: x.saldo > 0 ? Math.max(5, Math.min(x.saldo, x.cuota_mensual || x.saldo * .05)) : 0, limite: lim, mvp: mvp, etiqueta: x.producto + (mvp ? '' : ' · ' + x.institucion) };
    });
    var prestamos = deudas.filter(function (x) { return (x.clase === 'prestamo' || x.clase === 'hipoteca') && x.saldo > 0; }).map(function (x) { return { nombre: x.producto, banco: x.institucion, saldo: x.saldo, cuota: x.cuota_mensual, clase: x.clase, mvp: /^S/.test(String(x.en_mvp)) }; });
    var hs = Array.isArray(d.hipoteca) ? d.hipoteca : (d.hipoteca ? [d.hipoteca] : []), hip = hs.filter(function (h) { return h.usuario === id; })[0] || null;
    var cobrar = deudas.filter(function (x) { return x.clase === 'cobrar'; });

    // Contactos: con quién se mueve dinero, cuántas veces, la última vez y el monto típico
    var C = {}, S = {}, recargas = 0, recargaMontos = [], remesa = null, isd = 0, qr = 0, pagoTarjeta = 0;
    mov.forEach(function (r) {
      var desc = D.descripcion[r[4]] || '', monto = r[6], fecha = r[0], cat = D.categoria[r[8]] || '';
      var m = null, modo = null, banco = null;
      ENVIO.some(function (p) { var x = desc.match(p[0]); if (x) { m = x[x.length - 1]; modo = 'envio'; banco = p[1]; return true; } return false; });
      if (!m) RECIBO.some(function (p) { var x = desc.match(p[0]); if (x) { m = x[x.length - 1]; modo = 'recibo'; banco = p[1]; return true; } return false; });
      if (m && !EMPRESA.test(m) && norm(m).indexOf(yo.split(' ')[0]) !== 0) {
        var n = m.replace(/\s*\(.*\)$/, '').trim(), c = C[n] || (C[n] = { n: n, veces: 0, enviados: 0, recibidos: 0, montos: [], ult: '', banco: banco, deuna: false, exterior: false });
        c.veces++; if (modo === 'envio') { c.enviados++; c.montos.push(Math.abs(monto)); } else c.recibidos++;
        if (fecha > c.ult) c.ult = fecha;
        if (banco === 'Deuna') c.deuna = true; if (banco === 'Exterior') { c.exterior = true; remesa = remesa || { de: n, monto: Math.abs(monto) }; }
      }
      SERVICIO.some(function (p) { var x = desc.match(p[0]); if (x) { var e = limpiarEmpresa(x[x.length - 1]); var s = S[e] || (S[e] = { empresa: e, veces: 0, montos: [], ult: '' }); s.veces++; s.montos.push(Math.abs(monto)); if (fecha > s.ult) s.ult = fecha; return true; } return false; });
      if (/recarga/i.test(desc) && !/Recarga de saldo/.test(desc)) { recargas++; recargaMontos.push(Math.abs(monto)); }
      if (/IMPUESTO ISD/.test(desc)) isd++;
      if (/Cobro QR/.test(desc)) qr++;
      if (cat === 'Pago de tarjeta') pagoTarjeta++;
    });
    var contactos = Object.keys(C).map(function (k) {
      var c = C[k], partes = c.n.split(' ');
      return { n: c.n, alias: partes[0], banco: c.exterior ? 'Exterior' : c.banco, cuenta: '···' + String(1000 + hash(c.n) % 9000), tel: c.deuna || c.banco === 'Pichibank' ? '09' + String(10000000 + hash(c.n + 't') % 90000000) : '',
        veces: c.veces, enviados: c.enviados, recibidos: c.recibidos, ult: fechaL(c.ult), ultISO: c.ult, montoTipico: mediana(c.montos), exterior: c.exterior };
    }).sort(function (a, b) { return b.veces - a.veces; });
    var servicios = Object.keys(S).map(function (k) { var s = S[k]; return { empresa: s.empresa, veces: s.veces, monto: mediana(s.montos), ult: fechaL(s.ult) }; }).sort(function (a, b) { return b.veces - a.veces; });
    // La agenda de la base (tools/pfm-agenda.py): contactos con favoritos y celular Deuna, beneficiarios en el
    // exterior, números para recargar, servicios domiciliados y pagos recurrentes. Si existe, manda sobre lo derivado.
    var ag = (d.agenda && d.agenda[id]) || null, exterior = [], deuna = null, recargasL = [], domiciliados = [], recurrentes = [], favoritos = [];
    if (ag) {
      contactos = (ag.contactos || []).map(function (c) { var der = C[c.nombre]; return { n: c.nombre, alias: c.alias, banco: c.banco, cuenta: '···' + String(c.cuenta).slice(-4), cuentaCompleta: c.cuenta, tipoCuenta: c.tipo_cuenta, cedula: c.cedula, tel: c.celular || '', deuna: !!c.deuna, favorito: !!c.favorito,
        veces: c.veces, enviados: der ? der.enviados : 0, recibidos: der ? der.recibidos : 0, ult: c.ultimo ? fechaL(c.ultimo) : 'nunca', ultISO: c.ultimo || '', montoTipico: c.monto_tipico || 0, exterior: false }; })
        .sort(function (a, b) { return (b.favorito - a.favorito) || (b.veces - a.veces); });
      exterior = (ag.exterior || []).map(function (e) { return { n: e.nombre, alias: e.nombre.split(' ')[0], pais: e.pais, moneda: e.moneda, banco: e.banco, swift: e.swift, cuenta: e.cuenta, relacion: e.relacion, veces: e.veces, ult: e.ultimo ? fechaL(e.ultimo) : '', montoTipico: e.monto_tipico || 0 }; });
      deuna = ag.deuna || null; recargasL = ag.recargas || []; domiciliados = ag.domiciliados || []; recurrentes = ag.recurrentes || []; favoritos = ag.favoritos || [];
      // Los servicios con su contrato y lo que suele costar, domiciliados primero
      var vistosS = {};
      servicios = domiciliados.map(function (x) { vistosS[x.empresa] = 1; return { empresa: x.empresa, contrato: x.contrato, veces: x.veces, monto: x.monto_tipico, dia: x.dia, ult: fechaL(x.ultimo), auto: true, tope: x.tope }; })
        .concat(recurrentes.map(function (x) { vistosS[x.empresa] = 1; return { empresa: x.empresa, contrato: x.contrato, veces: x.veces, monto: x.monto_tipico, dia: x.dia, ult: fechaL(x.ultimo), auto: false }; }))
        .concat(servicios.filter(function (x) { return !vistosS[x.empresa]; }));
    }

    // Atajos que le convienen: lo que repite (a quién transfiere, qué paga, qué recarga)
    var sugeridos = [];
    contactos.filter(function (c) { return c.enviados >= 3 && !c.exterior; }).slice(0, 2).forEach(function (c) { sugeridos.push({ nombre: 'Transferir a ' + c.alias, accion: 'accion.transferir', datos: { contacto: c.n, monto: Math.round(c.montoTipico) }, s: c.enviados + ' veces · suele ser ' + money(c.montoTipico) }); });
    servicios.filter(function (s) { return !s.auto && s.veces >= 3 && !/claro recargas|recarga online/i.test(s.empresa); }).slice(0, 2).forEach(function (s) { sugeridos.push({ nombre: 'Pagar ' + s.empresa, accion: 'accion.pagar-servicios', datos: { empresa: s.empresa, contrato: s.contrato || String(100000 + hash(s.empresa + id) % 900000), monto: Math.round(s.monto * 100) / 100 }, s: 'Cada mes' + (s.dia ? ', el ' + s.dia : '') + ' · ' + money(s.monto) }); });
    if (recargas >= 3 || recargasL.length) { var rc = recargasL[0] || { numero: '09' + String(10000000 + hash(id) % 90000000), operadora: 'Claro', monto_tipico: Math.round(mediana(recargaMontos)) || 5 }; if (recargas >= 3) sugeridos.push({ nombre: 'Recargar mi celular', accion: 'accion.recargar', datos: { operadora: rc.operadora, numero: rc.numero, monto: rc.monto_tipico }, s: recargas + ' recargas · ' + money(rc.monto_tipico) }); }
    var tj = tarjetas.filter(function (t) { return t.mvp && t.saldo > 0; })[0];
    if (tj) sugeridos.push({ nombre: 'Pagar mi ' + tj.nombre.split(' ')[0], accion: 'accion.pagar-tarjeta', datos: { tarjeta: tj.etiqueta, monto: Math.round(tj.saldo * 100) / 100 }, s: 'Debes ' + money(tj.saldo) });

    // Para ti: lo primero que le sirve ver, según lo que tiene y lo que hace
    var paraTi = [];
    if (tj) paraTi.push({ t: 'Pagar tu ' + tj.nombre, s: 'Debes ' + money(tj.saldo) + (tj.minimo < tj.saldo ? ' · mínimo ' + money(tj.minimo) : ''), accion: 'accion.pagar-tarjeta', datos: { tarjeta: tj.etiqueta, monto: Math.round(tj.saldo * 100) / 100 } });
    var otra = tarjetas.filter(function (t) { return !t.mvp && t.saldo > 0; }).sort(function (a, b) { return b.saldo - a.saldo; })[0];
    if (otra && otra.minimo < otra.saldo * .2) paraTi.push({ t: 'Dejar de pagar solo el mínimo', s: otra.nombre + ' · ' + otra.banco + ': debes ' + money(otra.saldo), id: 'faq.tarjetas.intereses' });
    if (hip) paraTi.push({ t: 'Cuota de tu hipoteca', s: money(hip.cuota) + ' el ' + fechaL(hip.proxima) + ' · vas ' + hip.pagadas + ' de ' + hip.cuotas, accion: 'accion.pagar-prestamo', datos: { monto: hip.cuota } });
    else if (prestamos.filter(function (p) { return p.mvp; })[0]) { var pr = prestamos.filter(function (p) { return p.mvp; })[0]; paraTi.push({ t: 'Cuota de tu ' + pr.nombre.toLowerCase(), s: money(pr.cuota) + ' al mes · debes ' + money(pr.saldo), accion: 'accion.pagar-prestamo', datos: { monto: pr.cuota } }); }
    if (exterior.length) paraTi.push({ t: 'Enviar a ' + exterior[0].alias + ' en ' + exterior[0].pais, s: exterior[0].banco + ' · ' + exterior[0].swift + ' · te envía ' + money(exterior[0].montoTipico) + ' cada mes', accion: 'accion.transferir-exterior', datos: { contacto: exterior[0].n, pais: exterior[0].pais, swift: exterior[0].swift } });
    else if (remesa) paraTi.push({ t: 'Recibir dinero del exterior', s: 'Te envía ' + remesa.de.split(' ')[0] + ' · la última ' + money(remesa.monto) + ', sin ISD', id: 'faq.cuentas.exterior' });
    if (domiciliados.length) paraTi.push({ t: domiciliados[0].empresa + ' se paga solo', s: 'Débito automático el ' + domiciliados[0].dia + ' de cada mes · ' + money(domiciliados[0].monto_tipico) + ' · tope ' + money(domiciliados[0].tope), id: 'faq.pagos.automatico' });
    if (qr >= 20) paraTi.push({ t: 'Cobrar con QR', s: qr + ' cobros de clientes · muestra tu QR sin ingresar', accion: 'accion.cobrar-qr' });
    if (isd >= 3) paraTi.push({ t: '¿Por qué te cobran ISD?', s: isd + ' cargos por suscripciones del exterior', id: 'faq.cuentas.isd' });
    if (cuentas[0] && cuentas[0].saldo < 50) paraTi.push({ t: 'Armar un pequeño colchón', s: 'Tu ' + cuentas[0].nombre.toLowerCase() + ' tiene ' + money(cuentas[0].saldo), id: 'faq.inversiones.meta' });
    if (!tarjetas.some(function (t) { return t.mvp; })) paraTi.push({ t: 'Solicitar tu primera tarjeta', s: 'Respuesta en minutos', id: 'prod.tarjetas.credito' });
    if (cobrar.length) paraTi.push({ t: 'Te deben ' + money(cobrar.reduce(function (t, x) { return t + Math.abs(x.saldo); }, 0)), s: cobrar.map(function (x) { return x.producto; }).join(', '), accion: 'accion.recibir' });
    if (inversiones.length) paraTi.push({ t: 'Tu ' + inversiones[0].nombre.toLowerCase(), s: money(inversiones[0].saldo) + ' invertidos', id: 'faq.inversiones.vence' });
    if (metas.length) paraTi.push({ t: 'Meta: ' + metas[0].nombre, s: money(metas[0].saldo) + ' de ' + money(metas[0].meta), accion: 'accion.meta' });

    // Valores para los textos de la base ({tarjeta.deuda}, {prestamo.cuota}…)
    var tv = tarjetas.filter(function (t) { return t.mvp; })[0] || tarjetas[0], pv = hip ? { cuota: hip.cuota, vence: fechaL(hip.proxima), n: hip.pagadas + 1, de: hip.cuotas } : (prestamos[0] ? { cuota: prestamos[0].cuota, vence: '20 de cada mes', n: 1, de: Math.ceil(prestamos[0].saldo / (prestamos[0].cuota || 1)) } : null);
    var valores = { 'persona.nombre': u.nombre.split(' ')[0], 'cuenta.ultimos': cuentas[0] ? cuentas[0].numero : '', 'cuenta.nombre': cuentas[0] ? cuentas[0].nombre : '', 'cuenta.saldo': cuentas[0] ? money(cuentas[0].saldo) : '' };
    if (tv) { valores['tarjeta.nombre'] = tv.nombre; valores['tarjeta.deuda'] = money(tv.saldo); valores['tarjeta.minimo'] = money(tv.minimo); valores['tarjeta.limite'] = money(tv.limite); valores['tarjeta.cupo'] = money(Math.max(0, tv.limite - tv.saldo)); }
    if (pv) { valores['prestamo.cuota'] = money(pv.cuota); valores['prestamo.vence'] = pv.vence; valores['prestamo.n'] = String(pv.n); valores['prestamo.de'] = String(pv.de); }
    if (inversiones[0]) { valores['deposito.monto'] = money(inversiones[0].saldo); }
    var out = { id: id, nombre: u.nombre, primerNombre: u.nombre.split(' ')[0], tipo: u.tipo, ciudad: u.ciudad, necesita: u.lo_que_necesita, cuentas: cuentas, tarjetas: tarjetas, prestamos: prestamos, hipoteca: hip, inversiones: inversiones, metas: metas, cobrar: cobrar,
      contactos: contactos, exterior: exterior, deuna: deuna, recargas: recargasL, domiciliados: domiciliados, recurrentes: recurrentes, favoritos: favoritos, servicios: servicios, atajosSugeridos: sugeridos, paraTi: paraTi.slice(0, 5), valores: valores, movimientos: mov.length };
    cache[id] = out;
    return out;
  }
  function datos() { return base && actual ? derivar(actual) : null; }
  var api = { cargar: cargar, lista: lista, set: set, get: get, datos: datos, money: money };
  window.DemoPersona = api;
})();
