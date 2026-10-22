# Orquestador de Uku

El chat de Uku no decide nada: manda lo que la persona escribe o toca al orquestador y dibuja lo que
responde. El orquestador elige la **habilidad** que atiende, esta usa **herramientas** para conocer a la
persona y devuelve **mensajes** con un contrato fijo. Destinos, tarifas y reglas viven en `config/`.

```
front (assets/orquestador.js) ──► worker.js (Pages, sin servidor)  ─┐
                               └─► POST /api/orquestador (server.js) ┴─► nucleo.js ─► habilidades/* ─► herramientas/*
```

## Contrato

**Petición** `{ usuario, texto? | accion?, consulta?: 'sugerencias', estado? }`

- `texto`: lo que escribió la persona. `accion`: el `id` del botón que tocó (`viaje.guardar`).
- `estado`: lo que devolvió la respuesta anterior. Es opaco para el front, como una sesión.

**Respuesta** `{ manejado, habilidad, mensajes, estado, efectos, sugerencias }`

- `manejado: false`: ninguna habilidad lo atiende; el front sigue con su respuesta de siempre.
- `mensajes[]`: `{ texto, titulo?, cifra?: { v, l }, barras?: [{ l, v }], filas?: [[k, v]],
  medidor?: { v, max, l, tono? }, medidores?: [{ l, v, max, d, tono }], acciones?: [{ id, texto, icono?,
  estilo: 'principal' | 'pregunta' }] }`. El front tiene un componente genérico para cada bloque.
- `efectos[]`: `{ tipo: 'animo', valor: 'happy' | 'talk' | 'worried' }` (Uku reacciona) y
  `{ tipo: 'aviso', texto }` (un aviso breve).
- `sugerencias[]`: lo que Uku muestra en Mis finanzas mientras algo está en marcha
  `{ id, etiqueta, texto, accion, accionTexto, icono, detalle }`.

## Cómo elige

1. Un botón: el prefijo de su `id` dice qué habilidad lo atiende.
2. Si una conversación espera una respuesta escrita («6 días, 3 personas»), esa habilidad la lee primero.
   Si no la entiende, sigue al paso 3.
3. La habilidad que mejor entiende el texto (`entiende(texto)` devuelve un puntaje).
4. Nadie: `manejado: false`.

## Habilidades

- **viaje** (`habilidades/viaje.js`, `config/viajes.json`): a dónde, cuántos días, con quién y cuándo →
  presupuesto específico del viaje → si no alcanza sin tocar ahorros ni el colchón de un mes, una meta (o
  completar la que ya existe); si alcanza, apartar el dinero → con la meta cumplida, el control del viaje:
  cuánto puedes gastar cada día, cada parte contra su presupuesto e imprevistos como reserva → un resumen al
  volver. En la demo, «Simular: pasan los meses», «Simular un gasto» y «Pasar al día siguiente» mueven el tiempo.

## Herramientas

- **finanzas** (`herramientas/finanzas.js`): cuenta, ahorro, inversiones, metas e ingreso y gasto promedio
  de la persona. Hoy lee `assets/pfm/datos.json`; en producción serían las APIs del banco.

## Agregar una habilidad

Un módulo con `{ id, entiende(t), atender(t, ctx), responder?(t, ctx), accion(a, ctx), sugerencias?(ctx) }`.
Se registra en `worker.js` y en `server.js`. `ctx` trae `usuario`, `estado` (el de la habilidad),
`herramientas`, `config` (su parte de `config/`), `hoy` y `norm`.

## Probar

- En el navegador: escribe en Uku «Quiero viajar a Galápagos».
- Con servidor: `node server.js` y en la app `localStorage.setItem('orq-url', 'http://localhost:8787/api/orquestador')`.
- `curl -X POST localhost:8787/api/orquestador -d '{"usuario":"andres","texto":"quiero viajar a cusco 4 días solo en marzo"}'`
