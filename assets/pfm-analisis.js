/* =====================================================================
   Análisis en el front de los movimientos (Mis finanzas)

   Los datos de las personas de demo (assets/pfm/datos.json) traen cada
   movimiento ya etiquetado a mano (tratamiento, categoría, escenario y
   nota) y un catálogo de escenarios con lo que el PFM debería hacer.
   Esas etiquetas se conservan como referencia, pero no hacen falta: este
   módulo las deduce del movimiento crudo (fecha, fuente, producto,
   descripción, contraparte y monto), así una persona nueva o un mes nuevo
   funcionan sin escribir nada.

   - movimiento(r, ctx): reglas por movimiento: quién es la contraparte
     (tú, una persona, una empresa, un comercio), qué producto es y qué
     dice la descripción.
   - analizar(rows, ctx): lo anterior más los patrones de la serie:
     recurrencias por contraparte (mesadas, arriendo, aportes), reembolsos
     que llegan poco después de pagar una cuenta, préstamos que van y
     vuelven, pagos mínimos de tarjetas, recargas de Deuna, impuestos del
     exterior, sueldo quincenal, etc. Devuelve { t, c, e, n, por } por
     movimiento (por = cómo se dedujo).
   - escenarios(rows, ctx, catalogo): qué escenarios del catálogo aplican a
     la persona, con la evidencia y la recomendación del catálogo.
   - comparar(rows, inferido): cuánto coincide con lo etiquetado a mano.
   ===================================================================== */
(function (root) {
  'use strict';

  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var mes = function (f) { return String(f).slice(0, 7); };
  var dias = function (a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); };
  var mediana = function (v) { var s = v.slice().sort(function (a, b) { return a - b; }); return s.length ? s[Math.floor(s.length / 2)] : 0; };

  /* ---------- Comercios: palabras clave → categoría ---------- */
  var COMERCIO = [
    ['Servicios financieros y deudas', /interes de financiamiento|comision|cooperativa|creditos economicos|artefacta|la ganga|^pago por servicio de (de prati|etafashion)/],
    ['Vivienda', /hipotec|arriendo|alicuota|condominio/],
    ['Restaurantes', /kfc|menestras|sushi|encebollad|cafeteria|almuerzo|pizz|hornero|burger|mcdonald|rappi|uber eats|china xpress|chifa|el espanol|restaurant|picanteria|asadero|sweet corner|heladeria|pollos/],
    ['Alimentación', /\btia\b|comisariato|supermaxi|megamaxi|coral|\baki\b|santa maria|tuti|tienda|fruteria|mercado|panaderia|minimarket|despensa|hipermercado|carniceria|viveres/],
    ['Entretenimiento', /cinemark|supercines|spotify|netflix|youtube|disney|hbo|prime video|ticketshow|\bbar\b|karaoke|steam|playstation|servicios? digi|google one|icloud|apple\.com/],
    ['Salud', /farmacia|fybeca|sana sana|medicity|cruz azul|clinica|hospital|laboratorio|consultorio|odontolog|medic/],
    ['Transporte', /petroecuador|primax|gasolinera|\buber\b|indrive|cabify|metrovia|\bmetro\b|peaje|taxi|\bbus\b/],
    ['Hogar', /pycca|kywi|almacenes japon|ferreteria|sukasa|todohogar/],
    ['Gobierno e impuestos', /municipio|\bamt\b|\bant\b|registro civil|predial|matricula vehicular/],
    ['Educación', /universidad|\bu\.?e\.? |unidad educativa|colegio|escuela|libreria|matricula/],
    ['Servicios básicos', /\beeq\b|empresa electrica|centrosur|cnel|epmaps|etapa|agua potable|netlife|\bcnt\b|claro|movistar|tuenti|internet|tv cable|directv/],
    ['Compras personales', /shein|temu|de prati|etafashion|amazon|consumos exterior|\brm\b|tommy|zara|marathon|aliexpress/]
  ];
  function comercio(texto) {
    var t = norm(texto);
    for (var i = 0; i < COMERCIO.length; i++) if (COMERCIO[i][1].test(t)) return COMERCIO[i][0];
    return null;
  }
  var EMPRESA = /\b(s\.?a\.?s?\.?|cia\.?|ltda|hnos\.?|distribuidora|universidad|cooperativa|banco|estudio|comercial|agencia|empresa|corporacion|fundacion)\b/;
  var esEmpresa = function (cp) { return EMPRESA.test(norm(cp)); };
  var esTu = function (cp) { return /^tu\b/.test(norm(cp)); };
  // Apellidos de la persona (todo menos el primer nombre) para reconocer a la familia
  function apellidos(nombre) { return norm(nombre).split(/\s+/).slice(1).filter(function (w) { return w.length > 2; }); }
  function familia(cp, ctx) {
    var a = ctx && ctx.apellidos || []; if (!a.length) return false;
    var w = norm(cp).replace(/\(.*\)/, '').split(/\s+/).slice(1);
    return w.some(function (x) { return a.indexOf(x) >= 0; });
  }

  /* ---------- Reglas por movimiento ---------- */
  function movimiento(r, ctx) {
    var d = norm(r.desc), cp = r.cp || '', pos = r.m > 0, cat;
    var o = function (t, c, por, e, n) { return { t: t, c: c, e: e || '', n: n || '', por: por }; };
    // Impuestos de consumos en el exterior (en la cuenta o en la tarjeta): van con el consumo que los generó
    if (/^sri$/.test(norm(cp)) || /\bisd\b|retencion iva/.test(d)) {
      cat = comercio(d.replace(/retencion|impuesto|iva|isd/g, '')) || 'Entretenimiento';
      return pos ? o('Reembolso', cat, 'El SRI devuelve un impuesto: resta del gasto que lo generó', 'Impuestos a consumos en el exterior', 'Devuelve el ISD retenido: se cancela con la retención')
        : o('Gasto', cat, 'Impuesto de un consumo en el exterior: va con su consumo', 'Impuestos a consumos en el exterior');
    }
    if (r.prod === 'Tarjeta de otro banco') return o('Fuera del MVP', comercio(d + ' ' + cp) || 'Compras personales', 'Es una tarjeta de otro banco: el PFM ve el consumo, pero no lo paga Pichibank');
    if (r.prod === 'Deuna') {
      if (/recarga de saldo/.test(d)) return o('Excluido', 'Recarga Deuna', 'Recarga desde tu cuenta: ya contó al salir de la cuenta', '', 'No suma: la recarga ya contó');
      if (esTu(cp)) return o('Excluido', 'Entre cuentas propias', 'Pasa de tu Deuna a tu cuenta');
      if (/cobro qr/.test(d)) return o('Detalle Deuna', 'Ventas del negocio', 'Cobro con QR a un cliente', '', 'No suma: el ingreso cuenta al pasar a la cuenta');
      if (/pago a persona/.test(d)) return o('Detalle Deuna', 'Transferencia a persona', 'Pago con Deuna a una persona');
      if (/recibida/.test(d)) return o('Detalle Deuna', 'Ingreso de persona', 'Te enviaron por Deuna');
      return o('Detalle Deuna', comercio(d + ' ' + cp) || 'Compras personales', 'Pago con Deuna en un comercio');
    }
    if (r.prod === 'Tarjeta de crédito') {
      if (pos && (esTu(cp) || /su pago/.test(d))) return o('Excluido', 'Pago de tarjeta', 'Abono a tu tarjeta: el gasto ya contó al consumir');
      if (/interes de financiamiento/.test(d)) return o('Gasto', 'Servicios financieros y deudas', 'Interés de la tarjeta');
      return o('Gasto', comercio(d + ' ' + cp) || 'Compras personales', 'Consumo con tu tarjeta');
    }
    // Cuenta
    if (esTu(cp)) {
      if (/tarjeta/.test(d) && /pago/.test(d)) return o('Excluido', 'Pago de tarjeta', 'Pago de tu tarjeta Pichibank: el gasto ya contó al consumir');
      if (/ahorro prog|hacia cuenta|acreditacion por ahorro/.test(d)) return o('Excluido', 'Ahorro programado', 'Movimiento de tu ahorro programado');
      if (/deuna a /.test(d) && !pos) return o('Gasto', 'Pagos con Deuna', 'Recarga a tu Deuna: aquí se cuenta el gasto', '', 'Recarga del mismo monto que el pago; el detalle está en Deuna');
      if (pos && (/deuna de /.test(d) || /deposito en efectivo/.test(d))) return o('Ingreso', 'Ingresos del negocio', 'Pasas a la cuenta lo que vendiste');
      return o('Excluido', 'Entre cuentas propias', 'Entre tus cuentas');
    }
    if (pos && /nomina|decimo|sueldo/.test(d)) return o('Ingreso', 'Sueldo', 'Pago de nómina');
    if (pos && /iess|pension|jubilacion/.test(d + ' ' + norm(cp))) return o('Ingreso', 'Pensión', 'Pensión del IESS');
    if (pos && /interes acreditado/.test(d)) return o('Ingreso', 'Intereses', 'Intereses que te paga el banco');
    if (pos && /internacional/.test(d)) return o('Ingreso', 'Remesa', 'Llega del exterior', 'Remesa recibida');
    if (/^ret(iro|sintj)/.test(d)) return o('Gasto', 'Efectivo retirado', 'Retiro de efectivo');
    if (/comision/.test(d)) return o('Gasto', 'Servicios financieros y deudas', 'Comisión del banco');
    if (/hipotec/.test(d)) return o('Gasto', 'Vivienda', 'Cuota de tu hipoteca', 'Hipoteca');
    if (/pago tarjeta|tarjeta interbancaria/.test(d)) return o('Gasto', 'Tarjetas de otros bancos (sin detalle)', 'Pago de una tarjeta de otro banco: no se ve en qué la usaste', 'Tarjetas de varios bancos');
    if (/consumo internacional|consumo tarjeta debito|pago por servicio|debito automatico/.test(d)) return o('Gasto', comercio(d + ' ' + cp) || 'Servicios básicos', 'Pago a un comercio o servicio');
    if (/transf|transferencia/.test(d)) {
      if (pos) return o('Por revisar', 'Ingreso de persona', 'Te transfirió alguien: Uku te pregunta qué fue');
      if (esEmpresa(cp)) {
        cat = comercio(cp);
        if (cat) return o('Gasto', cat, 'Transferencia a ' + cp);
        return o('Por revisar', 'Pago a empresa', 'Transferencia a una empresa: Uku te pregunta para qué fue');
      }
      return o('Por revisar', 'Transferencia a persona', 'Transferiste a una persona: Uku te pregunta qué fue');
    }
    return o(pos ? 'Ingreso' : 'Gasto', comercio(d + ' ' + cp) || (pos ? 'Ingreso de persona' : 'Compras personales'), 'Por la descripción');
  }

  /* ---------- Patrones de la serie ---------- */
  function analizar(rows, ctx) {
    ctx = ctx || {};
    ctx.apellidos = ctx.apellidos || apellidos(ctx.nombre);
    var out = rows.map(function (r) { return movimiento(r, ctx); });
    var idx = rows.map(function (_, i) { return i; }).sort(function (a, b) { return (rows[a].f + rows[a].h).localeCompare(rows[b].f + rows[b].h); });
    var X = function (i, t, c, e, n, por) { var o = out[i]; if (t) o.t = t; if (c) o.c = c; if (e != null) o.e = e; if (n != null) o.n = n; if (por) o.por = por; };

    // Por contraparte: cuántos meses, cuánto y si va y vuelve
    var by = {};
    idx.forEach(function (i) { var r = rows[i]; if (r.prod === 'Cuenta' || r.prod === 'Deuna') { var k = norm(r.cp).replace(/\s*\(.*\)/, ''); (by[k] || (by[k] = [])).push(i); } });

    // Arriendo: lo que sale cada mes a una persona por un monto grande; los que te devuelven su parte, reembolsos
    var arriendo = null;
    Object.keys(by).forEach(function (k) {
      var L = by[k].filter(function (i) { return rows[i].m < 0 && out[i].t === 'Por revisar' && out[i].c === 'Transferencia a persona'; });
      var ms = {}; L.forEach(function (i) { ms[mes(rows[i].f)] = 1; });
      if (!L.length) return;
      var n = Object.keys(ms).length, med = mediana(L.map(function (i) { return -rows[i].m; }));
      var vuelve = by[k].some(function (i) { return rows[i].m > 0; }); // si también te manda dinero, es un préstamo, no una mesada
      if (familia(rows[L[0]].cp, ctx) && n >= 3 && !vuelve) {
        var fijo = L.every(function (i) { return Math.abs(-rows[i].m - med) < med * .1; }); // con monto variable, Uku pregunta
        if (fijo) L.forEach(function (i) { X(i, 'Gasto', 'Familia y dependientes', 'Apoyo a padres', 'Comparte apellido; cada mes, monto parecido', 'Comparte tu apellido y le envías cada mes un monto parecido: es apoyo a tu familia'); });
      } else if (!familia(rows[L[0]].cp, ctx) && n >= 3 && med >= 150 && L.every(function (i) { return +rows[i].f.slice(8) <= 6; })) {
        arriendo = { cp: k, monto: med };
        L.forEach(function (i) { X(i, 'Gasto', 'Vivienda', 'Arriendo compartido', 'Paga el arriendo completo', 'Cada inicio de mes, el mismo monto grande a la misma persona: es tu arriendo'); });
      }
    });
    if (arriendo) {
      // los que te mandan cada mes su parte justo después de que pagas el arriendo
      Object.keys(by).forEach(function (k) {
        var A0 = by[k].filter(function (i) { return rows[i].m > 0 && (out[i].c === 'Ingreso de persona') && +rows[i].f.slice(8) <= 10; });
        var med = mediana(A0.map(function (i) { return rows[i].m; }));
        var L = A0.filter(function (i) { return Math.abs(rows[i].m - med) < med * .15; });
        var ms = {}; L.forEach(function (i) { ms[mes(rows[i].f)] = 1; });
        if (Object.keys(ms).length < 3 || med > arriendo.monto * .6) return;
        L.forEach(function (i) { if (out[i].t === 'Detalle Deuna') X(i, null, null, 'Arriendo compartido', 'Le devuelven su parte del arriendo', 'Te devuelve su parte del arriendo');
          else X(i, 'Reembolso', 'Vivienda', 'Arriendo compartido', 'Reembolso: resta del gasto de Vivienda', 'Te devuelve su parte del arriendo: resta de tu gasto en Vivienda'); });
      });
    }

    // Cuenta dividida: alguien te transfiere poco después de que pagaste en un restaurante (y le toca menos que el total)
    var comidas = idx.filter(function (i) { return rows[i].m < 0 && out[i].c === 'Restaurantes' && out[i].t === 'Gasto'; });
    idx.forEach(function (i) {
      var r = rows[i];
      if (!(r.m > 0 && r.prod === 'Cuenta' && out[i].t === 'Por revisar')) return;
      var p = comidas.filter(function (j) { var g = rows[j]; return g.f === r.f && g.h <= r.h && -g.m > r.m * 1.4; }).pop(); // el mismo día, poco después
      var q = p == null && comidas.filter(function (j) { var g = rows[j]; return g.f < r.f && dias(g.f, r.f) <= 3 && -g.m > r.m * 1.4 && r.m < 30; }).pop();
      if (q != null && q !== false) X(i, null, null, 'Cuenta dividida', 'Llegó días después de un pago en ' + rows[q].cp + ': ¿te devolvió su parte?', 'Llegó días después de que pagaste en ' + rows[q].cp + ': Uku te pregunta si fue su parte');
      if (p != null) X(i, 'Reembolso', 'Restaurantes', 'Cuenta dividida', 'Reembolso detectado: llegó poco después del pago en ' + rows[p].cp + '; resta del gasto', 'Llegó poco después de que pagaste en ' + rows[p].cp + ': te devolvieron su parte');
    });
    // Un reembolso de un gasto puntual que compartiste (p. ej. dos entradas): resta de esa categoría
    idx.forEach(function (i) {
      var r = rows[i];
      if (!(r.m > 0 && out[i].t === 'Por revisar' && r.prod === 'Cuenta')) return;
      var p = idx.filter(function (j) { var g = rows[j]; return g.m < 0 && out[j].t === 'Gasto' && g.prod === 'Tarjeta de crédito' && g.f <= r.f && dias(g.f, r.f) <= 4 && Math.abs(-g.m / 2 - r.m) < .5; }).pop();
      if (p != null) X(i, 'Reembolso', out[p].c, 'Préstamo a amigo', 'Reembolso: resta del gasto de ' + out[p].c, 'Es la mitad exacta de un consumo de hace unos días: te devolvieron su parte');
    });

    // Aportes, préstamos y trabajos: según cómo van y vienen las transferencias con cada contraparte
    Object.keys(by).forEach(function (k) {
      var L = by[k].filter(function (i) { return out[i].t === 'Por revisar' || (out[i].t === 'Detalle Deuna' && /persona/.test(out[i].c)); });
      if (!L.length) return;
      var cp = rows[L[0]].cp, ent = L.filter(function (i) { return rows[i].m > 0; }), sal = L.filter(function (i) { return rows[i].m < 0; });
      var msE = {}; ent.forEach(function (i) { msE[mes(rows[i].f)] = 1; });
      var fam = familia(cp, ctx), emp = esEmpresa(cp);
      if (emp && sal.length && !ent.length) { sal.forEach(function (i) { X(i, null, null, 'Negocio y personal mezclados', 'Mercadería o servicio para el negocio', 'Pagas a una empresa con frecuencia: puede ser de tu negocio'); }); return; }
      if (emp && ent.length) { ent.forEach(function (i) { X(i, null, null, 'Ingresos freelance', 'Trabajo extra; sugerir "Ingreso freelance"', 'Una empresa te paga sin ser tu sueldo: parece un trabajo extra'); }); return; }
      // Préstamo: primero sale (o entra) un monto y después vuelve en partes
      var primero = L[0], r0 = rows[primero];
      if (sal.length && ent.length) {
        if (r0.m < 0) L.forEach(function (i) { X(i, null, null, fam ? 'Préstamo a familiar' : 'Préstamo a amigo', rows[i].m < 0 ? 'Prestó dinero' : 'Devolución del préstamo', rows[i].m < 0 ? 'Le enviaste y después te devolvió: parece un préstamo' : 'Te devuelve lo que le prestaste'); });
        else L.forEach(function (i) { X(i, null, null, 'Préstamo de familiar', rows[i].m > 0 ? 'Era un préstamo: no es ingreso. Sugerir "Préstamo recibido"' : 'Devolución del préstamo: deuda informal', rows[i].m > 0 ? 'Te envió un monto grande y luego le pagas en partes: parece un préstamo que recibiste' : 'Le devuelves en partes lo que te prestó'); });
        return;
      }
      if (ent.length && Object.keys(msE).length >= 3 && !fam) {
        var med = mediana(ent.map(function (i) { return rows[i].m; }));
        if (ent.every(function (i) { return Math.abs(rows[i].m - med) < med * .2; }) && ent.every(function (i) { return out[i].t === 'Por revisar'; })) {
          ent.forEach(function (i) { X(i, null, null, 'Aporte de pareja', 'Llega cada mes; sugerir "Aporte del hogar"', 'Te llega cada mes un monto parecido de la misma persona: parece un aporte al hogar'); });
          return;
        }
      }
      if (fam && sal.length) sal.forEach(function (i) { X(i, null, null, 'Apoyo a padres', 'Comparte apellido', 'Comparte tu apellido: puede ser apoyo a tu familia'); });
      if (!fam && sal.length === 1 && !ent.length && -rows[sal[0]].m >= 100) X(sal[0], null, null, 'Préstamo a vecina', 'Préstamo informal; el banco no ve la devolución', 'Un monto redondo a alguien que no es de tu familia: puede ser un préstamo');
    });

    // Tarjetas de otros bancos: si lo que pagas es bastante menos que lo que se ve consumido en esa tarjeta, es el pago mínimo
    var pagos = {}, vistos = {};
    idx.forEach(function (i) { if (out[i].c === 'Tarjetas de otros bancos (sin detalle)') { var k = norm(rows[i].cp).replace(/^banco /, ''); (pagos[k] || (pagos[k] = [])).push(i); } });
    idx.forEach(function (i) { if (rows[i].prod === 'Tarjeta de otro banco' && rows[i].m < 0) { var s = norm(rows[i].src); Object.keys(pagos).forEach(function (k) { if (s.indexOf(k.split(' ')[0]) >= 0) vistos[k] = (vistos[k] || 0) - rows[i].m; }); } });
    Object.keys(pagos).forEach(function (k) {
      var L = pagos[k], pagado = L.reduce(function (a, i) { return a - rows[i].m; }, 0), v = L.map(function (i) { return -rows[i].m; });
      var deuda = (ctx.deudas || []).filter(function (x) { return x.clase === 'tarjeta' && norm(x.institucion).indexOf(k.split(' ')[0]) >= 0; })[0];
      var minimo = (vistos[k] && pagado < vistos[k] * .7) || (deuda && deuda.saldo > mediana(v) * 4) || (!vistos[k] && !deuda && mediana(v) < 60 && v.every(function (x) { return x < 80; }));
      L.forEach(function (i) { X(i, null, null, 'Tarjetas de varios bancos', minimo ? 'Pago mínimo; la tarjeta va acumulando saldo' : 'Paga el total; el PFM no ve en qué', null); });
    });
    // Tu tarjeta Pichibank: si el abono es mucho menos que lo consumido el mes anterior y después llega un interés, pagaste el mínimo
    var consumo = {}, interes = idx.filter(function (i) { return rows[i].prod === 'Tarjeta de crédito' && /interes de financiamiento/.test(norm(rows[i].desc)); });
    idx.forEach(function (i) { var r = rows[i]; if (r.prod === 'Tarjeta de crédito' && out[i].t === 'Gasto' && !/interes/.test(norm(r.desc))) consumo[mes(r.f)] = (consumo[mes(r.f)] || 0) - r.m; });
    idx.forEach(function (i) {
      var r = rows[i]; if (out[i].c !== 'Pago de tarjeta') return;
      var ant = new Date(Date.parse(r.f.slice(0, 7) + '-15') - 30 * 864e5).toISOString().slice(0, 7), debe = (consumo[ant] || 0) + (consumo[mes(r.f)] || 0) * .5, v = Math.abs(r.m);
      var cobra = interes.filter(function (j) { var g = dias(r.f, rows[j].f); return g >= 0 && g <= 12; });
      if (!cobra.length || v > debe * .6) return;
      // el mínimo es un abono chico que se repite; uno suelto es un pago parcial
      var repite = idx.filter(function (j) { return j !== i && out[j].c === 'Pago de tarjeta' && rows[j].prod === r.prod && Math.abs(Math.abs(rows[j].m) - v) < 3; }).length >= 1;
      if (v <= 30 && repite) { X(i, null, null, null, 'Pagó el mínimo', 'Abonaste muy poco (lo mismo que otros meses) y después llegó un interés: pagaste el mínimo'); cobra.forEach(function (j) { X(j, null, null, null, 'Interés por pagar solo el mínimo', 'Es el interés por haber pagado solo el mínimo'); }); }
      else if (r.prod === 'Cuenta') { X(i, null, null, null, 'Pago parcial: empieza a pagar intereses', 'Pagaste menos de lo consumido y después llegó un interés'); cobra.forEach(function (j) { X(j, null, null, null, 'Interés por pago parcial', 'Es el interés por no pagar el total'); }); }
    });
    // Recarga de Deuna para pagar una cuota: va con la cuota (el mismo monto, el mismo día o el siguiente)
    idx.forEach(function (i) {
      if (out[i].c !== 'Pagos con Deuna') return;
      var q = idx.filter(function (j) { return rows[j].prod === 'Deuna' && out[j].c === 'Servicios financieros y deudas' && Math.abs(rows[j].m - rows[i].m) < .01 && Math.abs(dias(rows[i].f, rows[j].f)) <= 1; })[0];
      if (q != null) X(i, null, 'Servicios financieros y deudas', null, null, 'Recargaste Deuna para pagar una cuota: cuenta como deuda');
    });
    // Recargas de Deuna: la recarga y el pago son el mismo dinero; se cuenta una vez
    var hayRecarga = out.some(function (o) { return o.c === 'Recarga Deuna'; });
    if (hayRecarga) out.forEach(function (o, i) { if (/Recarga Deuna|Pagos con Deuna/.test(o.c) || (o.t === 'Detalle Deuna' && rows[i].m < 0 && !o.e)) o.e = o.e || 'Deuna con recarga'; });
    // Negocio: cobros con QR de clientes
    var ventas = out.filter(function (o) { return o.c === 'Ventas del negocio'; }).length;
    if (ventas >= 10) out.forEach(function (o) { if (/Ventas del negocio|Ingresos del negocio/.test(o.c)) o.e = 'Negocio y personal mezclados'; });
    // Efectivo: si una buena parte de lo que gastas sale en efectivo, es «vida en efectivo»
    var gasto = 0, efectivo = 0;
    out.forEach(function (o, i) { if (o.t === 'Gasto') { gasto -= rows[i].m; if (o.c === 'Efectivo retirado') efectivo -= rows[i].m; } });
    out.forEach(function (o) { if (o.c === 'Efectivo retirado') o.e = efectivo > gasto * .2 ? 'Vida en efectivo' : 'Efectivo'; });
    // Sueldo: quincenal si llegan dos por mes; décimos aparte
    var sueldos = {}; idx.forEach(function (i) { if (out[i].c === 'Sueldo' && !/decimo/.test(norm(rows[i].desc))) sueldos[mes(rows[i].f)] = (sueldos[mes(rows[i].f)] || 0) + 1; });
    var quincena = mediana(Object.keys(sueldos).map(function (k) { return sueldos[k]; })) >= 2;
    idx.forEach(function (i) { if (out[i].c === 'Sueldo') out[i].e = /decimo/.test(norm(rows[i].desc)) ? 'Décimos' : quincena ? 'Sueldo quincenal' : 'Sueldo mensual'; });
    // Crédito directo en casas comerciales y deudas en otras entidades
    out.forEach(function (o, i) { var t = norm(rows[i].desc + ' ' + rows[i].cp); if (o.c === 'Servicios financieros y deudas' && /de prati|etafashion|creditos economicos|artefacta|la ganga|cuota diferid/.test(t)) o.e = 'Crédito directo en casa comercial'; else if (o.c === 'Servicios financieros y deudas' && /cooperativa|banco/.test(t) && !/comision/.test(t)) o.e = 'Deuda en otra entidad'; });
    // Cuenta conjunta: el banco sabe quién pagó
    out.forEach(function (o, i) { if (/conjunta/.test(norm(rows[i].src))) { o.e = o.e || 'Cuenta conjunta'; } });
    // Gastos fijos: el mismo servicio cada mes
    var serv = {}; idx.forEach(function (i) { if (out[i].c === 'Servicios básicos' && rows[i].prod === 'Cuenta') { var k = norm(rows[i].cp); (serv[k] || (serv[k] = {}))[mes(rows[i].f)] = 1; } });
    idx.forEach(function (i) { if (out[i].c === 'Servicios básicos' && rows[i].prod === 'Cuenta' && Object.keys(serv[norm(rows[i].cp)] || {}).length >= 3) out[i].e = out[i].e || 'Gasto fijo'; });
    // Educación de una vez al año (matrícula)
    var edu = {}; idx.forEach(function (i) { if (out[i].c === 'Educación') { var k = norm(rows[i].cp); (edu[k] || (edu[k] = [])).push(i); } });
    Object.keys(edu).forEach(function (k) { var L = edu[k]; if (L.length <= 2) L.forEach(function (i) { if (-rows[i].m >= 150) out[i].e = 'Matrícula escolar'; }); });
    // Gastos de una vez al año (predial, matrícula del auto): conviene recordarlos y repartirlos
    var una = {}; idx.forEach(function (i) { if (out[i].c === 'Gobierno e impuestos' && rows[i].m < 0) { var k = norm(rows[i].cp); (una[k] || (una[k] = [])).push(i); } });
    Object.keys(una).forEach(function (k) { if (una[k].length === 1 && -rows[una[k][0]].m >= 50) out[una[k][0]].e = 'Gastos anuales'; });
    // Estudios de un familiar (comparte tu apellido): p. ej. la universidad de un nieto
    idx.forEach(function (i) { if (out[i].c === 'Educación' && familia('x ' + rows[i].desc.replace(/^.*?(?=[A-ZÁÉÍÓÚ][a-záéíóú]+ [A-ZÁÉÍÓÚ][a-záéíóú]+$)/, ''), ctx)) out[i].e = ctx.edad >= 55 ? 'Gastos de un nieto' : 'Estudios de un familiar'; });
    // Tarjeta Pichibank (o la primera, si la persona es joven y tiene una sola)
    var tarjetas = {}; rows.forEach(function (r) { if (r.prod === 'Tarjeta de crédito') tarjetas[r.src] = 1; });
    var primera = ctx.edad && ctx.edad < 26 && Object.keys(tarjetas).length === 1;
    out.forEach(function (o, i) { if (!o.e && (rows[i].prod === 'Tarjeta de crédito' || (o.c === 'Pago de tarjeta'))) o.e = primera ? 'Primera tarjeta' : 'Tarjeta Pichibank'; });
    return out;
  }

  /* ---------- Escenarios de la persona ----------
     Un escenario del catálogo aplica si aparece en sus movimientos (con evidencia) o en sus deudas. */
  var DE_DEUDAS = {
    'Hipoteca': function (D) { return D.filter(function (x) { return x.clase === 'hipoteca' && x.institucion === 'Pichibank' && x.saldo > 0; }); },
    'Descuento en la pensión': function (D, rows, out) { return out.some(function (o) { return o.c === 'Pensión'; }) ? D.filter(function (x) { return x.clase === 'hipoteca' && /biess/i.test(x.institucion); }) : []; },
    'Crédito directo en casa comercial': function (D) { return D.filter(function (x) { return /de prati|etafashion|creditos economicos|artefacta|la ganga/i.test(x.producto + ' ' + x.institucion); }); },
    'Préstamo a vecina': function (D) { return D.filter(function (x) { return x.saldo < 0 && /vecin/i.test(x.producto); }); },
    'Préstamo a familiar': function (D) { return D.filter(function (x) { return x.saldo < 0 && /hij|herman|mam|pap|famil/i.test(x.producto); }); },
    'Préstamo a amigo': function (D) { return D.filter(function (x) { return x.saldo < 0 && /amig/i.test(x.producto); }); },
    'Préstamo de familiar': function (D) { return D.filter(function (x) { return x.clase === 'prestamo' && /herman|famil|mam|pap/i.test(x.producto); }); }
  };
  // Escenarios con nombre distinto en los movimientos y en el catálogo
  var ALIAS = { 'Décimos': 'Décimos y matrícula escolar', 'Matrícula escolar': 'Décimos y matrícula escolar' };
  function escenarios(rows, ctx, catalogo, out) {
    out = out || analizar(rows, ctx);
    var D = (ctx && ctx.deudas) || [], hay = {};
    out.forEach(function (o, i) { if (!o.e) return; var k = ALIAS[o.e] || o.e; (hay[k] || (hay[k] = [])).push(i); });
    return (catalogo || []).map(function (c) {
      var mov = hay[c.escenario] || [], deu = DE_DEUDAS[c.escenario] ? DE_DEUDAS[c.escenario](D, rows, out) : [];
      if (!mov.length && !deu.length) return null;
      var ej = mov.length ? rows[mov[mov.length - 1]] : null;
      return { escenario: c.escenario, recomendacion: c.pfm_deberia, riesgo: c.riesgo, fase: c.fase, movimientos: mov.length, deudas: deu.length,
        evidencia: mov.length ? mov.length + (mov.length === 1 ? ' movimiento' : ' movimientos') + (ej ? ' · p. ej. ' + ej.desc + ' (' + ej.f + ')' : '') : deu.map(function (x) { return x.producto; }).join(', ') };
    }).filter(Boolean);
  }

  /* ---------- Cuánto coincide con lo etiquetado a mano ---------- */
  function comparar(rows, out) {
    var n = 0, t = 0, c = 0, rev = 0, revOk = 0, min = 0, minOk = 0, dif = [];
    rows.forEach(function (r, i) {
      if (r.t == null) return;
      n++; var o = out[i];
      if (o.t === r.t) t++;
      if (o.c === r.c) c++;
      if (o.t !== r.t || o.c !== r.c) dif.push({ r: r, o: o });
      if (r.t === 'Por revisar') { rev++; if (o.e === r.e) revOk++; }
      var mr = /m[ií]nimo/i.test(r.n || ''), mo = /m[ií]nimo/i.test(o.n || '');
      if (mr || mo) { min++; if (mr === mo) minOk++; }
    });
    var pct = function (a, b) { return b ? Math.round(a / b * 1000) / 10 : 100; };
    return { n: n, tratamiento: pct(t, n), categoria: pct(c, n), porRevisar: pct(revOk, rev), minimo: pct(minOk, min), diferencias: dif };
  }

  var api = { movimiento: movimiento, analizar: analizar, escenarios: escenarios, comparar: comparar, comercio: comercio, norm: norm };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PFMAnalisis = api;
})(typeof window !== 'undefined' ? window : globalThis);
