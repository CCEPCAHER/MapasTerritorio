document.addEventListener('DOMContentLoaded', () => {
    // --- Inicialización del Mapa Principal ---
    const map = L.map('map', {
        minZoom: 2,
        maxZoom: 20,
        rotate: true,
        touchRotate: true,
        zoomControl: false,
        rotateControl: false
    }).setView([41.3851, 2.1701], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: 0
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.rotate({ position: 'bottomright' }).addTo(map);

    // --- Variables de Estado y Globales ---
    let isMarking = false;
    let currentPoints = [];
    let allDrawnLayers = []; // Almacena objetos { layer: L.Layer, type: 'shape'/'label', ...otrosDatos }
    let tempDrawingLayer = null;
    let selectedColor = "#0078d4"; // Color por defecto
    let exportType = '';

    const DPI = 96;
    const CM_TO_INCH = 1 / 2.54;
    const EXPORT_WIDTH_CM = 12;
    const EXPORT_HEIGHT_CM = 8;
    const EXPORT_WIDTH_PX = Math.round(EXPORT_WIDTH_CM * CM_TO_INCH * DPI);
    const EXPORT_HEIGHT_PX = Math.round(EXPORT_HEIGHT_CM * CM_TO_INCH * DPI);
    const DEFAULT_LINE_WEIGHT = 3; // Grosor de línea por defecto para exportación/preview si no se especifica
    const PREVIEW_MAX_ZOOM = 17; // Zoom máximo para que las calles sean legibles en preview/export

    // --- Elementos del DOM (sin cambios) ---
    const startMarkingBtn = document.getElementById("startMarkingBtn");
    const saveShapeBtn = document.getElementById("saveShapeBtn");
    const undoPointBtn = document.getElementById("undoPointBtn");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    const exportJpgBtn = document.getElementById("exportJpgBtn");
    const resetBtn = document.getElementById("resetBtn");
    const colorPicker = document.getElementById("colorPicker");
    const labelTextInput = document.getElementById("labelText");
    const textAngleInput = document.getElementById("textAngle");
    const textSizeInput = document.getElementById("textSize");
    const toggleControlsBtn = document.getElementById("toggleControlsBtn");
    const controlPanel = document.getElementById("controlPanel");
    const previewModal = document.getElementById("previewModal");
    const previewImage = document.getElementById("previewImage");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const confirmExportBtn = document.getElementById("confirmExportBtn");
    const cancelExportBtn = document.getElementById("cancelExportBtn");
    const exportMapContainer = document.getElementById("exportMapContainer"); // Usado solo para exportación final

    // --- Funcionalidad del Panel de Control (Toggle) (sin cambios) ---
    const updateToggleBtnText = () => {
        if (window.innerWidth <= 480) {
            toggleControlsBtn.textContent = controlPanel.classList.contains("collapsed") ? "☰" : "×";
        } else {
            toggleControlsBtn.textContent = "☰";
        }
    };
    toggleControlsBtn.addEventListener("click", () => {
        controlPanel.classList.toggle("collapsed");
        updateToggleBtnText();
    });
    controlPanel.classList.add("collapsed");
    updateToggleBtnText();
    window.addEventListener('resize', updateToggleBtnText);

    // --- Selección de Color ---
    colorPicker.addEventListener("input", (e) => {
        selectedColor = e.target.value;
        if (tempDrawingLayer && isMarking && tempDrawingLayer instanceof L.Path) {
            tempDrawingLayer.setStyle({ color: selectedColor, fillColor: selectedColor }); // fillColor para CircleMarker temporal
        }
        // Actualizar color de las figuras ya dibujadas si se desea (más complejo, omitido por ahora)
    });

    // --- Lógica de Dibujo ---
    function drawTemporaryShape() {
        if (tempDrawingLayer) map.removeLayer(tempDrawingLayer);
        const commonStyle = { color: selectedColor, weight: DEFAULT_LINE_WEIGHT, opacity: 0.7 };

        if (currentPoints.length >= 3) {
            tempDrawingLayer = L.polygon(currentPoints, { ...commonStyle, fillOpacity: 0, dashArray: '5, 5' }).addTo(map);
        } else if (currentPoints.length === 2) {
            tempDrawingLayer = L.polyline(currentPoints, { ...commonStyle, dashArray: '5, 5' }).addTo(map);
        } else if (currentPoints.length === 1) {
            tempDrawingLayer = L.circleMarker(currentPoints[0], { ...commonStyle, radius: 6, fillOpacity: 0.3, fillColor: selectedColor }).addTo(map);
        } else {
            tempDrawingLayer = null;
        }
    }

    map.on("click", (e) => {
        if (!isMarking) return;
        if (e.originalEvent.target && e.originalEvent.target.closest && e.originalEvent.target.closest('.leaflet-interactive')) {
            return; // Evitar añadir puntos si se hizo clic en una figura interactiva
        }
        currentPoints.push(e.latlng);
        drawTemporaryShape();
        saveShapeBtn.disabled = currentPoints.length === 0;
        undoPointBtn.disabled = currentPoints.length === 0;
    });

    startMarkingBtn.addEventListener("click", () => {
        isMarking = true;
        currentPoints = [];
        if (tempDrawingLayer) map.removeLayer(tempDrawingLayer);
        tempDrawingLayer = null;
        startMarkingBtn.disabled = true;
        saveShapeBtn.disabled = true;
        undoPointBtn.disabled = true;
        map.getContainer().style.cursor = 'crosshair';
    });

    undoPointBtn.addEventListener("click", () => {
        if (currentPoints.length === 0) return;
        currentPoints.pop();
        drawTemporaryShape();
        saveShapeBtn.disabled = currentPoints.length === 0;
        undoPointBtn.disabled = currentPoints.length === 0;
    });

    function makePathDraggable(pathLayer, associatedLabelLayer) {
        // ... (código de makePathDraggable de la versión anterior, sin cambios funcionales directos aquí)
        if (!(pathLayer instanceof L.Path) || !pathLayer.getElement()) return;
        let initialPathLatLngs, startDragMouseLatLng, isDraggingThisPath = false;
        const pathElement = pathLayer.getElement();
        pathElement.style.cursor = 'grab';

        const onPathMouseDown = (e) => {
            if (isMarking) return;
            if (e.originalEvent.target !== pathElement && !pathElement.contains(e.originalEvent.target)) return;
            L.DomEvent.stopPropagation(e.originalEvent);
            isDraggingThisPath = true;
            map.dragging.disable();
            pathElement.style.cursor = 'grabbing'; map.getContainer().style.cursor = 'grabbing';
            startDragMouseLatLng = e.latlng;
            if (pathLayer instanceof L.Polygon || pathLayer instanceof L.Polyline) initialPathLatLngs = L.LatLngUtil.cloneLatLngs(pathLayer.getLatLngs());
            else if (pathLayer instanceof L.CircleMarker) initialPathLatLngs = L.latLng(pathLayer.getLatLng().lat, pathLayer.getLatLng().lng);
            L.DomEvent.on(document, 'mousemove', onDocumentMouseMove, this);
            L.DomEvent.on(document, 'mouseup', onDocumentMouseUp, this);
        };
        pathLayer.on('mousedown', onPathMouseDown);

        const onDocumentMouseMove = (e) => {
            if (!isDraggingThisPath) return;
            const currentMouseLatLng = map.mouseEventToLatLng(e);
            const latOffset = currentMouseLatLng.lat - startDragMouseLatLng.lat;
            const lngOffset = currentMouseLatLng.lng - startDragMouseLatLng.lng;
            if (pathLayer instanceof L.Polygon || pathLayer instanceof L.Polyline) {
                const moveLatLngsRecursively = (latlngs) => (Array.isArray(latlngs) && latlngs.length > 0 && latlngs[0] instanceof L.LatLng) ? latlngs.map(p => L.latLng(p.lat + latOffset, p.lng + lngOffset)) : (Array.isArray(latlngs) && latlngs.length > 0 && Array.isArray(latlngs[0])) ? latlngs.map(ring => moveLatLngsRecursively(ring)) : latlngs;
                pathLayer.setLatLngs(moveLatLngsRecursively(initialPathLatLngs));
            } else if (pathLayer instanceof L.CircleMarker) pathLayer.setLatLng(L.latLng(initialPathLatLngs.lat + latOffset, initialPathLatLngs.lng + lngOffset));
            if (associatedLabelLayer && associatedLabelLayer instanceof L.Marker) {
                let newLabelCenter = (pathLayer.getBounds && typeof pathLayer.getBounds === 'function') ? pathLayer.getBounds().getCenter() : pathLayer.getLatLng();
                associatedLabelLayer.setLatLng(newLabelCenter);
            }
        };
        const onDocumentMouseUp = () => {
            if (!isDraggingThisPath) return;
            L.DomEvent.off(document, 'mousemove', onDocumentMouseMove, this);
            L.DomEvent.off(document, 'mouseup', onDocumentMouseUp, this);
            isDraggingThisPath = false; map.dragging.enable();
            pathElement.style.cursor = 'grab'; map.getContainer().style.cursor = '';
        };
        pathLayer._dragHandlers = { mousedown: onPathMouseDown, docMouseMove: onDocumentMouseMove, docMouseUp: onDocumentMouseUp };
    }
    
    function removePathDragHandlers(pathLayer) {
        if (pathLayer && pathLayer._dragHandlers) {
            pathLayer.off('mousedown', pathLayer._dragHandlers.mousedown);
            // Asegurarse de quitar los listeners del document si aún estuvieran activos (aunque onDocumentMouseUp debería hacerlo)
            L.DomEvent.off(document, 'mousemove', pathLayer._dragHandlers.docMouseMove, this);
            L.DomEvent.off(document, 'mouseup', pathLayer._dragHandlers.docMouseUp, this);
            delete pathLayer._dragHandlers;
            if (pathLayer.getElement()) pathLayer.getElement().style.cursor = '';
        }
    }

    function createAndAddLabel(text, latLng, angle, size, color, existingLayerData = null) {
        const iconHtml = `<div style="transform: rotate(${angle}deg); font-size: ${size}px; color: ${color}; white-space: nowrap;">${text}</div>`;
        // Calcular tamaño del icono basado en el texto y tamaño de fuente
        const tempSpan = document.createElement('span');
        tempSpan.style.fontSize = `${size}px`;
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.style.visibility = 'hidden';
        tempSpan.innerHTML = text;
        document.body.appendChild(tempSpan);
        const textWidth = tempSpan.offsetWidth;
        const textHeight = tempSpan.offsetHeight;
        document.body.removeChild(tempSpan);
        const iconSize = L.point(textWidth + 10, textHeight + 4); // Añadir padding

        const labelIcon = L.divIcon({
            html: iconHtml,
            className: "custom-free-label",
            iconSize: iconSize,
            iconAnchor: L.point(iconSize.x / 2, iconSize.y / 2)
        });

        const labelMarker = L.marker(latLng, { icon: labelIcon, draggable: true }).addTo(map);
        
        let labelData;
        if (existingLayerData) { // Actualizando una capa existente
            labelData = existingLayerData;
            labelData.text = text; labelData.angle = angle; labelData.size = size; labelData.color = color;
            labelData.layer = labelMarker; // Actualizar referencia de la capa
        } else { // Creando nueva capa
            labelData = { layer: labelMarker, type: 'label', text: text, angle: angle, size: size, color: color, originalColor: color };
            allDrawnLayers.push(labelData);
        }


        labelMarker.on('dragend', function() { /* Posición actualizada en la capa */ });
        
        labelMarker.on('click', (e) => {
            L.DomEvent.stopPropagation(e.originalEvent);
            const currentItem = allDrawnLayers.find(item => item.layer === labelMarker);
            if (!currentItem) return;

            // Poblar inputs del panel con los datos de la etiqueta seleccionada
            labelTextInput.value = currentItem.text;
            textAngleInput.value = currentItem.angle;
            textSizeInput.value = currentItem.size;
            colorPicker.value = currentItem.originalColor; // Usar originalColor para el picker

            // Aquí se podría añadir lógica para "seleccionar" la etiqueta y que los cambios en el panel la afecten.
            // Por ahora, solo poblamos y permitimos editar con prompt.
            const newText = prompt("Editar texto de la etiqueta:", currentItem.text);
            if (newText !== null && newText.trim() !== "") {
                // Para actualizar, removemos la capa vieja y creamos una nueva con el mismo objeto de datos
                map.removeLayer(currentItem.layer);
                createAndAddLabel(newText.trim(), labelMarker.getLatLng(), currentItem.angle, currentItem.size, currentItem.color, currentItem);
            }
        });
        return labelMarker;
    }
    
    saveShapeBtn.addEventListener("click", () => {
        const labelTextVal = labelTextInput.value.trim();
        if (currentPoints.length === 0 && !labelTextVal) {
            alert("Marca al menos un punto para una figura o escribe un texto para una etiqueta.");
            return;
        }

        let finalLayer = null;
        let labelMarker = null; // Etiqueta de texto libre asociada a la figura geométrica
        let shapeDataToStore = null;

        // Guardar el color seleccionado en el momento de crear la figura
        const figureColor = selectedColor; 
        const figureWeight = DEFAULT_LINE_WEIGHT; // Usar un grosor consistente

        if (currentPoints.length > 0) {
            const finalStyle = { color: figureColor, weight: figureWeight, opacity: 1, fillOpacity: 0 };
            const finalPointStyle = { ...finalStyle, radius: 7, fillColor: figureColor };

            if (currentPoints.length >= 3) {
                finalLayer = L.polygon(currentPoints, finalStyle).addTo(map);
            } else if (currentPoints.length === 2) {
                finalLayer = L.polyline(currentPoints, finalStyle).addTo(map);
            } else if (currentPoints.length === 1) {
                finalLayer = L.circleMarker(currentPoints[0], finalPointStyle).addTo(map);
            }

            if (finalLayer) {
                finalLayer.options.originalColor = figureColor; // Guardar color original en las opciones de la capa
                finalLayer.options.originalWeight = figureWeight;

                const defaultName = "Territorio " + (allDrawnLayers.filter(item => item.type === 'shape').length + 1);
                const shapeName = prompt("Nombre para esta figura (opcional):", defaultName);
                if (shapeName) {
                    finalLayer.bindTooltip(shapeName, {
                        permanent: true, direction: "center", className: "custom-label", offset: [0, 0]
                    }).openTooltip();
                }
                shapeDataToStore = { 
                    layer: finalLayer, type: 'shape', name: shapeName || '', 
                    originalColor: figureColor, originalWeight: figureWeight 
                };
                allDrawnLayers.push(shapeDataToStore);
            }
        }

        if (labelTextVal) {
            const center = finalLayer ? (finalLayer.getBounds?.().getCenter() || finalLayer.getLatLng()) : map.getCenter();
            // La etiqueta de texto usará el color seleccionado actualmente en el panel, que podría ser diferente al de la figura si se cambió
            labelMarker = createAndAddLabel(labelTextVal, center, parseFloat(textAngleInput.value), parseInt(textSizeInput.value), selectedColor);
            if (shapeDataToStore) {
                shapeDataToStore.associatedLabel = labelMarker; // Vincular etiqueta de texto a datos de la figura
            }
        }

        if (finalLayer) {
            makePathDraggable(finalLayer, labelMarker);
        }

        resetDrawingState();
        alert("Elemento(s) guardado(s) y ahora movible(s).");
    });


    function resetDrawingState() {
        if (tempDrawingLayer) map.removeLayer(tempDrawingLayer);
        tempDrawingLayer = null;
        currentPoints = [];
        isMarking = false;
        startMarkingBtn.disabled = false;
        saveShapeBtn.disabled = true;
        undoPointBtn.disabled = true;
        // No deshabilitar resetBtn aquí, solo si no hay nada en el mapa
        resetBtn.disabled = allDrawnLayers.length === 0;
        exportPdfBtn.disabled = allDrawnLayers.length === 0;
        exportJpgBtn.disabled = allDrawnLayers.length === 0;
        // No resetear labelText aquí, permitir que el usuario lo reutilice
        map.getContainer().style.cursor = '';
    }

    resetBtn.addEventListener("click", () => {
        // ... (código de resetBtn de la versión anterior, sin cambios funcionales directos aquí)
        if (allDrawnLayers.length === 0 && currentPoints.length === 0) return;
        if (!confirm("¿Estás seguro de que quieres limpiar todo? Se eliminarán todos los dibujos y etiquetas del mapa.")) return;
        allDrawnLayers.forEach(item => { if (item.type === 'shape') removePathDragHandlers(item.layer); map.removeLayer(item.layer); });
        allDrawnLayers = [];
        if (tempDrawingLayer) map.removeLayer(tempDrawingLayer);
        currentPoints = []; tempDrawingLayer = null; isMarking = false;
        startMarkingBtn.disabled = false; saveShapeBtn.disabled = true; undoPointBtn.disabled = true;
        resetBtn.disabled = true; exportPdfBtn.disabled = true; exportJpgBtn.disabled = true;
        labelTextInput.value = ""; textAngleInput.value = "0"; textSizeInput.value = "14";
        colorPicker.value = "#0078d4"; selectedColor = "#0078d4";
        map.getContainer().style.cursor = '';
        map.setView([41.3851, 2.1701], 15); map.setBearing(0);
        alert("Todo el contenido ha sido eliminado.");
    });

    // --- Funcionalidad de Exportación ---
    exportPdfBtn.addEventListener("click", () => prepareAndShowPreview("pdf"));
    exportJpgBtn.addEventListener("click", () => prepareAndShowPreview("jpg"));

    async function createTemporaryMapForCapture(containerElement, forExport = false) {
        const tempMap = L.map(containerElement, {
            attributionControl: false,
            zoomControl: false,
            preferCanvas: true, // IMPORTANTE: Usar Canvas para renderizado más fiable con html2canvas
            rotate: true,
            fadeAnimation: false,
            markerZoomAnimation: false,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 20,
            minZoom: 0
        }).addTo(tempMap);

        const tempLayersRendered = [];
        let featureGroupForBounds = null; // Declarar aquí e inicializar a null

        allDrawnLayers.forEach(item => {
            let newLayer;
            const originalLayer = item.layer;
            const itemColor = item.originalColor || selectedColor;
            const itemWeight = item.originalWeight || DEFAULT_LINE_WEIGHT;
            let styleOptions = {};

            if (item.type === 'shape') {
                styleOptions = {
                    color: itemColor,
                    weight: itemWeight,
                    opacity: 1,
                    fillOpacity: 0,
                    fillColor: 'transparent'
                };
                if (originalLayer instanceof L.CircleMarker) {
                    styleOptions.radius = originalLayer.options.radius || 7;
                }

                if (originalLayer instanceof L.Polygon) {
                    newLayer = L.polygon(originalLayer.getLatLngs(), styleOptions);
                } else if (originalLayer instanceof L.Polyline) {
                    newLayer = L.polyline(originalLayer.getLatLngs(), styleOptions);
                } else if (originalLayer instanceof L.CircleMarker) {
                    newLayer = L.circleMarker(originalLayer.getLatLng(), styleOptions);
                }
            } else if (item.type === 'label') {
                const iconHtml = `<div style="transform: rotate(${item.angle}deg); font-size: ${item.size}px; color: ${itemColor}; white-space: nowrap;">${item.text}</div>`;
                const tempSpan = document.createElement('span');
                tempSpan.style.fontSize = `${item.size}px`; tempSpan.style.whiteSpace = 'nowrap'; tempSpan.style.visibility = 'hidden';
                tempSpan.innerHTML = item.text; document.body.appendChild(tempSpan);
                const textWidth = tempSpan.offsetWidth; const textHeight = tempSpan.offsetHeight;
                document.body.removeChild(tempSpan);
                const iconSize = L.point(textWidth + 10, textHeight + 4);

                const newIcon = L.divIcon({ html: iconHtml, className: "custom-free-label", iconSize: iconSize, iconAnchor: L.point(iconSize.x / 2, iconSize.y / 2) });
                newLayer = L.marker(originalLayer.getLatLng(), { icon: newIcon });
            }

            if (newLayer) {
                newLayer.addTo(tempMap);
                if (item.type === 'shape' && item.name) {
                    newLayer.bindTooltip(item.name, { permanent: true, direction: "center", className: "custom-label", offset: [0, 0] }).openTooltip();
                }
                tempLayersRendered.push(newLayer);
            }
        });
        
        if (tempLayersRendered.length > 0) {
            // Asignar a la variable declarada arriba
            featureGroupForBounds = L.featureGroup(tempLayersRendered.map(l => { return l; }));
            
            if (featureGroupForBounds && Object.keys(featureGroupForBounds._layers).length > 0) {
                 tempMap.fitBounds(featureGroupForBounds.getBounds(), { 
                    padding: forExport ? [10, 10] : [40, 40],
                    maxZoom: PREVIEW_MAX_ZOOM 
                });
            } else { 
                tempMap.setView(map.getCenter(), map.getZoom());
            }
        } else {
            tempMap.setView(map.getCenter(), map.getZoom());
        }
        tempMap.setBearing(map.getBearing());

        await new Promise(resolve => {
            let mapSettled = false;
            const checkSettle = () => {
                if (!mapSettled) {
                    mapSettled = true;
                    setTimeout(resolve, forExport ? 600 : 400);
                }
            };
            tempMap.once('load zoomend moveend idle', checkSettle);
            
            tempMap.invalidateSize();
            // Ahora featureGroupForBounds (si fue asignado) está en el ámbito correcto
            if (tempLayersRendered.length > 0 && featureGroupForBounds && Object.keys(featureGroupForBounds._layers).length > 0) {
                tempMap.fitBounds(featureGroupForBounds.getBounds(), { padding: forExport ? [10, 10] : [40, 40], maxZoom: PREVIEW_MAX_ZOOM });
            } else {
                tempMap.setView(map.getCenter(), map.getZoom());
            }
            setTimeout(() => { if (!mapSettled) { console.warn("Mapa temporal no disparó eventos de 'settle', continuando."); checkSettle(); }}, 3000);
        });
        return tempMap;
    }

    async function prepareAndShowPreview(type) {
        if (allDrawnLayers.length === 0) {
            alert("No hay nada dibujado para exportar.");
            return;
        }
        exportType = type;
        previewModal.style.display = "flex";
        previewImage.src = "";
        previewImage.alt = "Generando vista previa...";

        const tempPreviewContainer = document.createElement('div');
        tempPreviewContainer.style.width = `${EXPORT_WIDTH_PX}px`; 
        tempPreviewContainer.style.height = `${EXPORT_HEIGHT_PX}px`;
        tempPreviewContainer.style.position = 'absolute'; tempPreviewContainer.style.left = '-99999px'; tempPreviewContainer.style.top = '-99999px';
        document.body.appendChild(tempPreviewContainer);
        
        let tempPreviewMapInstance = null;

        try {
            tempPreviewMapInstance = await createTemporaryMapForCapture(tempPreviewContainer, false);

            const canvas = await html2canvas(tempPreviewContainer, {
                backgroundColor: "#ffffff", useCORS: true, scale: 1, logging: false,
                 onclone: (clonedDoc) => {
                    const canvasElements = clonedDoc.querySelectorAll('canvas');
                    console.log(`[Preview onclone] Found ${canvasElements.length} <canvas> elements (expected due to preferCanvas:true).`);
                    // Si se usa preferCanvas: true, la inspección de <path> no es relevante aquí.
                    // Sí lo sería si preferCanvas fuera false.
                }
            });
            previewImage.src = canvas.toDataURL("image/png");
            previewImage.alt = "Vista previa del mapa";

        } catch (err) {
            console.error("Error al generar la vista previa:", err);
            alert("Error al generar la vista previa: " + err.message);
            previewModal.style.display = "none";
        } finally {
            if (tempPreviewMapInstance) tempPreviewMapInstance.remove();
            if (document.body.contains(tempPreviewContainer)) document.body.removeChild(tempPreviewContainer);
        }
    }

    closeModalBtn.addEventListener("click", () => previewModal.style.display = "none");
    cancelExportBtn.addEventListener("click", () => previewModal.style.display = "none");

    confirmExportBtn.addEventListener("click", async () => {
        previewModal.style.display = "none";
        const originalButtonText = confirmExportBtn.textContent;
        confirmExportBtn.textContent = "Exportando..."; confirmExportBtn.disabled = true;
        try {
            await exportMapFinal(exportType);
        } catch (error) {
            console.error("Fallo en la exportación final:", error);
            alert("Fallo en la exportación final: " + error.message);
        } finally {
            confirmExportBtn.textContent = originalButtonText; confirmExportBtn.disabled = false;
        }
    });

    async function exportMapFinal(type) {
        // Reutilizar exportMapContainer que ya está en el DOM (oculto)
        exportMapContainer.style.width = `${EXPORT_WIDTH_PX}px`;
        exportMapContainer.style.height = `${EXPORT_HEIGHT_PX}px`;
        exportMapContainer.style.display = 'block'; // Hacer visible temporalmente para html2canvas

        let tempExportMapInstance = null;
        
        try {
            tempExportMapInstance = await createTemporaryMapForCapture(exportMapContainer, true);
            
            // Asegurarse de que el contenedor usado por html2canvas es el correcto y tiene contenido
            // console.log("Exporting from container:", exportMapContainer.innerHTML.substring(0, 200));

            const canvas = await html2canvas(exportMapContainer, { // Usar el contenedor directamente
                backgroundColor: "#ffffff", useCORS: true, scale: 2, // Mayor escala para exportación
                logging: false, scrollX: 0, scrollY: 0,
                width: EXPORT_WIDTH_PX, height: EXPORT_HEIGHT_PX,
                windowWidth: EXPORT_WIDTH_PX, windowHeight: EXPORT_HEIGHT_PX,
                removeContainer: false // No remover el exportMapContainer, solo su contenido (el mapa)
            });

            const imgDataURL = canvas.toDataURL('image/png', 1.0);

            if (type === "pdf") {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [EXPORT_WIDTH_CM * 10, EXPORT_HEIGHT_CM * 10] });
                pdf.addImage(imgDataURL, "PNG", 0, 0, EXPORT_WIDTH_CM * 10, EXPORT_HEIGHT_CM * 10);
                pdf.save("territorio_exportado.pdf");
                alert("Mapa exportado a PDF con éxito.");
            } else if (type === "jpg") {
                const jpgCanvas = document.createElement('canvas');
                jpgCanvas.width = canvas.width; jpgCanvas.height = canvas.height;
                const ctx = jpgCanvas.getContext('2d');
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    const jpgDataURL = jpgCanvas.toDataURL("image/jpeg", 0.92); // Buena calidad para JPG
                    const link = document.createElement("a");
                    link.href = jpgDataURL; link.download = "territorio_exportado.jpg";
                    document.body.appendChild(link); link.click(); document.body.removeChild(link);
                    alert("Mapa exportado a JPG con éxito.");
                };
                img.src = imgDataURL;
            }
        } catch (err) {
            console.error("Error durante la captura o creación del archivo:", err);
            alert("Error exportando el mapa: " + err.message + "\nIntenta de nuevo. Si el error persiste, verifica la consola.");
        } finally {
            if (tempExportMapInstance) tempExportMapInstance.remove();
            // Limpiar el contenido de exportMapContainer pero no el div en sí
            while (exportMapContainer.firstChild) {
                exportMapContainer.removeChild(exportMapContainer.firstChild);
            }
            exportMapContainer.style.display = 'none'; // Ocultar de nuevo
        }
    }

    // --- Inicialización ---
    resetDrawingState(); // Asegura estado inicial correcto de botones, etc.
    // controlPanel.classList.add('collapsed'); // Panel empieza colapsado (ya se hace en el CSS/JS)
    // updateToggleBtnText();

}); // Fin de DOMContentLoaded