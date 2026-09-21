/* =========================================================================
   🟢 MENÚ PÍLDORA — comportamiento
   =========================================================================
   Tres cosas: abrir/cerrar la píldora, el roll de letras del hover, y dejar
   que la página le diga de qué color va (data-theme).

   Va en archivo aparte y no inline como el resto de los scripts del proyecto
   porque el menú es chrome compartido: index.html y legal.html montan el mismo
   marcado, y tener la lógica duplicada en los dos archivos es justo el
   problema que ya arrastran limpiarSplineViewer() y ocultarLogosSpline().

   Los estilos viven en el bloque MENÚ PÍLDORA de style.css. Este archivo solo
   pone/quita .is-open, el alto abierto, y el data-theme que le pidan.
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

    // 📱 En celular el menú no es la píldora que se estira, sino un panel lateral
    // de alto completo: ahí el alto lo pone el CSS y medirlo a mano lo rompería.
    // Mismo breakpoint que el @media del CSS.
    const esPanel = window.matchMedia('(max-width: 640px)');

    function abrirMenu(abierto) {
        menuRoot.classList.toggle('is-open', abierto);
        menuBar.setAttribute('aria-expanded', String(abierto));
        // Cerrado, los links no deben ser enfocables con Tab.
        menuList.inert = !abierto;
        // Alto medido en vez de fijo: si algún día se agrega o quita un link, la
        // animación sigue cerrando justo. En el panel lateral, no: se deja vacío
        // para que mande el height: 100% del CSS.
        menuShell.style.height = abierto && !esPanel.matches
            ? `${menuBar.offsetHeight + menuList.offsetHeight}px`
            : '';
        // Enciende el velo y frena el scroll de la página detrás del panel.
        document.body.classList.toggle('menu-abierto', abierto && esPanel.matches);
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
        abrirMenu(!menuRoot.classList.contains('is-open'));
    });

    document.addEventListener('mousedown', (e) => {
        if (menuRoot.classList.contains('is-open') && !menuRoot.contains(e.target)) {
            abrirMenu(false);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuRoot.classList.contains('is-open')) {
            abrirMenu(false);
            menuBar.focus();
        }
    });

    // Al cruzar el breakpoint el menú cambia de forma (píldora <-> panel):
    // abierto quedaría a medio camino, con el alto inline de la otra versión.
    // Se cierra y listo.
    esPanel.addEventListener('change', () => abrirMenu(false));

    abrirMenu(false);

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
