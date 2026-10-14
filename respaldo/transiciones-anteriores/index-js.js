/* JS de transiciones reemplazadas por la navegación unificada
   (assets/navegacion.js). Venían del <script> de index.html. */

// Detalle de tarjeta: morph desde la tarjeta de Destacado
        /*
         * Morph "reveal" entre la tarjeta de Destacado y la de detalle: NO
         * es un scale() (eso estiraba la imagen no-uniformemente, como
         * antes) NI tampoco anima width/height directamente. width/height
         * son propiedades de LAYOUT: animarlas fuerza un recálculo de
         * layout en cada frame (reflow), lo cual en un teléfono real —a
         * diferencia de este navegador de escritorio— se nota como un
         * recorrido con saltos/tirones en vez de fluido.
         *
         * En su lugar se usa clip-path (+ transform:translate para la
         * posición): cdCard se queda SIEMPRE en su tamaño natural completo
         * en el layout — nunca cambia de tamaño de verdad — y sólo se
         * recorta visualmente con clip-path desde/hacia la ventana del
         * tamaño de Destacado. clip-path y transform son ambas propiedades
         * que el compositor anima sin tocar layout, así el recorrido es
         * tan fluido como cualquier transform puro. De paso, clip-path
         * inset() acepta su propio radio ("round"), así que la esquina de
         * 8px (Destacado) a 12px (detalle) se interpola como parte de la
         * misma animación, sin quedar a medio camino en un valor raro.
         */
        function morphMetrics() {
            // Transición unificada: el detalle entra desde la derecha como
            // todas las pantallas (ver navegacion.js), sin morph de tarjeta.
            return null;
            const feat = currentOriginEl.getBoundingClientRect();
            const rect = cdCard.getBoundingClientRect(); // ya en su layout final/natural
            if (!rect.width || !feat.width) return null;
            // El radio del origen puede variar (8px la tarjeta destacada de
            // Destacado, 6px un card-thumb de Tarjetas): se lee del propio
            // elemento en vez de asumir siempre el mismo valor.
            const originRadius = parseFloat(getComputedStyle(currentOriginEl).borderRadius) || FEAT_RADIUS;
            return {
                dx: feat.left - rect.left,
                dy: feat.top - rect.top,
                clipRight: Math.max(0, rect.width - feat.width),
                clipBottom: Math.max(0, rect.height - feat.height),
                originRadius,
            };
        }

        // Deben calzar con --bp-radius-sm / --bp-radius-md en :root.
        const FEAT_RADIUS = 8;
        const DETAIL_RADIUS = 12;
        function clipToFeatured(m) {
            return `inset(0px ${m.clipRight}px ${m.clipBottom}px 0px round ${m.originRadius}px)`;
        }
        const CLIP_FULL = `inset(0px round ${DETAIL_RADIUS}px)`;

        // Ancla el origen de la animación del panel (.card-detail.entering /
        // .closing) al centro real del elemento que abrió el detalle
        // (currentOriginEl) en pantalla, para que "crezca" desde ahí como
        // una wallet en vez de desde el centro genérico de la pantalla. Si
        // no es medible (raro), se quita la propiedad y CSS cae a su
        // default (50% 15%).
        function setMorphOrigin() {
            const feat = currentOriginEl.getBoundingClientRect();
            if (!feat.width) {
                cardDetail.style.removeProperty('--cd-origin-x');
                cardDetail.style.removeProperty('--cd-origin-y');
                return;
            }
            const ox = ((feat.left + feat.width / 2) / window.innerWidth * 100).toFixed(2) + '%';
            const oy = ((feat.top + feat.height / 2) / window.innerHeight * 100).toFixed(2) + '%';
            cardDetail.style.setProperty('--cd-origin-x', ox);
            cardDetail.style.setProperty('--cd-origin-y', oy);
        }

        // Curva tipo iOS para el morph. Una sola duración (0.5s abrir / 0.42s
        // cerrar) para el panel completo, la tarjeta compartida (FLIP) y el
        // home de fondo: antes cada pieza corría con su propio tiempo
        // (fade del panel 0.25s, tarjeta 0.52s, contenido 0.28s) y llegaban
        // a destino en momentos distintos, lo que se sentía torpe/descosido.
        const MORPH_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
        const OPEN_MS = 500;
        const CLOSE_MS = 420;

        function openCardDetail(key = 'Visa Débito', originEl = featCard) {
            currentOriginEl = originEl || featCard;
            fx('open');
            applyCardTheme(key);
            hideCardData();
            cardDetail.classList.remove('scrolled', 'no-morph');
            setMorphOrigin(); // con la tarjeta/thumb aún en su lugar de origen
            cardDetail.classList.add('open', 'entering');
            document.body.classList.add('card-detail-active'); // el home recede detrás
            cardDetail.scrollTop = 0;
            document.body.style.overflow = 'hidden';

            // La tarjeta arranca recortada al tamaño/posición/radio de
            // Destacado y se revela hacia su forma completa (ver comentario
            // de morphMetrics: clip-path + translate, nunca width/height).
            const m = morphMetrics();
            if (m) {
                cardDetail.classList.add('morphing');
                cdCard.style.transition = 'none';
                cdCard.style.transform = `translate(${m.dx}px, ${m.dy}px)`;
                cdCard.style.clipPath = clipToFeatured(m);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    cdCard.style.transition = `transform ${OPEN_MS}ms ${MORPH_EASE}, clip-path ${OPEN_MS}ms ${MORPH_EASE}`;
                    cdCard.style.transform = 'translate(0, 0)';
                    cdCard.style.clipPath = CLIP_FULL;
                }));
                // El contenido (título/acciones) arranca un poco después que
                // el panel y la tarjeta, para que estas "lideren" el
                // movimiento — pero termina junto con ellas.
                setTimeout(() => cardDetail.classList.remove('morphing'), 90);
                setTimeout(() => {
                    cardDetail.classList.remove('entering');
                    cdCard.style.transition = '';
                    cdCard.style.transform = '';
                    cdCard.style.clipPath = '';
                }, OPEN_MS + 40);
            } else {
                // Sin tarjeta medible que morphear: el panel entero hace un
                // crecimiento simple (scale+translate) en vez de sólo fade.
                cardDetail.classList.add('no-morph');
                cardDetail.classList.remove('morphing');
                setTimeout(() => cardDetail.classList.remove('entering', 'no-morph'), OPEN_MS + 40);
            }
        }

        function closeCardDetail() {
            if (!cardDetail.classList.contains('open') || cardDetail.classList.contains('closing')) return;
            hideCardData(); // vuelve al frente antes de encoger
            cardDetail.classList.remove('scrolled', 'entering', 'no-morph');
            // el contenido se desvanece primero; la tarjeta encoge de vuelta
            // a la posición de Destacado; el panel sólo se desvanece detrás
            // (ver comentario en .card-detail.closing: si el panel TAMBIÉN
            // escalara/trasladara aquí, competiría con el propio movimiento
            // de la tarjeta y se vería doble/tosco). NO reseteamos el scroll
            // aquí (eso causaba el salto): se hace al final.
            cardDetail.classList.add('closing', 'morphing');
            document.body.classList.remove('card-detail-active'); // el home vuelve a su tamaño

            // Sólo hacemos el morph si la tarjeta está a la vista; si se hizo
            // scroll y quedó fuera, se cierra con un simple desvanecimiento
            // (y el panel encoge hacia el centro, no hacia un punto fuera de
            // pantalla, que se vería como si "saliera volando").
            const rect = cdCard.getBoundingClientRect();
            const inView = rect.bottom > 48 && rect.top < window.innerHeight - 48;
            const m = inView ? morphMetrics() : null;
            if (m) {
                setMorphOrigin();
                // clip-path parte de "sin recortar" (su valor por CSS es
                // "none", no animable de forma fiable) — igual que con
                // width/height antes, primero se fija el estado actual
                // (sin recorte, transition:none, un no-op visual ya que es
                // lo que ya se ve) y recién en el siguiente frame se anima
                // hacia el recorte de Destacado, así ambos extremos son
                // formas concretas.
                cdCard.style.transition = 'none';
                cdCard.style.clipPath = CLIP_FULL;
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    cdCard.style.transition = `transform ${CLOSE_MS}ms ${MORPH_EASE}, clip-path ${CLOSE_MS}ms ${MORPH_EASE}`;
                    cdCard.style.transform = `translate(${m.dx}px, ${m.dy}px)`;
                    cdCard.style.clipPath = clipToFeatured(m);
                }));
            } else {
                cardDetail.classList.add('no-morph');
                cardDetail.style.removeProperty('--cd-origin-x');
                cardDetail.style.removeProperty('--cd-origin-y');
            }

            setTimeout(() => {
                cardDetail.classList.remove('open', 'closing', 'morphing', 'no-morph');
                cdCard.style.transition = '';
                cdCard.style.transform = '';
                cdCard.style.clipPath = '';
                cdInner.style.transform = '';
                cdInner.style.opacity = '';
                cdInner.style.transition = '';
                cardDetail.scrollTop = 0; // reset ya oculto (sin salto)
                document.body.style.overflow = '';
                hideCardData();
            }, CLOSE_MS + 30);
        }


// closePushPage: rama de cierre que encogía la página hacia el botón
            if (pushPage.classList.contains('grow')) {
                // Encoge de vuelta hacia el botón
                pushPage.classList.add('closing-grow');
                pushPage.style.transform = 'scale(0.5)';
                pushPage.style.opacity = '0';
                const done = e => {
                    if (e && e.propertyName !== 'transform') return;
                    pushPage.removeEventListener('transitionend', done);
                    // Desactiva la transición ANTES de quitar clases: así la
                    // reversión al estado base (translateX(100%)) es instantánea
                    // y no se mezcla una segunda animación de slide con la escala.
                    pushPage.style.transition = 'none';
                    pushPage.classList.remove('open', 'grow', 'closing-grow');
                    pushPage.style.transform = '';
                    pushPage.style.opacity = '';
                    pushPage.style.transformOrigin = '';
                    pushPage.style.visibility = '';
                    void pushPage.offsetWidth; // reflow con transición desactivada
                    pushPage.style.transition = ''; // restaura para la próxima
                };
                pushPage.addEventListener('transitionend', done);
                setTimeout(done, 400); // fallback
            } else {
                pushPage.classList.remove('open'); // desliza de salida (visibility con delay)
            }
