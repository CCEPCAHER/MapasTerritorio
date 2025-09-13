document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO DE LA APLICACIÓN ---
    let territories = [];
    let isDrawing = false;
    let currentPoints = [];
    let tempDrawingLayer = null;
    let isExporting = false;
    
    // --- CONSTANTES DE CONFIGURACIÓN ---
    const MAP_INITIAL_VIEW = { center: [41.3851, 2.1701], zoom: 15 };
    const CARD_WIDTH_CM = 12;
    const CARD_HEIGHT_CM = 8;
    const DPI = 96; // Pixels per inch
    const CM_TO_INCH = 1 / 2.54;
    const CARD_WIDTH_PX = Math.round(CARD_WIDTH_CM * CM_TO_INCH * DPI);
    const CARD_HEIGHT_PX = Math.round(CARD_HEIGHT_CM * CM_TO_INCH * DPI);

    // --- INICIALIZACIÓN DEL MAPA ---
    const map = L.map('map', {
        rotate: true,
        touchRotate: true,
        zoomControl: false,
    }).setView(MAP_INITIAL_VIEW.center, MAP_INITIAL_VIEW.zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        crossOrigin: true
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.rotate({ position: 'bottomright' }).addTo(map);

    // --- REFERENCIAS AL DOM ---
    const startDrawingBtn = document.getElementById('startDrawingBtn');
    const saveTerritoryBtn = document.getElementById('saveTerritoryBtn');
    const undoPointBtn = document.getElementById('undoPointBtn');
    const cancelDrawingBtn = document.getElementById('cancelDrawingBtn');
    const resetAllBtn = document.getElementById('resetAllBtn');
    const colorPicker = document.getElementById('colorPicker');
    const territoryList = document.getElementById('territoryList');
    const noTerritoriesMessage = document.getElementById('noTerritoriesMessage');
    const loader = document.getElementById('loader');
    const toggleControlsBtn = document.getElementById('toggleControlsBtn');
    const controlPanel = document.getElementById('controlPanel');
    
    // --- FUNCIONES DE UI ---

    const updateUIState = () => {
        const hasTerritories = territories.length > 0;
        noTerritoriesMessage.style.display = hasTerritories ? 'none' : 'block';
        territoryList.style.display = hasTerritories ? 'block' : 'none';
        resetAllBtn.disabled = !hasTerritories && !isDrawing;

        if (isDrawing) {
            startDrawingBtn.textContent = "Dibujando...";
            startDrawingBtn.disabled = true;
            cancelDrawingBtn.disabled = false;
            saveTerritoryBtn.disabled = currentPoints.length < 2;
            undoPointBtn.disabled = currentPoints.length === 0;
            map.getContainer().style.cursor = 'crosshair';
        } else {
            startDrawingBtn.textContent = "Iniciar Dibujo";
            startDrawingBtn.disabled = false;
            cancelDrawingBtn.disabled = true;
            saveTerritoryBtn.disabled = true;
            undoPointBtn.disabled = true;
            map.getContainer().style.cursor = '';
        }
    };

    const renderTerritoryList = () => {
        territoryList.innerHTML = '';
        territories.forEach(territory => {
            const li = document.createElement('li');
            li.className = 'territory-item';
            li.innerHTML = `
                <span class="territory-name" data-id="${territory.id}">${territory.name}</span>
                <div class="territory-actions">
                    <button class="btn-export" title="Exportar a PDF" data-id="${territory.id}">📄</button>
                    <button class="btn-delete" title="Eliminar" data-id="${territory.id}">🗑️</button>
                </div>
            `;
            territoryList.appendChild(li);
        });
        updateUIState();
    };

    toggleControlsBtn.addEventListener("click", () => {
        controlPanel.classList.toggle("collapsed");
    });

    // --- LÓGICA DE DIBUJO ---
    
    const drawTemporaryShape = () => {
        if (tempDrawingLayer) map.removeLayer(tempDrawingLayer);
        const style = { color: colorPicker.value, weight: 3, opacity: 0.7, dashArray: '5, 5' };

        if (currentPoints.length >= 2) {
            tempDrawingLayer = L.polyline(currentPoints, style).addTo(map);
        }
        if (currentPoints.length >= 3) {
            const polygonPoints = [...currentPoints, currentPoints[0]]; // Cerrar visualmente
            tempDrawingLayer = L.polygon(currentPoints, { ...style, fillOpacity: 0.2, fillColor: colorPicker.value }).addTo(map);
        }
    };

    map.on('click', (e) => {
        if (!isDrawing) return;
        currentPoints.push(e.latlng);
        drawTemporaryShape();
        updateUIState();
    });

    startDrawingBtn.addEventListener('click', () => {
        isDrawing = true;
        currentPoints = [];
        updateUIState();
    });


    const cancelDrawing = () => {
        isDrawing = false;
        currentPoints = [];
        if (tempDrawingLayer) {
            map.removeLayer(tempDrawingLayer);
            tempDrawingLayer = null;
        }
        updateUIState();
    };
    cancelDrawingBtn.addEventListener('click', cancelDrawing);

    undoPointBtn.addEventListener('click', () => {
        if (currentPoints.length > 0) {
            currentPoints.pop();
            drawTemporaryShape();
            updateUIState();
        }
    });
    
    saveTerritoryBtn.addEventListener('click', () => {
        if (currentPoints.length < 3) {
            alert("Un territorio debe tener al menos 3 puntos para formar un área.");
            return;
        }

        const territoryName = prompt("Introduce un nombre para este territorio:", `Territorio ${territories.length + 1}`);
        if (!territoryName) return;

        const color = colorPicker.value;
        const finalLayer = L.polygon(currentPoints, {
            color: color,
            weight: 3,
            opacity: 1,
            fillColor: color,
            fillOpacity: 0.3
        }).addTo(map);
        
        const newTerritory = {
            id: Date.now(),
            name: territoryName,
            color: color,
            layer: finalLayer,
            geojson: finalLayer.toGeoJSON()
        };

        territories.push(newTerritory);
        renderTerritoryList();
        cancelDrawing();
    });

    // --- GESTIÓN DE TERRITORIOS ---

    territoryList.addEventListener('click', (e) => {
        const target = e.target;
        const id = Number(target.dataset.id);

        if (target.classList.contains('territory-name')) {
            const territory = territories.find(t => t.id === id);
            if (territory) map.fitBounds(territory.layer.getBounds(), { padding: [50, 50] });
        }
        if (target.classList.contains('btn-export')) {
            initiateExport(id);
        }
        if (target.classList.contains('btn-delete')) {
            if (confirm("¿Estás seguro de que quieres eliminar este territorio?")) {
                const index = territories.findIndex(t => t.id === id);
                if (index > -1) {
                    map.removeLayer(territories[index].layer);
                    territories.splice(index, 1);
                    renderTerritoryList();
                }
            }
        }
    });

    resetAllBtn.addEventListener('click', () => {
        if (confirm("¿Estás seguro? Se eliminarán TODOS los territorios del mapa y de la lista.")) {
            territories.forEach(t => map.removeLayer(t.layer));
            territories = [];
            cancelDrawing();
            renderTerritoryList();
        }
    });

    // --- LÓGICA DE EXPORTACIÓN ---

    async function initiateExport(territoryId) {
        if (isExporting) return;
        isExporting = true;
        loader.classList.remove('loader-hidden');

        try {
            const territory = territories.find(t => t.id === territoryId);
            if (!territory) throw new Error("Territorio no encontrado");

            // 1. Generar la imagen del mapa
            const mapImageBase64 = await createMapImage(territory);

            // 2. Preparar el HTML de la tarjeta
            const cardContainer = await createCardHTML(territory, mapImageBase64);
            document.body.appendChild(cardContainer); // Añadir al DOM para que html2canvas lo vea

            // 3. Capturar la tarjeta como canvas y generar PDF
            const canvas = await html2canvas(cardContainer.querySelector('.card-container'), { scale: 3, useCORS: true });
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: [CARD_WIDTH_CM * 10, CARD_HEIGHT_CM * 10]
            });
            pdf.addImage(canvas.toDataURL('image/png', 1.0), "PNG", 0, 0, CARD_WIDTH_CM * 10, CARD_HEIGHT_CM * 10);
            pdf.save(`Territorio_${territory.name.replace(/ /g, '_')}.pdf`);
            
            // 4. Limpieza
            document.body.removeChild(cardContainer);

        } catch (error) {
            console.error("Error durante la exportación:", error);
            alert("Ha ocurrido un error al exportar el territorio.");
        } finally {
            isExporting = false;
            loader.classList.add('loader-hidden');
        }
    }

    async function createMapImage(territory) {
    const container = document.createElement('div');
    // Usamos dimensiones un poco mayores para capturar con más calidad y luego escalar
    container.style.width = `${CARD_WIDTH_PX}px`; 
    container.style.height = `${CARD_HEIGHT_PX}px`;
    container.style.position = 'absolute';
    container.style.left = '-9999px'; // Fuera de pantalla
    document.body.appendChild(container);

    const tempMap = L.map(container, {
        attributionControl: false,
        zoomControl: false,
        preferCanvas: true,
        fadeAnimation: false,
        zoomAnimation: false,
    });

    // Usamos una promesa para esperar a que las imágenes del mapa carguen de verdad
    await new Promise(resolve => {
        const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 20,
            crossOrigin: 'anonymous' // 'anonymous' es más explícito que true
        }).addTo(tempMap);

        // Cuando la capa de mapas termina de cargar, resolvemos la promesa
        tileLayer.on('load', () => {
            console.log("Tiles cargados.");
            setTimeout(resolve, 500); // Damos 500ms extra para el renderizado final
        });
        
        // Un fallback por si el evento 'load' no se dispara en 4 segundos
        setTimeout(resolve, 4000); 
    });

    L.geoJSON(territory.geojson, {
        style: { color: territory.color, weight: 4, fillOpacity: 0.3 }
    }).addTo(tempMap);

    tempMap.fitBounds(territory.layer.getBounds(), { padding: [20, 20], animate: false });
    
    // Esperamos un momento a que 'fitBounds' se complete visualmente
    await new Promise(r => setTimeout(r, 200)); 

    console.log("Iniciando captura con html2canvas...");
    const canvas = await html2canvas(container, {
        // --- CAMBIOS CLAVE AQUÍ ---
        useCORS: true,      // Obliga a usar CORS para cargar las imágenes del mapa.
        allowTaint: true,   // Permite que imágenes de otros dominios "manchen" el canvas. Esta es la solución principal.
        logging: true       // Activamos los logs en la consola para ver qué está haciendo html2canvas.
    });

    console.log("Captura finalizada.");
    tempMap.remove();
    document.body.removeChild(container);
    return canvas.toDataURL('image/png');
}
async function createCardHTML(territory, mapImageBase64) {
    // Pide el contenido del archivo de la plantilla
    const response = await fetch('tarjeta.html');
    const templateHtml = await response.text();

    const cardContainer = document.createElement('div');
    cardContainer.style.position = 'absolute';
    cardContainer.style.left = '-9999px'; // Fuera de pantalla
    cardContainer.innerHTML = templateHtml;

    // Carga el CSS de la tarjeta para que html2canvas lo aplique
    const style = document.createElement('style');
    const cssResponse = await fetch('tarjeta.css');
    style.textContent = await cssResponse.text();
    cardContainer.appendChild(style); // Se añade directamente al contenedor

    // Rellena los datos en la plantilla
    cardContainer.querySelector('#territory-name').textContent = territory.name;
    cardContainer.querySelector('#generation-date').textContent = new Date().toLocaleDateString();
    
    const mapImg = document.createElement('img');
    mapImg.src = mapImageBase64;
    
    const mapPlaceholder = cardContainer.querySelector('#map-placeholder');
    mapPlaceholder.innerHTML = ''; // Limpiamos el placeholder
    mapPlaceholder.appendChild(mapImg);
    
    return cardContainer;
}


    // --- Inicialización de la UI ---
    renderTerritoryList();
});
