/* =====================================================================
   Soporte con Uku
   Lo primero es autogestión: Uku responde las dudas de siempre (fecha de
   corte, cómo cancelo un producto, un consumo que no reconozco...) con
   TUS datos y te lleva al lugar de la app donde lo resuelves. Un asesor
   queda solo para trámites que no se pueden hacer en la app; si hace
   falta, Uku le pasa el caso con un resumen. Todo es simulado.
   ===================================================================== */
(function () {
  'use strict';

  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function face() { return window.Asistente ? Asistente.faceIMG() : ''; }
  function uku() { return (window.Asistente && Asistente.name && Asistente.name()) || 'Uku'; }
  function firstName() { var n = document.querySelector('.profile-head__name'); return n ? n.textContent.trim().split(' ')[0] : ''; }

  var CASE = '#48213', PHONE = '1700 742 424', AGENT = { name: 'Andrea Ruiz', ini: 'AR' };
  /* Datos de la persona para responder con lo suyo (no textos genéricos) */
  function money(v) { var x = Math.abs(v).toFixed(2).split('.'); return '$ ' + x[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + x[1]; }
  function card() {
    var d = window.Asistente && Asistente.data && Asistente.data(), c = d && d.card;
    return c ? { owed: c.owed, min: Math.max(25, c.owed * .05), avail: c.limit - c.owed } : { owed: 0, min: 0, avail: 5000 };
  }
  /* Ayudas frecuentes: respuesta con tus datos + botones al lugar donde
     lo haces tú mismo. */
  var FAQ = [
    { icon: 'event', cat: 'tarjetas', t: '¿Cuándo es mi fecha de corte y de pago?', k: 'fecha corte pago tarjeta cuando pago vence vencimiento minimo estado de cuenta',
      a: function () { var c = card(); return 'Tu Mastercard Black corta el 25 de cada mes y la fecha máxima de pago es el 10 del mes siguiente. Hoy debes ' + money(c.owed) + ' y el pago mínimo es ' + money(c.min) + '. Si pagas el total, no te cobran intereses.'; },
      acts: [['Pagar tarjeta', 'do:Pagar tarjeta'], ['Ver mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'report', cat: 'reclamos', t: 'No reconozco un consumo', k: 'no reconozco consumo cobro cargo raro fraude desconocido debito doble dos veces cobraron',
      a: 'Primero revisa la fecha y la hora del consumo y si puede ser una suscripción o un cobro que llega con días de retraso. Si no es tuyo, bloquea la tarjeta y pide la revisión desde aquí: eliges el consumo y nos cuentas qué pasó. Un reclamo nacional se resuelve en hasta 15 días hábiles y, mientras tanto, ese monto no te genera intereses.',
      acts: [['Solicitar revisión', 'review'], ['Bloquear mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'cancel', cat: 'app', t: '¿Cómo cancelo un producto?', k: 'cancelar cerrar cuenta tarjeta seguro producto dar de baja anular',
      a: 'Cuentas, tarjetas y seguros se cancelan desde la app: entra al producto › Más › Cancelar producto. Antes revisa que no tenga saldo ni deudas pendientes. ¿Cuál quieres cancelar?',
      acts: [['Cuenta Corriente', 'do:Cuenta Corriente'], ['Mastercard Black', 'card:Mastercard Black'], ['Seguro de vida', 'do:Seguro de vida']] },
    { icon: 'credit_card_off', cat: 'tarjetas', t: 'Perdí mi tarjeta o me la robaron', k: 'perdi perdida robaron robo bloquear tarjeta extravie extravio',
      a: 'Bloquéala ahora para que nadie la use: es inmediato y, si la encuentras, la desbloqueas. Si fue robo, desde el mismo lugar pides una nueva.',
      acts: [['Bloquear mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'trending_up', cat: 'tarjetas', t: 'Quiero subir el cupo de mi tarjeta', k: 'subir aumentar cupo limite tarjeta credito',
      a: function () { return 'Tienes ' + money(card().avail) + ' de cupo disponible. Puedes pedir un aumento en tu tarjeta › Límites; la respuesta llega en minutos.'; },
      acts: [['Ver mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'password', cat: 'seguridad', t: 'Olvidé mi clave', k: 'olvide clave contrasena password acceso entrar pin recuperar',
      a: 'En la pantalla de ingreso toca «¿Problemas para ingresar?» y elige «Olvidé mi contraseña». Te llega una contraseña temporal al correo registrado y la app te pide crear una nueva. Toma menos de 2 minutos.',
      acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'sync_alt', cat: 'cuentas', t: '¿Cuándo llega mi transferencia?', k: 'transferencia no llego llega demora interbancaria pendiente deposito cuando',
      a: 'Entre cuentas Pichibank y a un número de celular llega al instante. A otros bancos, hasta 24 horas hábiles si la hiciste después de las 15:00 o en fin de semana. El comprobante queda en tus movimientos.',
      acts: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL']] },
    { icon: 'description', cat: 'cuentas', t: 'Necesito un certificado bancario', k: 'certificado bancario referencia carta documento',
      a: 'Lo descargas al instante en PDF, firmado electrónicamente y sin costo.',
      acts: [['Pedir certificado', 'do:Certificado bancario']] },
    { icon: 'ac_unit', cat: 'tarjetas', t: '¿Cómo congelo mi tarjeta?', k: 'congelar pausar tarjeta temporal bloquear temporalmente',
      a: 'En tu tarjeta › Congelar. Es inmediato: nadie puede usarla hasta que la descongeles, y no tienes que pedir una nueva.', acts: [['Ver mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'flight', cat: 'tarjetas', t: 'Voy a viajar: ¿mi tarjeta funciona afuera?', k: 'viaje viajar exterior extranjero internacional compras fuera pais activar',
      a: 'Sí. En tu tarjeta › Límites activas las compras en el exterior y eliges las fechas del viaje.', acts: [['Ver mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'percent', cat: 'tarjetas', t: '¿Por qué me cobraron intereses?', k: 'intereses interes cobraron minimo pago parcial',
      a: 'Te cobran intereses cuando pagas menos que el total de tu estado de cuenta. Si pagas el total antes del 10, no pagas intereses.', acts: [['Pagar tarjeta', 'do:Pagar tarjeta']] },
    { icon: 'tag', cat: 'cuentas', t: '¿Cuál es mi número de cuenta?', k: 'numero de cuenta mis datos compartir recibir dinero',
      a: 'Tu cuenta PRINCIPAL termina en 7890. En Recibir dinero ves el número completo y lo compartes con un toque.', acts: [['Ver mis datos', 'do:Recibir dinero']] },
    { icon: 'speed', cat: 'cuentas', t: '¿Cuánto puedo transferir al día?', k: 'limite transferir maximo diario monto tope',
      a: 'Hasta $ 3.000 al día a otros bancos y hasta $ 10.000 entre cuentas Pichibank. Puedes cambiar tus límites en Seguridad.', acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'add_card', cat: 'cuentas', t: '¿Cómo abro una cuenta nueva?', k: 'abrir cuenta nueva ahorro corriente deuna',
      a: 'Desde la app en 5 minutos, solo con tu cédula. La cuenta queda lista para usar al instante.', acts: [['Abrir cuenta', 'do:Solicitar cuenta']] },
    { icon: 'bolt', cat: 'pagos', t: '¿Cómo pago la luz, el agua o el internet?', k: 'pagar luz agua internet servicios basicos planilla',
      a: 'En Pagar servicios eliges la empresa y escribes tu número de contrato. La próxima vez ya aparece guardada.', acts: [['Pagar servicios', 'do:Pagar servicios']] },
    { icon: 'autorenew', cat: 'pagos', t: '¿Cómo activo el pago automático?', k: 'pago automatico debito automatico domiciliar programar',
      a: 'En Pagar servicios › tu servicio › Pago automático. Se paga solo el día que vence y te avisamos antes.', acts: [['Pagar servicios', 'do:Pagar servicios']] },
    { icon: 'hourglass_top', cat: 'pagos', t: 'Pagué un servicio y no se refleja', k: 'pague servicio no se refleja no aparece comprobante pendiente',
      a: 'La empresa lo registra en hasta 24 horas. Tu comprobante está en tus movimientos por si te lo piden.', acts: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL']] },
    { icon: 'qr_code_scanner', cat: 'pagos', t: '¿Cómo pago con QR?', k: 'pagar qr codigo escanear tienda',
      a: 'Toca Pagar con QR, apunta la cámara al código del comercio y confirma el monto. No necesitas efectivo ni tarjeta.', acts: [['Pagar con QR', 'do:Pagar con QR']] },
    { icon: 'event', cat: 'prestamos', t: '¿Cuándo pago mi cuota del préstamo?', k: 'cuota prestamo cuando pago fecha vence credito',
      a: 'Tu préstamo de consumo vence el 20 de cada mes. La cuota es de $ 245,90 y vas en la 6 de 36.', acts: [['Ver mi préstamo', 'tab:Prestamos']] },
    { icon: 'fast_forward', cat: 'prestamos', t: '¿Puedo adelantar cuotas o pagar todo?', k: 'adelantar cuotas precancelar pagar todo abonar capital',
      a: 'Sí, sin penalidad. En tu préstamo › Abonar eliges si bajas la cuota o el plazo.', acts: [['Ver mi préstamo', 'tab:Prestamos']] },
    { icon: 'request_quote', cat: 'prestamos', t: '¿Tengo un crédito preaprobado?', k: 'preaprobado credito oferta prestamo nuevo pedir',
      a: 'Sí, tienes una oferta vigente. Simula la cuota sin compromiso; la aprobación final depende de una revisión.', acts: [['Simular mi crédito', 'do:Simular crédito preaprobado']] },
    { icon: 'savings', cat: 'inversiones', t: '¿Cuándo vence mi depósito a plazo?', k: 'deposito plazo vence vencimiento poliza inversion',
      a: 'Tu depósito a plazo de $ 3.000,00 vence el 12 de noviembre y rinde 7,25% al año.', acts: [['Ver mi inversión', 'tab:Inversiones']] },
    { icon: 'published_with_changes', cat: 'inversiones', t: '¿Qué pasa cuando vence mi depósito?', k: 'renovar deposito vence que pasa dinero vuelve',
      a: 'Puedes renovarlo antes del vencimiento. Si no lo renuevas, el dinero y lo que ganaste pasan a tu cuenta PRINCIPAL ese mismo día.', acts: [['Ver mi inversión', 'tab:Inversiones']] },
    { icon: 'health_and_safety', cat: 'seguros', t: '¿Qué cubre mi seguro de vida?', k: 'seguro vida cubre cobertura beneficiarios',
      a: 'Cubre fallecimiento e invalidez permanente. En el seguro ves el monto asegurado y puedes cambiar a tus beneficiarios.', acts: [['Ver mi seguro', 'do:Seguro de vida']] },
    { icon: 'assignment', cat: 'seguros', t: '¿Cómo hago un reclamo de mi seguro?', k: 'reclamo seguro siniestro usar seguro cobrar',
      a: 'Desde el seguro › Reclamar subes los documentos y sigues el estado. Si es por un fallecimiento, te atiende un asesor.', acts: [['Ver mi seguro', 'do:Seguro de vida']] },
    { icon: 'phishing', cat: 'seguridad', t: 'Recibí un mensaje o llamada sospechosa', k: 'sospechoso estafa fraude mensaje llamada correo phishing codigo clave',
      a: 'Pichibank nunca te pide claves ni códigos por llamada, SMS o correo. No respondas, no abras enlaces y repórtalo desde Seguridad.', acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'phonelink_lock', cat: 'seguridad', t: '¿Cómo uso la app en un celular nuevo?', k: 'celular nuevo cambiar dispositivo telefono nuevo vincular',
      a: 'Inicia sesión en el celular nuevo y confirma con el código que te llega por SMS. El anterior se desvincula solo.', acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'insights', cat: 'app', t: '¿Qué es Mis finanzas?', k: 'mis finanzas pfm gastos presupuesto metas resumen',
      a: 'Es donde ves tu dinero de hoy, en qué gastas cada mes, tus presupuestos y metas. Uku te cuenta lo importante de cada mes.', acts: [['Ir a Mis finanzas', 'pfm']] },
    { icon: 'bolt', cat: 'app', t: '¿Cómo creo un atajo?', k: 'atajo grabar repetir rapido buscador',
      a: 'En el buscador toca Grabar un atajo, elige la acción y sus datos. Después la repites con un toque.', acts: [['Abrir el buscador', 'search']] },
    // Lo que más se consulta en el centro de ayuda del banco: acceso, bloqueos, reclamos y documentos
    { icon: 'person_search', cat: 'seguridad', t: 'Olvidé mi usuario', k: 'olvide usuario no recuerdo usuario recuperar usuario ingresar',
      a: 'En la pantalla de ingreso toca «¿Problemas para ingresar?» y elige «Olvidé mi usuario». Te pedimos tu cédula, el código dactilar y una foto para verificar que eres tú. Tu usuario llega por SMS al celular registrado.',
      acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'lock_clock', cat: 'seguridad', t: 'Me bloqueé: ingresé mal mi clave', k: 'bloqueado bloqueo acceso tres intentos ingrese mal clave usuario bloqueada',
      a: 'Al tercer intento fallido la app bloquea el acceso por seguridad. No tienes que llamar: toca «Olvidé mi contraseña», crea una nueva y entras de inmediato.',
      acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'fingerprint', cat: 'seguridad', t: '¿Cómo entro con mi huella o mi cara?', k: 'huella face id rostro biometria entrar rapido',
      a: 'En Seguridad › Ingreso rápido activa la huella o el reconocimiento facial. Se usa el que ya tiene tu celular; el banco no guarda tu huella.',
      acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'pause_circle', cat: 'tarjetas', t: '¿Cómo bloqueo temporalmente mi tarjeta de débito?', k: 'bloqueo temporal debito pausar tarjeta debito bloquear temporalmente',
      a: 'En Solicitudes › Tarjetas de débito eliges la tarjeta y tocas «Bloqueo temporal». Es inmediato y lo quitas cuando quieras. Esta opción es solo para tarjetas de débito; la de crédito se congela desde la tarjeta.',
      acts: [['Ver mis tarjetas', 'tab:Tarjetas']] },
    { icon: 'block', cat: 'tarjetas', t: '¿Cómo bloqueo definitivamente mi tarjeta?', k: 'bloqueo definitivo cancelar tarjeta fisica robo perdida definitivo reponer nueva',
      a: 'Si la perdiste o te la robaron, bloquéala de forma definitiva desde la tarjeta › Bloquear › Definitivo. Ahí mismo pides la reposición; mientras llega, tu tarjeta digital sigue funcionando para pagar con el celular.',
      acts: [['Ver mis tarjetas', 'tab:Tarjetas']] },
    { icon: 'pin', cat: 'tarjetas', t: '¿Cómo cambio la clave de mi tarjeta?', k: 'cambiar clave tarjeta cajero pin 4 digitos clave de retiro',
      a: 'Desde la tarjeta › Cambiar clave. Eliges una nueva de 4 dígitos y queda activa al instante para cajeros y compras.',
      acts: [['Ver mis tarjetas', 'tab:Tarjetas']] },
    { icon: 'event_busy', cat: 'tarjetas', t: 'Mi tarjeta aparece caducada o vencida', k: 'caducada vencida tarjeta expiro no funciona renovar',
      a: 'Cuando la tarjeta vence, la nueva se emite sola y te llega a tu dirección registrada. En la tarjeta ves la fecha de vencimiento y, si ya pasó, pides la renovación desde ahí.',
      acts: [['Ver mis tarjetas', 'tab:Tarjetas']] },
    { icon: 'contactless', cat: 'tarjetas', t: '¿Cómo pago con el celular (Apple Pay o Google Pay)?', k: 'apple pay google pay wallet billetera digital registrar tarjeta celular pagar contactless',
      a: 'Desde la tarjeta › Agregar a mi billetera. Si no se registra sola, hazlo manual en la app Wallet con los datos de la tarjeta. Tu tarjeta de débito digital también sirve para esto.',
      acts: [['Ver mis tarjetas', 'tab:Tarjetas']] },
    { icon: 'calendar_month', cat: 'tarjetas', t: '¿Puedo diferir una compra?', k: 'diferir diferido cuotas meses compra tarjeta credito plazo',
      a: 'Sí: consumos desde $ 50 se difieren desde la app hasta 12 meses, con interés. Entras a la tarjeta › Consumos, eliges el consumo y tocas Diferir.',
      acts: [['Ver mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'gpp_maybe', cat: 'tarjetas', t: 'Sospecho un fraude con mi tarjeta digital', k: 'fraude tarjeta digital vulnerar datos sospecha clonada datos',
      a: 'Bloquéala ahora desde la tarjeta: la digital se bloquea igual que la física. Luego pide una revisión de los consumos que no reconoces. Si compartiste datos por un enlace o una llamada, cambia también tu clave de acceso.',
      acts: [['Bloquear mi tarjeta', 'card:Mastercard Black'], ['Solicitar revisión', 'review']] },
    { icon: 'help_center', cat: 'reclamos', t: '¿Qué es un consumo no reconocido?', k: 'que es consumo no reconocido reclamo significa',
      a: 'Es un cobro que aparece en tus movimientos o en tu estado de cuenta y que no recuerdas haber hecho ni autorizado. El banco analiza la transacción para saber de dónde salió y te da una respuesta formal.',
      acts: [['Solicitar revisión', 'review']] },
    { icon: 'checklist', cat: 'reclamos', t: '¿Qué reviso antes de reclamar?', k: 'antes de reclamar revisar suscripcion fecha hora notificacion spam',
      a: 'Tres cosas: la fecha y la hora (algunos comercios cobran días después), si es una suscripción que olvidaste, y si compartiste los datos de tu tarjeta con alguien. También revisa el correo y los SMS, incluido spam: te avisamos de cada consumo.',
      acts: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL'], ['Solicitar revisión', 'review']] },
    { icon: 'schedule', cat: 'reclamos', t: '¿Cuánto tarda un reclamo?', k: 'cuanto tarda reclamo tiempo dias habiles respuesta',
      a: 'Un reclamo nacional se resuelve en hasta 15 días hábiles, según el caso. Te avisamos por correo y lo sigues en Solicitudes.',
      acts: [['Ver mis solicitudes', 'sol']] },
    { icon: 'manage_search', cat: 'reclamos', t: 'No encuentro mi reclamo', k: 'no encuentro reclamo seguimiento estado donde veo mi reclamo',
      a: 'En Solicitudes ves los reclamos que registraste desde la app. Si lo registraste por teléfono o en una agencia, indícale el número de caso a un asesor y te dirá cómo va.',
      acts: [['Ver mis solicitudes', 'sol'], ['Hablar con una persona', 'handoff']] },
    { icon: 'receipt_long', cat: 'cuentas', t: '¿Cómo descargo mi estado de cuenta?', k: 'estado de cuenta descargar pdf mensual cuenta',
      a: 'Entra a tu cuenta › Estados de cuenta y descarga el mes que necesites en PDF. Los tienes de los últimos 12 meses, sin costo.',
      acts: [['Ver mi cuenta', 'do:Cuenta PRINCIPAL']] },
    { icon: 'badge', cat: 'cuentas', t: '¿Cómo actualizo mis datos?', k: 'actualizar datos direccion telefono correo celular cambiar datos',
      a: 'En Perfil › Mis datos cambias tu celular, correo y dirección. Confirmas con un código por SMS y queda al instante.',
      acts: [['Mis datos', 'do:Datos personales']] },
    { icon: 'smartphone', cat: 'cuentas', t: '¿Cómo transfiero a un número de celular?', k: 'transferir celular numero telefono deuna contacto sin cuenta',
      a: 'En Transferir eliges «A un celular», buscas el contacto y pones el monto. Llega al instante y sin costo hasta $ 500 al día. La persona recibe el dinero en la cuenta que vinculó a su número.',
      acts: [['Transferir', 'do:Transferir dinero']] },
    { icon: 'phone_android', cat: 'pagos', t: '¿Cómo recargo un celular?', k: 'recargar celular saldo recarga operadora',
      a: 'En Recargar eliges la operadora, escribes el número y el monto. Se acredita al instante y el comprobante queda en tus movimientos.',
      acts: [['Recargar', 'do:Recargar celular']] },
    { icon: 'support_agent', cat: 'app', t: '¿Por dónde me atienden?', k: 'canales atencion telefono whatsapp agencia horario comunicarme',
      a: 'Aquí mismo con Uku las 24 horas; con una persona por chat, por teléfono al ' + PHONE + ' o pidiendo que te llamen. Para lo que no se puede hacer en la app, en cualquier agencia.',
      acts: [['Hablar con una persona', 'handoff']] }
  ];
  /* Temas que no son «cómo hago» sino «por qué» o «qué es»: cargos, impuestos y términos que la gente
     pregunta con sus palabras. Uku explica en corto y enlaza a dónde leer más. Si no está aquí, busca
     en el centro de ayuda y en el blog del banco antes de pasar con una persona. */
  var AYUDA_URL = 'https://soporte.pichincha.com/hc/es-419', BLOG_URL = 'https://www.pichincha.com/blog';
  var TEMAS = [
    { t: 'Impuesto a la salida de divisas (ISD)', k: 'isd salida de divisas impuesto salida divisas cobro exterior compra en el exterior dolares afuera por que me cobraron impuesto',
      a: 'Es un impuesto del Estado ecuatoriano, no del banco: se cobra sobre lo que pagas o envías al exterior (compras en sitios de afuera, suscripciones internacionales, transferencias a otros países). El banco lo retiene y lo entrega al SRI. En tu estado de cuenta aparece como una línea aparte junto al consumo.',
      mas: 'Parte de ese ISD se puede usar como crédito tributario en tu declaración de impuesto a la renta.', acts: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL']], links: [['Qué es el ISD (SRI)', 'https://www.sri.gob.ec/impuesto-a-la-salida-de-divisas'], ['Centro de ayuda', AYUDA_URL]] },
    { t: 'Comisiones y cargos de la cuenta', k: 'comision comisiones cargo cargos cobro mantenimiento costo por que me descontaron me descontaron debito raro cobro del banco',
      a: 'Las cuentas básicas no tienen costo de mantenimiento. Lo que sí tiene costo son algunos servicios: transferencias a otros bancos, retiros en cajeros de otras redes, estados de cuenta en papel o chequeras. Cada cargo aparece en tus movimientos con su nombre.',
      acts: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL']], links: [['Tarifario de servicios', AYUDA_URL]] },
    { t: 'Intereses de la tarjeta', k: 'interes intereses tarjeta por que me cobraron intereses financiamiento rotativo',
      a: 'Te cobran intereses solo cuando pagas menos que el total de tu estado de cuenta: el saldo que queda se financia. Si pagas el total hasta la fecha máxima, no hay intereses. Los diferidos con interés también los generan, mes a mes.',
      acts: [['Pagar tarjeta', 'do:Pagar tarjeta']], links: [['Centro de ayuda: tarjetas', AYUDA_URL + '/sections/32377446948379-Bloqueos-y-Seguridad']] },
    { t: 'Cargo por mora', k: 'mora atraso recargo pague tarde interes de mora penalidad',
      a: 'Si pagas después de la fecha máxima, se cobra un interés de mora por los días de atraso y puede afectar tu historial crediticio. Programar el pago evita el atraso.',
      acts: [['Programar el pago', 'do:Pagar tarjeta']] },
    { t: 'Retención y pagos a empresas', k: 'retencion retenciones iva renta factura empresa negocio comprobante',
      a: 'Cuando una empresa te paga, puede retener una parte de impuestos (renta o IVA) y entregarla al SRI; te llega el valor neto y un comprobante de retención. El banco no interviene: lo decide quien te paga.',
      links: [['SRI: retenciones', 'https://www.sri.gob.ec/retenciones-en-la-fuente']] },
    { t: 'Transferencias al exterior', k: 'exterior otro pais swift envio internacional recibir del exterior remesa cuanto tarda costo',
      a: 'Enviar dinero a otro país tiene un costo del banco, el ISD y, a veces, comisiones del banco receptor. Tarda de 1 a 3 días hábiles. Recibir desde el exterior no tiene ISD; sí puede tener costo del banco intermediario.',
      acts: [['Transferir', 'do:Transferir dinero']], links: [['Centro de ayuda', AYUDA_URL]] },
    { t: 'Sobregiro', k: 'sobregiro saldo negativo en rojo me quede sin saldo debito sin fondos',
      a: 'Un sobregiro es cuando un débito deja tu cuenta en negativo. Las cuentas básicas no lo permiten: el pago se rechaza. Si tienes cupo de sobregiro contratado, el banco cubre el pago y cobra interés por los días en negativo.',
      acts: [['Ver mi cuenta', 'do:Cuenta PRINCIPAL']] },
    { t: 'Tasa de interés de un préstamo', k: 'tasa interes prestamo credito cuanto me cobran tasa anual efectiva',
      a: 'La tasa es el costo anual del dinero que te prestan; la efectiva incluye el efecto de pagar cada mes. En tu préstamo ves la tasa, la cuota y cuánto va a capital y a intereses.',
      acts: [['Ver mi préstamo', 'tab:Prestamos']] },
    { t: 'Garantía de depósitos', k: 'cosede garantia depositos seguro de depositos si quiebra el banco',
      a: 'Tus depósitos están cubiertos por la COSEDE hasta el monto que fija la ley, por persona y por entidad. Es una protección del sistema, no del banco.',
      links: [['COSEDE', 'https://www.cosede.gob.ec']] },
    { t: 'Historial crediticio (buró)', k: 'buro historial crediticio score crediticio central de riesgos calificacion',
      a: 'Tu historial resume cómo has pagado tus créditos y tarjetas. Pagar a tiempo lo mejora; los atrasos lo afectan por un tiempo. Puedes consultarlo gratis en el buró.',
      links: [['Consultar mi historial', 'https://www.equifax.com.ec']] }
  ];
  function tema(q, n) {
    var ws = norm(q).replace(/[¿?¡!.,]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 3; });
    if (!ws.length) return [];
    return TEMAS.map(function (x, i) { var k = ' ' + norm(x.t + ' ' + x.k) + ' ', sc = 0; ws.forEach(function (w) { var r = w.replace(/(es|s)$/, ''); if (k.indexOf(' ' + w) >= 0) sc += 3; else if (r.length > 3 && k.indexOf(r) >= 0) sc += 1; }); return { i: i, sc: sc, t: x.t }; })
      .filter(function (x) { return x.sc >= 3; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, n || 3);
  }
  function buscarURL(q) { return AYUDA_URL + '/search?query=' + encodeURIComponent(q); }
  /* Inconvenientes guiados: Uku pregunta lo justo para llevarte a la solución.
     Cada paso tiene una pregunta y opciones; cada opción lleva a otro paso,
     a una ayuda (faq) o a una acción de la app. */
  var FLOWS = [
    { id: 'entrar', icon: 'login', t: 'No puedo entrar a la app', k: 'no puedo entrar ingresar acceso bloqueado olvide usuario clave', s: {
      ini: { q: '¿Qué pasa al ingresar?', ops: [['Olvidé mi usuario', 'faq:Olvidé mi usuario'], ['Olvidé mi clave', 'faq:Olvidé mi clave'], ['Me bloqueé por intentos', 'faq:Me bloqueé: ingresé mal mi clave'], ['Cambié de celular', 'faq:¿Cómo uso la app en un celular nuevo?'], ['Otra cosa', 'persona']] } } },
    { id: 'consumo', icon: 'report', t: 'No reconozco un consumo', k: 'no reconozco consumo cobro cargo doble dos veces cobraron fraude debitaron', s: {
      ini: { q: 'Vamos a revisarlo. ¿Puede ser una suscripción o un cobro que llegó con días de retraso?', ops: [['Puede ser', 'go:rev'], ['No, no es mío', 'go:tarjeta']] },
      rev: { q: 'Revísalo en tus movimientos: el nombre del comercio a veces es distinto al de la tienda. Si sigue sin cuadrar, pedimos la revisión.', ops: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL'], ['No es mío, seguir', 'go:tarjeta']] },
      tarjeta: { q: '¿Todavía tienes la tarjeta contigo?', ops: [['Sí, la tengo', 'go:reclamo'], ['No, la perdí o me la robaron', 'go:bloqueo']] },
      bloqueo: { q: 'Bloquéala ahora para que nadie más la use. Después pedimos la revisión del consumo.', ops: [['Bloquear mi tarjeta', 'card:Mastercard Black'], ['Ya la bloqueé, seguir', 'go:reclamo']] },
      reclamo: { q: 'Pide la revisión: eliges el consumo y nos cuentas qué pasó. Se resuelve en hasta 15 días hábiles y ese monto no te genera intereses mientras tanto.', ops: [['Solicitar revisión', 'review'], ['Hablar con una persona', 'persona']] } } },
    { id: 'tarjeta', icon: 'credit_card_off', t: 'Problema con mi tarjeta', k: 'tarjeta no funciona rechazada perdi robo caducada clave', s: {
      ini: { q: '¿Qué pasa con tu tarjeta?', ops: [['La perdí o me la robaron', 'faq:¿Cómo bloqueo definitivamente mi tarjeta?'], ['Me la rechazan al pagar', 'go:rechazo'], ['Aparece vencida', 'faq:Mi tarjeta aparece caducada o vencida'], ['Olvidé su clave', 'faq:¿Cómo cambio la clave de mi tarjeta?'], ['Quiero pausarla un tiempo', 'faq:¿Cómo bloqueo temporalmente mi tarjeta de débito?']] },
      rechazo: { q: '¿Dónde te la rechazaron?', ops: [['En una compra en línea', 'go:online'], ['En el exterior', 'faq:Voy a viajar: ¿mi tarjeta funciona afuera?'], ['En una tienda o cajero', 'go:fisico']] },
      online: { q: 'Revisa que las compras en línea estén activas en tu tarjeta › Límites, y que tengas cupo disponible.', ops: [['Ver mi tarjeta', 'card:Mastercard Black'], ['Sigue sin funcionar', 'persona']] },
      fisico: { q: 'Puede ser la clave, el cupo o un bloqueo temporal. En tu tarjeta ves si está activa y cuánto cupo tienes.', ops: [['Ver mi tarjeta', 'card:Mastercard Black'], ['Sigue sin funcionar', 'persona']] } } },
    { id: 'transfer', icon: 'sync_problem', t: 'Mi transferencia no llegó', k: 'transferencia no llego no llega demora pendiente', s: {
      ini: { q: '¿A dónde la enviaste?', ops: [['A otra cuenta Pichibank o a un celular', 'go:instant'], ['A otro banco', 'go:otro']] },
      instant: { q: 'Esas llegan al instante. Revisa en tus movimientos que se haya debitado y que el número o el contacto sean los correctos.', ops: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL'], ['Se debitó y no llegó', 'persona']] },
      otro: { q: 'A otros bancos puede tardar hasta 24 horas hábiles si la hiciste después de las 15:00 o en fin de semana. Tu comprobante está en tus movimientos.', ops: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL'], ['Ya pasó más de un día', 'persona']] } } },
    { id: 'pago', icon: 'hourglass_top', t: 'Pagué y no se refleja', k: 'pague servicio no se refleja no aparece pendiente', s: {
      ini: { q: 'La empresa lo registra en hasta 24 horas. Tu comprobante está en tus movimientos por si te lo piden.', ops: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL'], ['Ya pasó más de un día', 'persona']] } } },
    { id: 'documento', icon: 'description', t: 'Necesito un documento', k: 'documento certificado estado de cuenta referencia constancia', s: {
      ini: { q: '¿Cuál necesitas?', ops: [['Certificado bancario', 'faq:Necesito un certificado bancario'], ['Estado de cuenta', 'faq:¿Cómo descargo mi estado de cuenta?'], ['Actualizar mis datos', 'faq:¿Cómo actualizo mis datos?']] } } }
  ];
  /* Categorías del centro de ayuda */
  var CATS = [
    ['seguridad', 'lock', 'Seguridad y acceso'], ['tarjetas', 'credit_card', 'Tarjetas'], ['reclamos', 'report', 'Reclamos'], ['cuentas', 'account_balance', 'Cuentas y transferencias'],
    ['pagos', 'payments', 'Pagos y recargas'], ['prestamos', 'request_quote', 'Préstamos'], ['inversiones', 'trending_up', 'Inversiones'], ['seguros', 'shield', 'Seguros'],
    ['app', 'smartphone', 'Tu app']
  ];
  /* Tutoriales: paso a paso, con un botón para hacerlo ahora */
  var TUT = [
    { icon: 'send_money', cat: 'cuentas', t: 'Transferir a otro banco', min: 1, k: 'transferir otro banco interbancaria',
      steps: ['Toca Transferir en Inicio.', 'Elige Otro banco y escribe el número de cuenta, o elige a alguien que ya tienes guardado.', 'Pon el monto y revisa los datos.', 'Confirma con tu huella o tu clave.'], act: ['Transferir ahora', 'do:Transferir dinero'] },
    { icon: 'qr_code_scanner', cat: 'pagos', t: 'Pagar con QR en una tienda', min: 1, k: 'pagar qr tienda codigo',
      steps: ['Toca Pagar con QR.', 'Apunta la cámara al código del comercio.', 'Revisa el monto y elige la cuenta.', 'Confirma: el comercio ve el pago al instante.'], act: ['Pagar con QR', 'do:Pagar con QR'] },
    { icon: 'ac_unit', cat: 'tarjetas', t: 'Congelar y descongelar tu tarjeta', min: 1, k: 'congelar tarjeta bloquear',
      steps: ['Entra a Tarjetas y elige tu tarjeta.', 'Toca Congelar.', 'Para volver a usarla, toca Descongelar.'], act: ['Ver mi tarjeta', 'card:Mastercard Black'] },
    { icon: 'autorenew', cat: 'pagos', t: 'Activar el pago automático de servicios', min: 2, k: 'pago automatico servicios luz agua',
      steps: ['Toca Pagar servicios y elige el servicio.', 'Toca Pago automático.', 'Elige la cuenta y un monto máximo.', 'Listo: te avisamos antes de cada pago.'], act: ['Pagar servicios', 'do:Pagar servicios'] },
    { icon: 'flag', cat: 'app', t: 'Crear una meta de ahorro', min: 2, k: 'meta ahorro crear objetivo',
      steps: ['Toca Crear meta de ahorro.', 'Ponle un nombre y cuánto quieres juntar.', 'Elige hasta cuándo y cuánto ahorrar cada mes.', 'Activa el ahorro automático para que se pase solo.'], act: ['Crear una meta', 'do:Crear meta de ahorro'] },
    { icon: 'atm', cat: 'cuentas', t: 'Retirar sin tarjeta', min: 1, k: 'retirar sin tarjeta cajero codigo efectivo',
      steps: ['Toca Retirar sin tarjeta y pon el monto.', 'Recibes un código válido por 30 minutos.', 'En el cajero elige Retiro sin tarjeta y escribe el código.'], act: ['Retirar sin tarjeta', 'do:Retirar sin tarjeta'] },
    { icon: 'bolt', cat: 'app', t: 'Grabar un atajo en el buscador', min: 1, k: 'atajo grabar buscador',
      steps: ['Abre el buscador deslizando hacia abajo en Inicio.', 'Toca Grabar un atajo.', 'Elige la acción, para quién y el monto.', 'Ponle un nombre y guárdalo.'], act: ['Abrir el buscador', 'search'] }
  ];
  /* Búsqueda en la ayuda (también la usa el buscador de la app) */
  function find(q, n) {
    var STOP = { como: 1, cuanto: 1, cuando: 1, que: 1, por: 1, para: 1, mis: 1, una: 1, los: 1, las: 1, del: 1, con: 1, puedo: 1, quiero: 1, tengo: 1, hago: 1 };
    var ws = norm(q).replace(/[¿?¡!.,]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && !STOP[w]; });
    if (!ws.length) return [];
    var all = FLOWS.map(function (f, i) { return { kind: 'flow', i: i, icon: f.icon, t: f.t, txt: f.t + ' ' + f.k, sc0: 1 }; })
      .concat(FAQ.map(function (f, i) { return { kind: 'faq', i: i, icon: f.icon, t: f.t, txt: f.t + ' ' + f.k }; }))
      .concat(TUT.map(function (u, i) { return { kind: 'tut', i: i, icon: u.icon, t: u.t, txt: u.t + ' ' + u.k }; }));
    return all.map(function (x) { var k = ' ' + norm(x.txt) + ' ', sc = 0; ws.forEach(function (w) { if (k.indexOf(' ' + w) >= 0) sc += 2; else if (k.indexOf(w) >= 0) sc += 1; }); x.sc = sc ? sc + (x.sc0 || 0) : 0; return x; })
      .filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, n || 5);
  }
  // Lo que sí necesita a una persona: no se puede hacer en la app
  var COMPLEX = /(hipotec|reestructur|refinanc|herenci|fallec|poder notarial|poderes|embargo|juicio|legal|demanda|reclamo en curso|mi reclamo|seguimiento)/;
  var CONTACT = [
    ['chat', 'Chat con un asesor', 'Te responde una persona · espera aprox. 2 min', 'agent'],
    ['call', 'Llamar al call center', PHONE + ' · las 24 horas', 'call'],
    ['phone_callback', 'Que te llamemos', 'Elige cuándo y te llama un asesor', 'callback']
  ];

  var el, log, input, topic = null, withAgent = false, agentN = 0, misses = 0, pageEl = null;
  function faqRow(i) {
    var f = FAQ[i];
    return '<button class="sp-row" data-sp="faq:' + i + '"><span class="sp-row__main"><b>' + f.t + '</b></span><span class="material-symbols-rounded">chevron_right</span></button>';
  }
  function tutRow(i) {
    var u = TUT[i];
    return '<button class="sp-row" data-sp="tut:' + i + '"><span class="sp-row__main"><b>' + u.t + '</b><small>Tutorial · ' + u.steps.length + ' pasos</small></span><span class="material-symbols-rounded">chevron_right</span></button>';
  }
  // Páginas dentro de Ayuda: una categoría o un tutorial
  function showPage(html, title) {
    pageEl.innerHTML = html; pageEl.hidden = false;
    el.classList.add('is-page');
    el.querySelector('.sp-top__title b').textContent = title;
    el.querySelector('.sp-body').scrollTop = 0;
  }
  function catPage(id) {
    var c = CATS.filter(function (x) { return x[0] === id; })[0];
    var fs = FAQ.map(function (f, i) { return f.cat === id ? i : -1; }).filter(function (i) { return i >= 0; });
    var ts = TUT.map(function (u, i) { return u.cat === id ? i : -1; }).filter(function (i) { return i >= 0; });
    var tip = id === 'seguridad' ? '<div class="bp-tips-security" style="margin-top:16px" role="note"><div class="bp-tips-security__content"><p class="bp-tips-security__title">Nunca compartas tus claves</p>' +
      '<p class="bp-tips-security__body">Pichibank no te pide claves ni códigos por llamada, SMS o correo. Si alguien lo hace, repórtalo desde Seguridad.</p></div>' +
      '<div class="bp-tips-security__art" aria-hidden="true"><span class="material-symbols-rounded">shield_locked</span></div></div>' : '';
    showPage(tip + '<section class="sp-sec"><h2>Preguntas frecuentes</h2><div class="sp-list">' + fs.map(faqRow).join('') + '</div></section>' +
      (ts.length ? '<section class="sp-sec"><h2>Tutoriales</h2><div class="sp-list">' + ts.map(tutRow).join('') + '</div></section>' : ''), c[2]);
  }
  function tutPage(i) {
    var u = TUT[i];
    showPage('<section class="sp-tutpage"><span class="sp-tutpage__ic material-symbols-rounded">' + u.icon + '</span><h2>' + u.t + '</h2><p>' + u.steps.length + ' pasos · ' + u.min + ' min</p>' +
      '<ol class="sp-steps">' + u.steps.map(function (st) { return '<li><span>' + esc(st) + '</span></li>'; }).join('') + '</ol>' +
      '<button class="pf-cta" data-sp="' + u.act[1] + '">' + u.act[0] + '</button>' +
      '<p class="sp-tutpage__more">¿Algo no salió? <button data-sp="ask">Pregúntale a ' + uku() + '</button></p></section>', 'Tutorial');
  }
  function hidePage() { if (!pageEl) return; pageEl.hidden = true; pageEl.innerHTML = ''; el.classList.remove('is-page'); el.querySelector('.sp-top__title b').textContent = 'Ayuda'; }
  function paintFound(q) {
    var box = el.querySelector('.sp-found'), r = find(q, 6);
    box.hidden = !q.trim();
    box.innerHTML = r.length ? '<div class="sp-list">' + r.map(function (x) { return x.kind === 'faq' ? faqRow(x.i) : tutRow(x.i); }).join('') + '</div>'
      : '<p class="sp-found__none">No encontré eso en la ayuda. <button data-sp="askq">Pregúntale a ' + uku() + '</button></p>';
  }

  function mount() {
    el = document.createElement('div');
    el.className = 'sp';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Ayuda');
    el.innerHTML =
      '<header class="sp-top"><button class="pf-round" data-sp="back" aria-label="Volver"><span class="material-symbols-rounded">arrow_back</span></button>' +
        '<span class="sp-top__title"><b>Ayuda</b><small></small></span><button class="pf-round" data-sp="search" aria-label="Buscar"><span class="material-symbols-rounded" aria-hidden="true">search</span></button></header>' +
      '<div class="sp-body">' +
        '<div class="sp-hub">' +
          '<label class="sp-find"><span class="material-symbols-rounded" aria-hidden="true">search</span><input type="search" placeholder="Busca en la ayuda" aria-label="Busca en la ayuda" data-sp-find></label>' +
          '<div class="sp-found" hidden></div>' +
          '<section class="sp-sec"><h2>Solucionar un inconveniente</h2><p class="sp-sec__sub">Uku te pregunta lo justo y te lleva a donde se arregla.</p><div class="sp-list">' + FLOWS.map(function (f, i) {
            return '<button class="sp-row" data-sp="flow:' + i + '"><span class="sp-row__main"><b>' + f.t + '</b></span><span class="material-symbols-rounded">chevron_right</span></button>'; }).join('') + '</div></section>' +
          '<section class="sp-sec"><h2>Lo más consultado</h2><div class="sp-list">' + [0, 5, 6, 7, 13].map(function (i) { return faqRow(i); }).join('') + '</div></section>' +
          '<section class="sp-sec"><h2>Categorías</h2><div class="sp-cats">' + CATS.map(function (c) {
            var n = FAQ.filter(function (f) { return f.cat === c[0]; }).length + TUT.filter(function (u) { return u.cat === c[0]; }).length;
            return '<button class="sp-cat" data-sp="cat:' + c[0] + '"><span class="sp-row__ic material-symbols-rounded">' + c[1] + '</span><b>' + c[2] + '</b><small>' + n + ' temas</small></button>';
          }).join('') + '</div></section>' +
          '<section class="sp-sec"><h2>Tutoriales</h2><div class="sp-tuts">' + TUT.map(function (u, i) {
            return '<button class="sp-tut" data-sp="tut:' + i + '"><span class="sp-row__ic material-symbols-rounded">' + u.icon + '</span><b>' + u.t + '</b><small>' + u.steps.length + ' pasos · ' + u.min + ' min</small></button>';
          }).join('') + '</div></section>' +
          '<section class="sp-sec sp-sec--people"><h2>Trámites con un asesor</h2><p class="sp-sec__sub">Solo para lo que no se puede hacer en la app: créditos hipotecarios, reestructurar una deuda, herencias y poderes, o un reclamo que ya está en curso.</p><div class="sp-list">' + CONTACT.map(function (c) {
            return '<button class="sp-row" data-sp="' + c[3] + '"><span class="sp-row__ic material-symbols-rounded">' + c[0] + '</span><span class="sp-row__main"><b>' + c[1] + '</b><small>' + c[2] + '</small></span><span class="material-symbols-rounded">chevron_right</span></button>';
          }).join('') + '</div></section>' +
        '</div>' +
        '<div class="sp-page" hidden></div>' +
        '<div class="sp-log" aria-live="polite"></div>' +
      '</div>' +
      '<form class="sp-composer"><input type="text" enterkeyhint="send" autocomplete="off" placeholder="Pregúntame lo que necesites" aria-label="Escribe tu problema">' +
        '<button class="sp-send" aria-label="Enviar"><span class="material-symbols-rounded">arrow_upward</span></button></form>';
    document.body.appendChild(el);
    log = el.querySelector('.sp-log');
    pageEl = el.querySelector('.sp-page');
    var fi = el.querySelector('[data-sp-find]');
    fi.addEventListener('input', function () { paintFound(fi.value); });
    input = el.querySelector('.sp-composer input');
    el.addEventListener('click', onClick);
    el.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim(); if (!v) return;
      input.value = ''; send(v);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el.classList.contains('open')) { e.stopImmediatePropagation(); back(); }
    }, true);
  }

  /* ---------- Mensajes ---------- */
  function scrollEnd() { var b = el.querySelector('.sp-body'); requestAnimationFrame(function () { b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }); }); }
  function add(html) { var d = document.createElement('div'); d.innerHTML = html; var n = d.firstChild; log.appendChild(n); scrollEnd(); return n; }
  function btns(list) {
    return list && list.length ? '<div class="sp-acts">' + list.map(function (b) {
      return b[1].indexOf('tel:') === 0 ? '<a class="sp-act" href="' + b[1] + '">' + b[0] + '</a>' : '<button class="sp-act" data-sp="' + b[1] + '">' + b[0] + '</button>';
    }).join('') + '</div>' : '';
  }
  function me(t) { add('<div class="sp-msg sp-msg--me"><p>' + esc(t) + '</p></div>'); }
  function sys(t) { add('<p class="sp-sys">' + t + '</p>'); }
  // Uku "escribe" un momento antes de responder
  function say(html, acts, delay) {
    var typing = add('<div class="sp-msg sp-msg--uku"><span class="sp-av">' + face() + '</span><div class="sp-msg__body"><p class="sp-typing"><i></i><i></i><i></i></p></div></div>');
    setTimeout(function () {
      typing.querySelector('.sp-msg__body').innerHTML = '<p>' + html + '</p>' + btns(acts);
      scrollEnd();
    }, delay == null ? 650 : delay);
  }
  function agentSay(t, delay) {
    var typing = add('<div class="sp-msg sp-msg--agent"><span class="sp-av sp-av--agent">' + AGENT.ini + '</span><div class="sp-msg__body"><small>' + AGENT.name + '</small><p class="sp-typing"><i></i><i></i><i></i></p></div></div>');
    setTimeout(function () { typing.querySelector('.sp-typing').outerHTML = '<p>' + esc(t) + '</p>'; scrollEnd(); fx('select'); }, delay || 1200);
  }

  /* ---------- Conversación ---------- */
  function chat() { el.classList.add('is-chat'); }
  function answer(i) {
    var f = FAQ[i]; topic = f.t; chat();
    me(f.t);
    reply(f);
  }
  function reply(f, lead) {
    misses = 0;
    say((lead || '') + esc(typeof f.a === 'function' ? f.a() : f.a), f.acts);
    setTimeout(function () { say('¿Te sirvió?', [['Sí, gracias', 'ok'], ['No, es otra cosa', 'other']], 500); }, 1100);
  }
  function topicChips(n) { return FAQ.slice(0, n).map(function (f) { return [f.t, 'faq:' + FAQ.indexOf(f)]; }); }
  function handoff() {
    say('Te comunico con una persona del banco. Le paso un resumen de lo que hablamos para que no tengas que repetirlo. ¿Cómo prefieres?',
      CONTACT.map(function (c) { return [c[1], c[3]]; }));
  }
  function summary() {
    return '<span class="sp-case"><b>Resumen para el asesor · caso ' + CASE + '</b>' +
      '<span>Tema: ' + esc(topic || 'Consulta general') + '</span>' +
      '<span>Cliente verificado en la app' + (firstName() ? ' (' + esc(firstName()) + ')' : '') + '</span>' +
      '<span>Ya revisó: ' + (FAQ.some(function (f) { return f.t === topic; }) ? 'la ayuda de este tema' : 'las ayudas frecuentes') + '</span></span>';
  }
  function toAgent() {
    if (withAgent) return;
    chat();
    say('Listo, te conecto. Esto es lo que le paso:' + summary(), null, 500);
    setTimeout(function () { sys('Buscando un asesor disponible…'); }, 1300);
    setTimeout(function () {
      withAgent = true; el.classList.add('is-agent');
      el.querySelector('.sp-top__title b').textContent = AGENT.name;
      el.querySelector('.sp-top__title small').textContent = 'Asesora de Pichibank';
      input.placeholder = 'Escríbele a ' + AGENT.name.split(' ')[0];
      sys(AGENT.name + ' se unió al chat. Desde aquí te responde una persona, no ' + uku() + '.');
      fx('success');
      agentSay('Hola' + (firstName() ? ', ' + firstName() : '') + '. Soy Andrea. Ya vi tu caso sobre «' + (topic || 'tu consulta') + '». ¿Me cuentas la fecha y el monto aproximado para revisarlo?', 1400);
    }, 3000);
  }
  var AGENT_REPLIES = ['Gracias, ya lo estoy revisando. Dame un momento, por favor.', 'Listo, lo registré en tu caso ' + CASE + '. Te llega un correo con el detalle y la respuesta en máximo 48 horas.', '¿Hay algo más en lo que te pueda ayudar?'];
  function send(t) {
    chat(); me(t);
    if (withAgent) { agentSay(AGENT_REPLIES[Math.min(agentN++, AGENT_REPLIES.length - 1)], 1600); return; }
    var q = norm(t);
    if (COMPLEX.test(q)) {
      topic = t;
      return say('Eso no se puede hacer desde la app: lo atiende un asesor. Le paso tu caso con un resumen para que no tengas que repetir nada. ¿Cómo prefieres?', CONTACT.map(function (c) { return [c[1], c[3]]; }));
    }
    if (/(persona|asesor|humano|agente|llamar|llamen|call)/.test(q)) {
      return say('Casi todo lo puedes resolver aquí mismo, y es más rápido. ¿De qué se trata?', topicChips(3).concat([['Es un trámite que no está en la app', 'handoff']]));
    }
    if (/(gast|ahorr|presupuest|metas?\b|cuanto tengo)/.test(q)) {
      return say('Eso lo vemos mejor en Mis finanzas: ahí tienes tu dinero de hoy, tus gastos, presupuestos y metas.', [['Ir a Mis finanzas', 'pfm']]);
    }
    var best = -1, bs = 0;
    FAQ.forEach(function (f, i) {
      var sc = 0, k = ' ' + norm(f.t + ' ' + f.k) + ' ';
      q.split(/\s+/).forEach(function (w) { if (w.length > 2 && k.indexOf(w) >= 0) sc++; });
      if (sc > bs) { bs = sc; best = i; }
    });
    if (best >= 0) { topic = FAQ[best].t; return reply(FAQ[best]); }
    topic = t;
    if (++misses < 2) return say('No encontré eso. ¿Me lo dices de otra forma? O elige uno de estos temas:', topicChips(4));
    say('Sigo sin encontrarlo. Si es un trámite que no está en la app, te paso con un asesor con lo que ya me contaste.', [['Hablar con un asesor', 'handoff'], ['Ver todos los temas', 'back']]);
  }

  function onClick(e) {
    var b = e.target.closest('[data-sp]');
    if (!b) return;
    var k = b.dataset.sp;
    fx('select');
    // Elegir una opción de contacto deja la elección como respuesta y quita las demás
    var grp = /^(agent|call|callback)$/.test(k) && b.closest('.sp-acts');
    if (grp) { grp.remove(); me(b.textContent); }
    if (k === 'search') { return window.Buscador && Buscador.open('ayuda'); }
    if (k === 'back') { if (b.closest('.sp-acts')) { reset(); el.querySelector('.sp-body').scrollTop = 0; return; } return back(); }
    if (k.indexOf('faq:') === 0) { if (window.UkuAsistente && UkuAsistente.faq) return UkuAsistente.faq(+k.slice(4)); var fa = b.closest('.sp-acts'); if (fa) fa.remove(); hidePage(); return answer(+k.slice(4)); }
    if (k.indexOf('cat:') === 0) return catPage(k.slice(4));
    if (k.indexOf('flow:') === 0) { if (window.UkuAsistente && UkuAsistente.flow) return UkuAsistente.flow(+k.slice(5)); return send(FLOWS[+k.slice(5)].t); }
    if (k.indexOf('tut:') === 0) { if (window.UkuAsistente && UkuAsistente.tut) return UkuAsistente.tut(+k.slice(4)); return tutPage(+k.slice(4)); }
    if (k === 'ask') { if (window.UkuAsistente && UkuAsistente.escribir) return UkuAsistente.escribir(); hidePage(); chat(); say('Cuéntame qué pasó y te ayudo.'); setTimeout(function () { input.focus(); }, 600); return; }
    if (k === 'askq') { var fq = el.querySelector('[data-sp-find]'), qq = fq.value.trim(); fq.value = ''; paintFound(''); if (qq) { if (window.UkuAsistente && UkuAsistente.preguntar) return UkuAsistente.preguntar(qq); send(qq); } return; }
    if (k === 'search') { close(); setTimeout(function () { window.Buscador && Buscador.open(); }, 300); return; }
    if (k === 'other') { b.closest('.sp-acts').remove(); me('No, es otra cosa'); say('Cuéntame con tus palabras qué necesitas.'); setTimeout(function () { input.focus(); }, 700); return; }
    if (k === 'review') {
      var ra = b.closest('.sp-acts'); if (ra) { ra.remove(); me(b.textContent); }
      log.querySelectorAll('[data-sp="ok"]').forEach(function (x) { x.closest('.sp-acts').remove(); });
      return review(true);
    }
    if (k.indexOf('card:') === 0) {
      var cn = k.slice(5); close();
      setTimeout(function () {
        if (window.__goView) window.__goView(0);
        var r = document.querySelector('#home-page [data-panel="Tarjetas"] .product-row[data-action="' + cn + '"]'); if (r) r.click();
      }, 300);
      return;
    }
    if (k === 'ok') { b.closest('.sp-acts').remove(); me('Sí, gracias'); return say('¡Qué bueno! Aquí estoy si necesitas algo más.'); }
    if (k === 'handoff') { chat(); var a = b.closest('.sp-acts'); if (a) { a.remove(); me(b.textContent); } return handoff(); }
    if (k === 'agent') return toAgent();
    if (k === 'call') {
      chat();
      return say('Llama al <b>' + PHONE + '</b> (las 24 horas). Dile este código al asesor y sabrá de qué se trata: <b>' + CASE + '</b>.', [['Llamar ahora', 'tel:' + PHONE.replace(/\s/g, '')]]);
    }
    if (k === 'callback') {
      chat();
      return say('¿Cuándo te llamamos al 099 *** 4521?', [['Ahora', 'cb:en unos minutos'], ['En 30 minutos', 'cb:en 30 minutos'], ['Mañana en la mañana', 'cb:mañana entre 9:00 y 11:00']]);
    }
    if (k.indexOf('cb:') === 0) {
      b.closest('.sp-acts').remove(); me(b.textContent); fx('success');
      return say('Listo. Un asesor te llama ' + esc(k.slice(3)) + '. Ya tiene el resumen de tu caso ' + CASE + ', así que no tendrás que repetir nada.');
    }
    if (k === 'pfm') { close(); setTimeout(function () { window.Asistente && Asistente.openPF(); }, 300); return; }
    if (k.indexOf('tab:') === 0) {
      var tab = k.slice(4); close();
      setTimeout(function () {
        if (window.__goView) window.__goView(0);
        var t = document.querySelector('.tabs .tab[data-panel="' + tab + '"]'); if (t) t.click();
      }, 300);
      return;
    }
    if (k.indexOf('do:') === 0) {
      var act = k.slice(3); close();
      setTimeout(function () {
        var x = document.querySelector('#home-page [data-action="' + act + '"]') || document.querySelector('[data-action="' + act + '"]');
        if (x) x.click();
      }, 300);
    }
  }


  /* ---------- Solicitud de revisión de un consumo (tarjeta de crédito) ----------
     Eliges el consumo, cuentas qué pasó y se envía. Toma de 2 a 6 semanas. */
  var sh, shBack, rv = null;
  function ensureSheet() {
    if (sh) return;
    shBack = document.createElement('div'); shBack.className = 'as-sheet-back';
    sh = document.createElement('div'); sh.className = 'as-sheet sp-review'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Solicitar revisión');
    document.body.appendChild(shBack); document.body.appendChild(sh);
    shBack.addEventListener('click', closeSheet);
    sh.addEventListener('click', onSheet);
  }
  function closeSheet() { shBack.classList.remove('open'); sh.classList.remove('open'); }
  function sheetHTML(html) { sh.innerHTML = '<div class="as-sheet__handle"></div>' + html; sh.scrollTop = 0; }
  function cardTx() {
    var d = window.Asistente && Asistente.data && Asistente.data(), MON = ['ago', 'sep', 'oct'];
    var list = d ? d.tx.filter(function (t) { return t.acct === 'and1'; }).sort(function (a, b) { return (b.mi * 40 + b.day) - (a.mi * 40 + a.day); }).slice(0, 6) : [];
    if (!list.length) list = [{ who: 'Mercado Libre', amt: 74.9, day: 5, mi: 2 }, { who: 'Cinemark', amt: 18.5, day: 2, mi: 2 }];
    return list.map(function (t) { return { who: t.who, amt: t.amt, date: t.day + ' ' + MON[t.mi] }; });
  }
  var REASONS = ['No lo hice yo', 'Me cobraron dos veces', 'El monto no coincide', 'No recibí lo que compré'];
  function rvStep1() {
    rv.list = cardTx();
    sheetHTML('<h3>¿Qué consumo no reconoces?</h3><p>Mastercard Black · últimos consumos</p><div class="sp-rv-list">' + rv.list.map(function (t, i) {
      return '<button class="sp-rv-tx" data-rv="tx:' + i + '"><span><b>' + esc(t.who) + '</b><small>' + t.date + '</small></span><b>-' + money(t.amt) + '</b></button>';
    }).join('') + '</div>');
  }
  function rvStep2() {
    var t = rv.list[rv.tx];
    sheetHTML('<h3>¿Qué pasó?</h3><p>' + esc(t.who) + ' · ' + t.date + ' · ' + money(t.amt) + '</p>' +
      '<div class="sp-rv-chips">' + REASONS.map(function (r, i) { return '<button class="sx-chip" data-rv="why:' + i + '" aria-pressed="' + (rv.why === i) + '">' + r + '</button>'; }).join('') + '</div>' +
      '<p class="as-sheet__label">¿Tienes tu tarjeta contigo?</p><div class="sp-rv-chips">' +
        '<button class="sx-chip" data-rv="has:1" aria-pressed="' + (rv.has === 1) + '">Sí, la tengo</button><button class="sx-chip" data-rv="has:0" aria-pressed="' + (rv.has === 0) + '">No la tengo</button></div>' +
      '<button class="pf-cta" data-rv="next"' + (rv.why == null || rv.has == null ? ' disabled' : '') + '>Continuar</button>');
  }
  function rvStep3() {
    var t = rv.list[rv.tx];
    sheetHTML('<h3>Revisa tu solicitud</h3><div class="sp-case sp-rv-sum">' +
      '<span><small>Consumo</small><b>' + esc(t.who) + ' · ' + money(t.amt) + '</b></span><span><small>Fecha</small><b>' + t.date + '</b></span><span><small>Motivo</small><b>' + REASONS[rv.why] + '</b></span></div>' +
      '<ul class="sp-rv-info"><li>Revisamos el consumo con el comercio y la marca de tu tarjeta. Toma entre 2 y 6 semanas.</li>' +
      '<li>Mientras tanto, ese monto no te genera intereses.</li>' +
      (rv.has === 0 ? '<li>Como no tienes la tarjeta, la bloqueamos al enviar y te mandamos una nueva.</li>' : '') + '</ul>' +
      '<button class="pf-cta" data-rv="send">Enviar solicitud</button>');
  }
  function rvDone() {
    var t = rv.list[rv.tx], n = 'R-' + (20400 + Math.floor(Math.random() * 90));
    sheetHTML('<div class="pf-linking"><span class="pf-done material-symbols-rounded">check</span><h3>Solicitud enviada</h3><p>N.º ' + n + ' · ' + esc(t.who) + ' · ' + money(t.amt) + '<br>Te avisamos por notificación y correo cuando haya novedades.</p>' +
      '<button class="pf-cta" data-rv="close">Listo</button></div>');
    fx('success');
    if (rv.fromChat) say('Listo, tu solicitud ' + n + ' está en revisión. Toma entre 2 y 6 semanas; te aviso apenas haya novedades.' + (rv.has === 0 ? ' También bloqueamos tu tarjeta y te enviamos una nueva.' : ''), null, 900);
  }
  function onSheet(e) {
    var b = e.target.closest('[data-rv]'); if (!b || b.disabled) return;
    var k = b.dataset.rv; fx('select');
    if (k.indexOf('tx:') === 0) { rv.tx = +k.slice(3); return rvStep2(); }
    if (k.indexOf('why:') === 0) { rv.why = +k.slice(4); return rvStep2(); }
    if (k.indexOf('has:') === 0) { rv.has = +k.slice(4); return rvStep2(); }
    if (k === 'next') return rvStep3();
    if (k === 'send') { sheetHTML('<div class="pf-linking"><span class="pf-spinner"></span><h3>Enviando tu solicitud…</h3></div>'); setTimeout(rvDone, 1100); return; }
    if (k === 'close') closeSheet();
  }
  function review(fromChat) {
    ensureSheet();
    rv = { fromChat: !!fromChat, why: null, has: null };
    rvStep1();
    shBack.classList.add('open'); sh.classList.add('open'); fx('open');
  }

  function reset() {
    hidePage();
    var fi = el.querySelector('[data-sp-find]'); if (fi) { fi.value = ''; paintFound(''); }
    log.innerHTML = ''; topic = null; withAgent = false; agentN = 0; misses = 0;
    el.classList.remove('is-chat', 'is-agent');
    el.querySelector('.sp-top__title b').textContent = 'Ayuda';
    el.querySelector('.sp-top__title small').textContent = '';
    input.placeholder = 'Pregúntame lo que necesites';
  }
  // Dentro de Asistente, Ayuda vive en el mismo espacio que Uku: no bloquea la página ni se cierra como capa
  var inline = false;
  function into(node) {
    if (!el) mount();
    inline = true;
    if (el.parentNode !== node) node.appendChild(el);
    el.classList.add('sp--in');
    open();
  }
  function open() {
    // Ayuda vive en Asistente: cualquier entrada (buscador, perfil, la campana de soporte) va a esa pantalla
    const sinSesion = document.getElementById('login-screen')?.classList.contains('active');
    if (!inline && window.UkuAsistente && !sinSesion) return UkuAsistente.ayuda();
    if (!el) mount();
    if (!withAgent) reset(); // con un asesor conectado, la conversación sigue
    if (!withAgent) el.querySelector('.sp-body').scrollTop = 0;
    // Dentro de Asistente no es una capa: no usa .open (que empuja la página de abajo)
    if (inline) el.classList.add('sp--on'); else { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
    fx('open');
  }
  // Volver: del chat al inicio de Ayuda; desde ahí, cerrar
  function back() {
    if (el.classList.contains('is-page')) { hidePage(); el.querySelector('.sp-body').scrollTop = 0; return; }
    if (el.classList.contains('is-chat') && !withAgent) { reset(); el.querySelector('.sp-body').scrollTop = 0; return; }
    close();
  }
  function close() {
    // En Asistente, cerrar Ayuda es volver a Uku (la pantalla no se quita)
    if (inline) { document.dispatchEvent(new CustomEvent('soporte:cerrar')); return; }
    el.classList.remove('open');
    if (!document.querySelector('.as-page.open, .push-page.open, .card-detail.open')) document.body.style.overflow = '';
    fx('close');
  }

  // El ícono de soporte (audífonos) y "Ayuda" del Perfil abren esta pantalla
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-action="Revisar consumo"]');
    if (r) { e.stopImmediatePropagation(); e.preventDefault(); review(false); return; }
    var b = e.target.closest('[data-action="Soporte"], [data-action="Ayuda"]');
    if (!b || (el && el.contains(b))) return;
    e.stopImmediatePropagation(); e.preventDefault();
    open();
  }, true);

  window.Soporte = { open: open, into: into, review: function () { review(false); }, find: find,
    faqs: function (n) { return FAQ.slice(0, n || FAQ.length).map(function (f, i) { return { kind: 'faq', i: i, icon: f.icon, t: f.t }; }); },
    // Para que Uku responda la ayuda dentro de su conversación (versión asistente)
    faq: function (i) { var f = FAQ[i]; return f && { t: f.t, icon: f.icon, cat: f.cat, a: typeof f.a === 'function' ? f.a() : f.a, acts: f.acts || [] }; },
    faqIndex: function (t) { for (var i = 0; i < FAQ.length; i++) if (FAQ[i].t === t) return i; return -1; },
    tema: tema, temaDe: function (i) { var x = TEMAS[i]; return x && { t: x.t, a: x.a, mas: x.mas, acts: x.acts || [], links: x.links || [] }; }, buscarURL: buscarURL, blogURL: BLOG_URL,
    flows: function () { return FLOWS.map(function (f, i) { return { i: i, id: f.id, icon: f.icon, t: f.t }; }); },
    tuts: function () { return TUT.map(function (u, i) { return { i: i, icon: u.icon, t: u.t, pasos: u.steps.length, min: u.min }; }); },
    flow: function (i) { var f = FLOWS[i]; return f && { i: i, id: f.id, icon: f.icon, t: f.t, s: f.s }; },
    cats: function () { return CATS.map(function (c) { return { id: c[0], icon: c[1], t: c[2], n: FAQ.filter(function (f) { return f.cat === c[0]; }).length + TUT.filter(function (u) { return u.cat === c[0]; }).length }; }); },
    byCat: function (id) { return FAQ.map(function (f, i) { return f.cat === id ? { kind: 'faq', i: i, icon: f.icon, t: f.t } : null; }).filter(Boolean).concat(TUT.map(function (u, i) { return u.cat === id ? { kind: 'tut', i: i, icon: u.icon, t: u.t } : null; }).filter(Boolean)); },
    tut: function (i) { var u = TUT[i]; return u && { t: u.t, icon: u.icon, min: u.min, steps: u.steps, act: u.act }; },
    contact: function () { return { phone: PHONE, caso: CASE, agente: AGENT, respuestas: AGENT_REPLIES, opts: CONTACT.map(function (c) { return { icon: c[0], t: c[1], s: c[2], k: c[3] }; }) }; },
    // Ejecuta una acción de la ayuda (ir a un flujo, a una tarjeta, pedir revisión o pasar con un asesor)
    run: function (k) {
      if (k === 'review') return review(true);
      if (k === 'agent') { open(); topic = topic || 'Consulta desde Uku'; return toAgent(); }
      var go = function (fn) { setTimeout(fn, 60); };
      if (k.indexOf('do:') === 0) return go(function () { var x = document.querySelector('#home-page [data-action="' + k.slice(3) + '"]') || document.querySelector('[data-action="' + k.slice(3) + '"]'); if (x) x.click(); });
      if (k.indexOf('card:') === 0) return go(function () { if (window.__goView) window.__goView(0); var r = document.querySelector('#home-page [data-panel="Tarjetas"] .product-row[data-action="' + k.slice(5) + '"]'); if (r) r.click(); });
      if (k.indexOf('tab:') === 0) return go(function () { if (window.__goView) window.__goView(0); var t = document.querySelector('.tabs .tab[data-panel="' + k.slice(4) + '"]'); if (t) t.click(); });
      if (k === 'pfm') return window.Asistente && Asistente.openPF();
      if (k === 'sol' || k === 'handoff') return window.UkuAsistente && UkuAsistente[k === 'sol' ? 'solicitudes' : 'persona'] && UkuAsistente[k === 'sol' ? 'solicitudes' : 'persona']();
    },
    openFaq: function (i) { if (window.UkuAsistente && UkuAsistente.faq) return UkuAsistente.faq(i); open(); answer(i); },
    openTut: function (i) { if (window.UkuAsistente && UkuAsistente.tut) return UkuAsistente.tut(i); open(); tutPage(i); } };
})();
