/* =========================================================================
   🟢 MENÚ PÍLDORA — comportamiento
   =========================================================================
   Cuatro cosas: abrir/cerrar la píldora (PC), abrir/cerrar el panel lateral
   (hasta 900px), el roll de letras del hover, y dejar que la página le diga
   de qué color va (data-theme).

   Va en archivo aparte y no inline como el resto de los scripts del proyecto
   porque el menú es chrome compartido: index.html y legal.html montan el mismo
   marcado, y tener la lógica duplicada en los dos archivos es justo el
   problema que ya arrastran limpiarSplineViewer() y ocultarLogosSpline().

   Los estilos viven en los bloques MENÚ PÍLDORA y PANEL LATERAL de style.css.
   Este archivo solo pone/quita .is-open, el alto abierto, el .active del panel
   y su velo, y el data-theme que le pidan.
   ========================================================================= */
(() => {
    const menuRoot = document.querySelector('.menu');
    if (!menuRoot) return;

    const menuShell = menuRoot.querySelector('.menu__shell');
    const menuBar = menuRoot.querySelector('.menu__bar');
    const menuList = menuRoot.querySelector('.menu__items');
    const menuItems = [...menuRoot.querySelectorAll('.menu__item')];

    // 🔤 Parte el texto en letras duplicadas (una arriba y otra abajo) para que
    // el hover pueda subir la columna. El aria-label deja la palabra entera
    // para los lectores de pantalla, que si no leerían "IINNIICCIIOO".
    // Solo se vacía .menu__text: el icono es hermano y se arma aparte.
    //
    // Las letras arrancan en --c 1 porque el cuadro 0 es el icono.
    function armarLetras(link) {
        const destino = link.querySelector('.menu__text');
        if (!destino) return;

        const etiqueta = destino.textContent.trim();
        destino.textContent = '';
        link.setAttribute('aria-label', etiqueta);

        [...etiqueta].forEach((letra, i) => {
            if (letra === ' ') {
                const espacio = document.createElement('span');
                espacio.className = 'menu__space';
                destino.appendChild(espacio);
                return;
            }

            const caja = document.createElement('span');
            caja.className = 'menu__char';
            caja.style.setProperty('--c', i + 1);

            const rollo = document.createElement('span');
            rollo.className = 'menu__roll';
            rollo.appendChild(Object.assign(document.createElement('span'), { textContent: letra }));
            rollo.appendChild(Object.assign(document.createElement('span'), { textContent: letra }));

            caja.appendChild(rollo);
            destino.appendChild(caja);
        });
    }

    // 🎨 El icono usa exactamente el mismo mecanismo que una letra: una columna
    // con dos copias del SVG que sube 50% en el hover. Se duplica acá y no en el
    // HTML para no tener el mismo dibujo escrito dos veces por link.
    //
    // Queda en --c 0, o sea que es el primero de la ola: el icono sale y atrás
    // van entrando las letras de izquierda a derecha.
    function armarIcono(link) {
        const caja = link.querySelector('.menu__ico');
        const svg = caja?.querySelector('svg');
        if (!svg) return;

        // Las copias se toman ANTES de vaciar la caja. Sacar el SVG del DOM no
        // invalida la referencia, así que el original se puede reusar.
        const copias = [svg, svg.cloneNode(true)];
        caja.replaceChildren();

        const rollo = document.createElement('span');
        rollo.className = 'menu__roll';
        copias.forEach((copia) => {
            const celda = document.createElement('span');
            celda.appendChild(copia);
            rollo.appendChild(celda);
        });

        caja.style.setProperty('--c', 0);
        caja.appendChild(rollo);
    }

    // 📱 Hasta 900px la píldora no se estira: abre el panel lateral, el mismo
    // del catálogo (<aside class="sidebar-catalog--derecha">, hermano de .menu).
    // Mismo corte que el del catálogo y que el resto del sitio.
    const esPanel = window.matchMedia('(max-width: 900px)');
    const panel = document.querySelector('.sidebar-catalog--derecha');
    const velo = document.querySelector('.sidebar-overlay');
    const panelCerrar = panel?.querySelector('.sidebar-close-btn');

    // 🖥️ PC: la píldora se estira en su sitio.
    function abrirMenu(abierto) {
        menuRoot.classList.toggle('is-open', abierto);
        menuBar.setAttribute('aria-expanded', String(abierto));
        // Cerrado, los links no deben ser enfocables con Tab.
        menuList.inert = !abierto;
        // Alto medido en vez de fijo: si algún día se agrega o quita un link, la
        // animación sigue cerrando justo.
        menuShell.style.height = abierto
            ? `${menuBar.offsetHeight + menuList.offsetHeight}px`
            : '';
    }

    const panelAbierto = () => Boolean(panel?.classList.contains('active'));

    // 🚪 Celular y tablet: el panel lateral. Toma el color de la píldora en el
    // momento de abrir; mientras está abierto la página no scrollea, así que la
    // sección de atrás (y con ella el tema) no cambia. Solo se copia al abrir y
    // no en cada setTema() para que no cambie de color mientras sale.
    function abrirPanel(abierto) {
        if (!panel) return;
        if (abierto) panel.dataset.theme = menuRoot.dataset.theme || 'claro';
        // Si el foco estaba dentro (la X, un link, Escape), vuelve a la píldora.
        const focoDentro = panel.contains(document.activeElement);

        panel.classList.toggle('active', abierto);
        velo?.classList.toggle('active', abierto);
        panel.inert = !abierto;
        menuBar.setAttribute('aria-expanded', String(abierto));
        document.body.classList.toggle('menu-abierto', abierto);

        if (abierto) panelCerrar?.focus({ preventScroll: true });
        else if (focoDentro) menuBar.focus({ preventScroll: true });
    }

    menuItems.forEach((link, i) => {
        link.style.setProperty('--i', i);
        armarIcono(link);
        armarLetras(link);

        // Bloqueo del roll: si el mouse sale a mitad de la animación, la salida
        // se retiene hasta que termina. Si no, la columna pega un salto feo al
        // volver a su lugar. El +1 es el icono, que también ocupa un lugar en la ola.
        const cerrojo = 30 * (link.querySelectorAll('.menu__char').length + 1) + 300;
        let temporizador = 0;
        let salidaPendiente = false;

        link.addEventListener('mouseenter', () => {
            salidaPendiente = false;
            if (link.classList.contains('is-rolling')) return;
            link.classList.add('is-rolling');
            temporizador = window.setTimeout(() => {
                temporizador = 0;
                if (salidaPendiente) {
                    salidaPendiente = false;
                    link.classList.remove('is-rolling');
                }
            }, cerrojo);
        });

        link.addEventListener('mouseleave', () => {
            if (temporizador) salidaPendiente = true;
            else link.classList.remove('is-rolling');
        });

        link.addEventListener('click', () => abrirMenu(false));
    });

    menuBar.addEventListener('click', () => {
        if (esPanel.matches && panel) abrirPanel(!panelAbierto());
        else abrirMenu(!menuRoot.classList.contains('is-open'));
    });

    // Se cierra con la X, tocando el velo o tocando un link (como el catálogo).
    panelCerrar?.addEventListener('click', () => abrirPanel(false));
    velo?.addEventListener('click', () => abrirPanel(false));
    panel?.querySelectorAll('.sidebar-links a').forEach((link) => {
        link.addEventListener('click', () => abrirPanel(false));
    });

    // "Click afuera" de la píldora estirada (solo PC). El panel lateral vive
    // FUERA de .menu, pero nunca llega aquí abierto: en modo panel .menu no
    // lleva .is-open, y su propio cierre va por la X, el velo y los links.
    document.addEventListener('mousedown', (e) => {
        if (menuRoot.classList.contains('is-open') && !menuRoot.contains(e.target)) {
            abrirMenu(false);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (panelAbierto()) {
            abrirPanel(false);
            menuBar.focus({ preventScroll: true });
        } else if (menuRoot.classList.contains('is-open')) {
            abrirMenu(false);
            menuBar.focus();
        }
    });

    // La píldora controla la lista de links en PC y el panel en celular.
    function sincronizarModo() {
        if (panel) menuBar.setAttribute('aria-controls', esPanel.matches ? panel.id : menuList.id);
    }

    // Al cruzar los 900px el menú cambia de forma (píldora <-> panel): abierto
    // quedaría a medio camino. Se cierra y listo.
    esPanel.addEventListener('change', () => {
        abrirMenu(false);
        abrirPanel(false);
        sincronizarModo();
    });

    abrirMenu(false);
    abrirPanel(false);
    sincronizarModo();

    // 🎨 Puerta para que la página diga de qué color va la píldora. index.html la
    // llama desde su bucle de scroll; legal.html, desde el script de su footer
    // (clara sobre la página blanca, oscura sobre el footer). Se compara antes de escribir para no
    // reiniciar la transición de color en cada fotograma.
    window.anxieMenu = {
        setTema(tema) {
            if (menuRoot.dataset.theme !== tema) menuRoot.dataset.theme = tema;
        },
    };
})();
