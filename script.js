document.addEventListener('DOMContentLoaded', () => {
    // --- Inicialización del Mapa Principal ---
    const map = L.map('map', {
        minZoom: 2,
        maxZoom: 20,
        rotate: true,
        touchRotate: true,
        zoomControl: false, // Default Leaflet zoom, custom one added later
        rotateControl: { // Options for the rotate control
            closeOnZeroBearing: false
        }
    }).setView([41.3851, 2.1701], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: 0,
        crossOrigin: true // Crucial for html2canvas
    }).addTo(map);

    // Add default zoom control in a different position if desired
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    // Add rotate control, assuming leaflet-rotate.js is included
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

    // --- Elementos del DOM ---
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
    const exportMapContainer = document.getElementById("exportMapContainer");

    // --- Funcionalidad del Panel de Control (Toggle) ---
    const updateToggleBtnText = () => {
        const isCollapsed = controlPanel.classList.contains("collapsed");
        // Text on button changes based on panel state and screen width
        if (window.innerWidth <= 768) {
            toggleControlsBtn.textContent = isCollapsed ? "☰" : "✕"; // Hamburger or X
        } else {
            toggleControlsBtn.textContent = isCollapsed ? "Mostrar Opciones" : "Ocultar Opciones";
        }
    };

    toggleControlsBtn.addEventListener("click", () => {
        controlPanel.classList.toggle("collapsed");
        updateToggleBtnText();
    });

    // Initialize panel state based on screen width
    if (window.innerWidth <= 768) {
        controlPanel.classList.add("collapsed");
    } else {
        controlPanel.classList.remove("collapsed"); // Start open on larger screens
    }
    updateToggleBtnText(); // Set initial button text
    window.addEventListener('resize', () => { // Re-evaluate on resize
        if (window.innerWidth <= 768) {
            if (!controlPanel.classList.contains("previously-forced-open")) {
                 controlPanel.classList.add("collapsed");
            }
        } else {
            // On larger screens, if it was collapsed (e.g. by resize from small screen),
            // and not explicitly closed by user, we might want it open.
            // For simplicity, let's just ensure text is updated.
            // If user manually closed it on large screen, it stays closed.
            controlPanel.classList.remove("previously-forced-open");
        }
        updateToggleBtnText();
    });
    // --- Selección de Color ---
    colorPicker.addEventListener("input", (e) => {
        selectedColor = e.target.value;
        if (tempDrawingLayer && isMarking && tempDrawingLayer instanceof L.Path) {
            tempDrawingLayer.setStyle({ color: selectedColor, fillColor: selectedColor }); // fillColor para CircleMarker temporal
        }
    });

    // --- Lógica de Dibujo ---
    function drawTemporaryShape() {
        if (tempDrawingLayer) map.removeLayer(tempDrawingLayer);
        const commonStyle = { color: selectedColor, weight: DEFAULT_LINE_WEIGHT, opacity: 0.7 };

        if (currentPoints.length >= 3) {
            tempDrawingLayer = L.polygon(currentPoints, { ...commonStyle, fillOpacity: 0.2, dashArray: '5, 5', fillColor: selectedColor }).addTo(map);
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
        // Prevent adding points if clicking on an interactive element (like another shape or control)
        if (e.originalEvent.target && e.originalEvent.target.closest && (
            e.originalEvent.target.closest('.leaflet-interactive') ||
            e.originalEvent.target.closest('.leaflet-control') ||
            e.originalEvent.target.closest('#controlPanel') ||
            e.originalEvent.target.closest('#toggleControlsBtn')
            )
        ) {
            return;
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
        startMarkingBtn.textContent = "Marcando...";
        startMarkingBtn.disabled = true;
        saveShapeBtn.disabled = true; // Disabled until points are added
        undoPointBtn.disabled = true;
        map.getContainer().style.cursor = 'crosshair';
        // Optionally, indicate marking mode on the map or panel
    });

    undoPointBtn.addEventListener("click", () => {
        if (currentPoints.length === 0) return;
        currentPoints.pop();
        drawTemporaryShape();
        saveShapeBtn.disabled = currentPoints.length === 0;
        undoPointBtn.disabled = currentPoints.length === 0;
    });

    function makePathDraggable(pathLayer, associatedLabelLayer) {
        if (!(pathLayer instanceof L.Path) || !pathLayer.getElement()) return;
        let initialPathLatLngs, startDragMouseLatLng, isDraggingThisPath = false;
        const pathElement = pathLayer.getElement();
        pathElement.style.cursor = 'grab';

        const onPathMouseDown = (e) => {
            if (isMarking) return; // Don't allow drag if in marking mode
            // Ensure click is directly on the path or its child SVG elements
            if (e.originalEvent.target !== pathElement && !pathElement.contains(e.originalEvent.target)) return;

            L.DomEvent.stopPropagation(e.originalEvent); // Prevent map drag and other clicks
            isDraggingThisPath = true;
            map.dragging.disable(); // Disable map dragging while dragging shape
            pathElement.style.cursor = 'grabbing';
            map.getContainer().style.cursor = 'grabbing';
            startDragMouseLatLng = e.latlng;

            if (pathLayer instanceof L.Polygon || pathLayer instanceof L.Polyline) {
                initialPathLatLngs = L.LatLngUtil.cloneLatLngs(pathLayer.getLatLngs());
            } else if (pathLayer instanceof L.CircleMarker) {
                initialPathLatLngs = L.latLng(pathLayer.getLatLng().lat, pathLayer.getLatLng().lng);
            }

            L.DomEvent.on(document, 'mousemove', onDocumentMouseMove);
            L.DomEvent.on(document, 'mouseup', onDocumentMouseUp);
        };
        pathLayer.on('mousedown', onPathMouseDown);

        const onDocumentMouseMove = (e) => {
            if (!isDraggingThisPath) return;
            const currentMouseLatLng = map.mouseEventToLatLng(e);
            const latOffset = currentMouseLatLng.lat - startDragMouseLatLng.lat;
            const lngOffset = currentMouseLatLng.lng - startDragMouseLatLng.lng;

            if (pathLayer instanceof L.Polygon || pathLayer instanceof L.Polyline) {
                const moveLatLngsRecursively = (latlngs) =>
                    (Array.isArray(latlngs) && latlngs.length > 0 && latlngs[0] instanceof L.LatLng) ?
                    latlngs.map(p => L.latLng(p.lat + latOffset, p.lng + lngOffset)) :
                    (Array.isArray(latlngs) && latlngs.length > 0 && Array.isArray(latlngs[0])) ?
                    latlngs.map(ring => moveLatLngsRecursively(ring)) : latlngs;
                pathLayer.setLatLngs(moveLatLngsRecursively(initialPathLatLngs));
            } else if (pathLayer instanceof L.CircleMarker) {
                pathLayer.setLatLng(L.latLng(initialPathLatLngs.lat + latOffset, initialPathLatLngs.lng + lngOffset));
            }

            if (associatedLabelLayer && associatedLabelLayer instanceof L.Marker) {
                let newLabelCenter = (pathLayer.getBounds && typeof pathLayer.getBounds === 'function') ?
                                     pathLayer.getBounds().getCenter() : pathLayer.getLatLng();
                associatedLabelLayer.setLatLng(newLabelCenter);
            }
        };
        const onDocumentMouseUp = () => {
            if (!isDraggingThisPath) return;
            L.DomEvent.off(document, 'mousemove', onDocumentMouseMove);
            L.DomEvent.off(document, 'mouseup', onDocumentMouseUp);

            isDraggingThisPath = false;
            map.dragging.enable(); // Re-enable map dragging
            pathElement.style.cursor = 'grab';
            map.getContainer().style.cursor = '';
        };
        // Store handlers to be able to remove them later
        pathLayer._dragHandlers = { mousedown: onPathMouseDown, docMouseMove: onDocumentMouseMove, docMouseUp: onDocumentMouseUp };
    }

    function removePathDragHandlers(pathLayer) {
        if (pathLayer && pathLayer._dragHandlers) {
            pathLayer.off('mousedown', pathLayer._dragHandlers.mousedown);
            L.DomEvent.off(document, 'mousemove', pathLayer._dragHandlers.docMouseMove);
            L.DomEvent.off(document, 'mouseup', pathLayer._dragHandlers.docMouseUp);
            delete pathLayer._dragHandlers;
            if (pathLayer.getElement()) {
                pathLayer.getElement().style.cursor = ''; // Reset cursor
            }
        }
    }

    function createAndAddLabel(text, latLng, angle, size, color, existingLayerData = null) {
        const iconHtml = `<div style="transform: rotate(${angle}deg); font-size: ${size}px; color: ${color}; white-space: nowrap; font-weight: bold; text-shadow: 1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white;">${text}</div>`;

        // Calculate icon size dynamically for better anchor
        const tempSpan = document.createElement('span');
        tempSpan.style.fontSize = `${size}px`;
        tempSpan.style.fontWeight = 'bold';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.style.visibility = 'hidden'; // Don't show it
        tempSpan.innerHTML = text;
        document.body.appendChild(tempSpan);
        const textWidth = tempSpan.offsetWidth;
        const textHeight = tempSpan.offsetHeight;
        document.body.removeChild(tempSpan);

        const iconSize = L.point(textWidth + 10, textHeight + 4); // Add some padding

        const labelIcon = L.divIcon({
            html: iconHtml,
            className: "custom-free-label", // Make sure this class has no conflicting styles
            iconSize: iconSize,
            iconAnchor: L.point(iconSize.x / 2, iconSize.y / 2) // Center anchor
        });

        const labelMarker = L.marker(latLng, { icon: labelIcon, draggable: true, interactive: true }).addTo(map);

        let labelData;
        if (existingLayerData) { // Updating an existing label
            labelData = existingLayerData;
            labelData.text = text;
            labelData.angle = angle;
            labelData.size = size;
            labelData.color = color; // This should be originalColor if we want to persist it
            labelData.layer = labelMarker; // Update layer reference
        } else { // Creating a new label
            labelData = {
                layer: labelMarker, type: 'label', text: text, angle: angle, size: size,
                color: color, originalColor: color // Store originalColor for edits
            };
            allDrawnLayers.push(labelData);
        }

        labelMarker.on('dragend', function() {
            // Position is automatically updated by Leaflet's draggable
        });

        labelMarker.on('click', (e) => {
            L.DomEvent.stopPropagation(e.originalEvent); // Prevent map click
            const currentItem = allDrawnLayers.find(item => item.layer === labelMarker);
            if (!currentItem || isMarking) return; // Don't allow edit if marking

            // Pre-fill controls with label's current properties
            labelTextInput.value = currentItem.text;
            textAngleInput.value = currentItem.angle;
            textSizeInput.value = currentItem.size;
            colorPicker.value = currentItem.originalColor; // Use originalColor

            const newText = prompt("Editar texto de la etiqueta:", currentItem.text);
            if (newText !== null && newText.trim() !== "") {
                // Remove old marker
                map.removeLayer(currentItem.layer);
                // Re-create with updated text, using existing data object to update it
                createAndAddLabel(newText.trim(), labelMarker.getLatLng(), currentItem.angle, currentItem.size, currentItem.originalColor, currentItem);
            } else if (newText === "") { // User cleared text, effectively deleting label
                 const itemIndex = allDrawnLayers.findIndex(item => item.layer === labelMarker);
                 if (itemIndex > -1) {
                    map.removeLayer(allDrawnLayers[itemIndex].layer);
                    allDrawnLayers.splice(itemIndex, 1);
                    resetBtn.disabled = allDrawnLayers.length === 0;
                    exportPdfBtn.disabled = allDrawnLayers.length === 0;
                    exportJpgBtn.disabled = allDrawnLayers.length === 0;
                 }
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
        let labelMarker = null;
        let shapeDataToStore = null;

        const figureColor = selectedColor;
        const figureWeight = DEFAULT_LINE_WEIGHT;

        if (currentPoints.length > 0) { // A shape is being drawn
            const finalStyle = { color: figureColor, weight: figureWeight, opacity: 1, fillOpacity: 0.2, fillColor: figureColor };
            const finalPointStyle = { ...finalStyle, radius: 7, fillOpacity: 0.5 }; // Points should have more fill

            if (currentPoints.length >= 3) {
                finalLayer = L.polygon(currentPoints, finalStyle).addTo(map);
            } else if (currentPoints.length === 2) {
                finalLayer = L.polyline(currentPoints, finalStyle).addTo(map);
            } else if (currentPoints.length === 1) {
                finalLayer = L.circleMarker(currentPoints[0], finalPointStyle).addTo(map);
            }

            if (finalLayer) {
                finalLayer.options.originalColor = figureColor; // Store color with the layer
                finalLayer.options.originalWeight = figureWeight;

                const defaultName = "Territorio " + (allDrawnLayers.filter(item => item.type === 'shape').length + 1);
                const shapeName = prompt("Nombre para esta figura (opcional, aparecerá en el mapa):", defaultName);
                if (shapeName) { // Add tooltip if name is provided
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

        // If there's label text, create a label
        // If a shape was just drawn, associate label with it, otherwise it's a free label
        if (labelTextVal) {
            const center = finalLayer ? (finalLayer.getBounds?.().getCenter() || finalLayer.getLatLng()) : map.getCenter();
            labelMarker = createAndAddLabel(labelTextVal, center, parseFloat(textAngleInput.value), parseInt(textSizeInput.value), selectedColor);
            if (shapeDataToStore) { // If a shape was created in this save operation
                shapeDataToStore.associatedLabel = labelMarker; // Link label to shape data
            }
        }

        if (finalLayer) { // Make the new shape draggable
            makePathDraggable(finalLayer, labelMarker); // Pass associated label if any
        }

        resetDrawingState();
        // labelTextInput.value = ""; // Optionally clear label text after saving
        alert("Elemento(s) guardado(s). Las figuras son movibles.");
    });


    function resetDrawingState() {
        if (tempDrawingLayer) map.removeLayer(tempDrawingLayer);
        tempDrawingLayer = null;
        currentPoints = [];
        isMarking = false;

        startMarkingBtn.textContent = "Iniciar Marcación"; // Reset button text
        startMarkingBtn.disabled = false;
        saveShapeBtn.disabled = true;
        undoPointBtn.disabled = true;

        // Enable/disable global buttons based on whether anything is drawn
        const hasDrawnItems = allDrawnLayers.length > 0;
        resetBtn.disabled = !hasDrawnItems;
        exportPdfBtn.disabled = !hasDrawnItems;
        exportJpgBtn.disabled = !hasDrawnItems;

        map.getContainer().style.cursor = ''; // Reset cursor
    }

    resetBtn.addEventListener("click", () => {
        if (allDrawnLayers.length === 0 && currentPoints.length === 0 && !tempDrawingLayer) return;
        if (!confirm("¿Estás seguro de que quieres limpiar todo? Se eliminarán todos los dibujos y etiquetas del mapa.")) return;

        allDrawnLayers.forEach(item => {
            if (item.type === 'shape') removePathDragHandlers(item.layer); // Remove drag handlers
            map.removeLayer(item.layer);
        });
        allDrawnLayers = [];

        if (tempDrawingLayer) map.removeLayer(tempDrawingLayer);
        currentPoints = []; tempDrawingLayer = null; isMarking = false;

        // Reset controls
        startMarkingBtn.disabled = false;
        startMarkingBtn.textContent = "Iniciar Marcación";
        saveShapeBtn.disabled = true;
        undoPointBtn.disabled = true;
        resetBtn.disabled = true;
        exportPdfBtn.disabled = true;
        exportJpgBtn.disabled = true;

        labelTextInput.value = "";
        textAngleInput.value = "0";
        textSizeInput.value = "14";
        colorPicker.value = "#0078d4"; selectedColor = "#0078d4";

        map.getContainer().style.cursor = '';
        map.setView([41.3851, 2.1701], 15); // Reset view
        map.setBearing(0); // Reset rotation
        alert("Todo el contenido ha sido eliminado.");
    });

    // --- Funcionalidad de Exportación ---
    exportPdfBtn.addEventListener("click", () => prepareAndShowPreview("pdf"));
    exportJpgBtn.addEventListener("click", () => prepareAndShowPreview("jpg"));

    async function ensureImagesLoaded(containerElement) {
        const images = Array.from(containerElement.querySelectorAll('img'));
        if (images.length === 0) return Promise.resolve();

        const promises = images.map(img => {
            return new Promise((resolve) => {
                if (img.complete && img.naturalHeight !== 0) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = () => {
                        console.warn('[ensureImagesLoaded] Image failed to load or zero dimensions:', img.src);
                        resolve(); // Resolve anyway to not block, but log it
                    };
                }
            });
        });
        await Promise.all(promises);
        console.log('[ensureImagesLoaded] All detected images in container are considered loaded or errored out.');
    }


    async function createTemporaryMapForCapture(containerElement, forExport = false) {
        // Clear previous map instance if any
        while (containerElement.firstChild) {
            containerElement.removeChild(containerElement.firstChild);
        }

        const tempMap = L.map(containerElement, {
            attributionControl: false,
            zoomControl: false,
            preferCanvas: true,
            rotate: true,
            fadeAnimation: false, // Important for html2canvas
            zoomAnimation: false,  // Important for html2canvas
            markerZoomAnimation: false, // Important for html2canvas
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 20, // Max zoom for tiles
            minZoom: 0,
            crossOrigin: true // ESSENTIAL for html2canvas
        }).addTo(tempMap);

        const tempLayersRendered = [];
        let featureGroupForBounds = null;

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
                    fillOpacity: 0.2, // Consistent fill for shapes
                    fillColor: itemColor  // Use shape's color for fill
                };
                if (originalLayer instanceof L.CircleMarker) {
                    styleOptions.radius = originalLayer.options.radius || 7;
                    styleOptions.fillOpacity = 0.5; // Points more filled
                }

                if (originalLayer instanceof L.Polygon) {
                    newLayer = L.polygon(originalLayer.getLatLngs(), styleOptions);
                } else if (originalLayer instanceof L.Polyline) {
                    newLayer = L.polyline(originalLayer.getLatLngs(), styleOptions);
                } else if (originalLayer instanceof L.CircleMarker) {
                    newLayer = L.circleMarker(originalLayer.getLatLng(), styleOptions);
                }
            } else if (item.type === 'label') {
                const iconHtml = `<div style="transform: rotate(${item.angle}deg); font-size: ${item.size}px; color: ${item.color}; white-space: nowrap; font-weight: bold; text-shadow: 1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white;">${item.text}</div>`;
                const tempSpan = document.createElement('span');
                tempSpan.style.fontSize = `${item.size}px`; tempSpan.style.whiteSpace = 'nowrap'; tempSpan.style.visibility = 'hidden'; tempSpan.style.fontWeight = 'bold';
                tempSpan.innerHTML = item.text; document.body.appendChild(tempSpan);
                const textWidth = tempSpan.offsetWidth; const textHeight = tempSpan.offsetHeight;
                document.body.removeChild(tempSpan);
                const iconSize = L.point(textWidth + 10, textHeight + 4);

                const newIcon = L.divIcon({ html: iconHtml, className: "custom-free-label", iconSize: iconSize, iconAnchor: L.point(iconSize.x / 2, iconSize.y / 2) });
                newLayer = L.marker(originalLayer.getLatLng(), { icon: newIcon });
            }

            if (newLayer) {
                newLayer.addTo(tempMap);
                if (item.type === 'shape' && item.name) { // Add tooltip for shapes with names
                    newLayer.bindTooltip(item.name, { permanent: true, direction: "center", className: "custom-label", offset: [0, 0] }).openTooltip();
                }
                tempLayersRendered.push(newLayer);
            }
        });

        if (tempLayersRendered.length > 0) {
            featureGroupForBounds = L.featureGroup(tempLayersRendered);
            if (featureGroupForBounds && Object.keys(featureGroupForBounds._layers).length > 0) {
                 tempMap.fitBounds(featureGroupForBounds.getBounds(), {
                    padding: forExport ? [20, 20] : [50, 50], // More padding for preview
                    maxZoom: forExport ? PREVIEW_MAX_ZOOM : PREVIEW_MAX_ZOOM -1, // Slightly less zoom for preview to ensure readability
                    animate: false // No animation for fitting bounds
                });
            } else {
                tempMap.setView(map.getCenter(), map.getZoom());
            }
        } else { // If no layers, use current main map view
            tempMap.setView(map.getCenter(), map.getZoom());
        }
        tempMap.setBearing(map.getBearing()); // Match rotation

        // Wait for the map to be fully ready (tiles loaded, view settled)
        await new Promise(resolve => {
            let mapSettled = false;
            const checkSettle = () => {
                if (!mapSettled) {
                    mapSettled = true;
                    setTimeout(resolve, forExport ? 2000 : 1500); // Increased delay
                }
            };

            tempMap.once('load', () => { // Map object ready
                tempMap.invalidateSize(); // Ensure dimensions are correct
                 // Re-fit after invalidateSize, critical if container was hidden/resized
                if (featureGroupForBounds && Object.keys(featureGroupForBounds._layers).length > 0) {
                    tempMap.fitBounds(featureGroupForBounds.getBounds(), {
                        padding: forExport ? [20, 20] : [50, 50],
                        maxZoom: forExport ? PREVIEW_MAX_ZOOM : PREVIEW_MAX_ZOOM -1,
                        animate: false
                    });
                } else {
                    tempMap.setView(map.getCenter(), map.getZoom());
                }
                // 'idle' event is generally best for "everything is done"
                tempMap.once('idle', checkSettle);
            });

            // Fallback timeout in case 'idle' or 'load' doesn't fire as expected
            setTimeout(() => {
                if (!mapSettled) {
                    console.warn("[createTemporaryMapForCapture] Map events ('load' or 'idle') not fired, proceeding via fallback timeout.");
                    checkSettle();
                }
            }, forExport ? 8000 : 6000); // Substantially increased fallback
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
        previewImage.src = ""; // Clear previous
        previewImage.alt = "Generando vista previa...";
        confirmExportBtn.disabled = true; // Disable confirm until preview is ready

        const tempPreviewContainer = document.createElement('div');
        tempPreviewContainer.id = 'temp-preview-map-container';
        tempPreviewContainer.style.width = `${EXPORT_WIDTH_PX}px`;
        tempPreviewContainer.style.height = `${EXPORT_HEIGHT_PX}px`;
        tempPreviewContainer.style.position = 'absolute';
        tempPreviewContainer.style.left = '-19999px'; // Further off-screen
        tempPreviewContainer.style.top = '-19999px';  // Further off-screen
        document.body.appendChild(tempPreviewContainer);

        let tempPreviewMapInstance = null;

        try {
            tempPreviewMapInstance = await createTemporaryMapForCapture(tempPreviewContainer, false); // false for preview

            await ensureImagesLoaded(tempPreviewContainer);
            await new Promise(r => setTimeout(r, 500)); // Small extra delay for rendering

            const canvas = await html2canvas(tempPreviewContainer, {
                backgroundColor: "#ffffff",
                useCORS: true,
                scale: 2, // Good enough for preview, faster than 3
                logging: true, // Enable html2canvas logging
                imageTimeout: 10000, // Timeout for images loading within html2canvas
                onclone: (clonedDoc) => {
                    console.log('[Preview onclone] Cloned document for preview.');
                    const images = clonedDoc.querySelectorAll('img');
                    console.log(`[Preview onclone] Found ${images.length} <img> elements.`);
                    images.forEach((img, index) => {
                        console.log(`[Preview onclone] Image ${index}: src=${img.src}, crossOrigin=${img.crossOrigin}, complete=${img.complete}, w=${img.naturalWidth}, h=${img.naturalHeight}`);
                    });
                    const leafletCanvases = clonedDoc.querySelectorAll('.leaflet-tile-container canvas'); // Tiles if preferCanvas
                    console.log(`[Preview onclone] Found ${leafletCanvases.length} Leaflet tile canvases.`);
                }
            });
            previewImage.src = canvas.toDataURL("image/png");
            previewImage.alt = "Vista previa del mapa";
            confirmExportBtn.disabled = false; // Enable confirm button

        } catch (err) {
            console.error("Error al generar la vista previa:", err);
            alert("Error al generar la vista previa: " + err.message + "\nRevisa la consola para más detalles.");
            previewModal.style.display = "none"; // Close modal on error
        } finally {
            // Ensure map instance is removed and container is cleaned
            if (tempPreviewMapInstance) tempPreviewMapInstance.remove();
            if (document.body.contains(tempPreviewContainer)) document.body.removeChild(tempPreviewContainer);
        }
    }

    closeModalBtn.addEventListener("click", () => previewModal.style.display = "none");
    cancelExportBtn.addEventListener("click", () => previewModal.style.display = "none");

    confirmExportBtn.addEventListener("click", async () => {
        previewModal.style.display = "none"; // Hide modal first
        const originalButtonText = confirmExportBtn.textContent;
        confirmExportBtn.textContent = "Exportando...";
        confirmExportBtn.disabled = true; // Disable during export

        try {
            await exportMapFinal(exportType);
        } catch (error) {
            console.error("Fallo en la exportación final:", error);
            alert("Fallo en la exportación final: " + error.message + "\nRevisa la consola para más detalles.");
        } finally {
            confirmExportBtn.textContent = originalButtonText;
            confirmExportBtn.disabled = false; // Re-enable, even on error
        }
    });

    async function exportMapFinal(type) {
        // Ensure exportMapContainer is clean and styled for capture
        exportMapContainer.innerHTML = ''; // Clear previous content
        exportMapContainer.style.width = `${EXPORT_WIDTH_PX}px`;
        exportMapContainer.style.height = `${EXPORT_HEIGHT_PX}px`;
        exportMapContainer.style.display = 'block'; // Must be visible for html2canvas

        let tempExportMapInstance = null;

        try {
            tempExportMapInstance = await createTemporaryMapForCapture(exportMapContainer, true); // true for final export

            await ensureImagesLoaded(exportMapContainer);
            await new Promise(r => setTimeout(r, 500)); // Small extra delay

            const canvas = await html2canvas(exportMapContainer, {
                backgroundColor: "#ffffff",
                useCORS: true,
                scale: 3, // Higher scale for better export quality
                logging: true, // Enable html2canvas logging
                scrollX: 0, // Ensure capture starts at top-left
                scrollY: 0,
                width: EXPORT_WIDTH_PX, // Explicit dimensions for html2canvas
                height: EXPORT_HEIGHT_PX,
                windowWidth: EXPORT_WIDTH_PX, // Hint for viewport size
                windowHeight: EXPORT_HEIGHT_PX,
                imageTimeout: 15000, // Longer timeout for final export images
                onclone: (clonedDoc) => {
                    console.log('[Export onclone] Cloned document for final export.');
                    const images = clonedDoc.querySelectorAll('img');
                    console.log(`[Export onclone] Found ${images.length} <img> elements.`);
                    images.forEach((img, index) => {
                        console.log(`[Export onclone] Image ${index}: src=${img.src}, crossOrigin=${img.crossOrigin}, complete=${img.complete}, w=${img.naturalWidth}, h=${img.naturalHeight}`);
                    });
                    const leafletCanvases = clonedDoc.querySelectorAll('.leaflet-tile-container canvas');
                    console.log(`[Export onclone] Found ${leafletCanvases.length} Leaflet tile canvases.`);
                }
            });

            const imgDataURL = canvas.toDataURL('image/png', 1.0); // Get PNG data first

            if (type === "pdf") {
                const { jsPDF } = window.jspdf; // Ensure jsPDF is loaded
                const pdfWidthMM = EXPORT_WIDTH_CM * 10;
                const pdfHeightMM = EXPORT_HEIGHT_CM * 10;
                const pdf = new jsPDF({
                    orientation: pdfWidthMM > pdfHeightMM ? "landscape" : "portrait",
                    unit: "mm",
                    format: [pdfWidthMM, pdfHeightMM]
                });
                pdf.addImage(imgDataURL, "PNG", 0, 0, pdfWidthMM, pdfHeightMM);
                pdf.save("territorio_exportado.pdf");
                alert("Mapa exportado a PDF con éxito.");
            } else if (type === "jpg") {
                // Convert PNG to JPG
                const jpgCanvas = document.createElement('canvas');
                jpgCanvas.width = canvas.width;
                jpgCanvas.height = canvas.height;
                const ctx = jpgCanvas.getContext('2d');

                // Fill background with white for JPG (PNG transparency becomes white)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);

                const img = new Image();
                // img.crossOrigin = "anonymous"; // Not strictly needed for dataURL source, but good practice if it were external
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    const jpgDataURL = jpgCanvas.toDataURL("image/jpeg", 0.92); // Adjust quality as needed
                    const link = document.createElement("a");
                    link.href = jpgDataURL;
                    link.download = "territorio_exportado.jpg";
                    document.body.appendChild(link); // Required for Firefox
                    link.click();
                    document.body.removeChild(link);
                    alert("Mapa exportado a JPG con éxito.");
                };
                img.onerror = (e) => {
                    console.error("Error loading image for JPG conversion:", e);
                    alert("Error convirtiendo a JPG. La imagen PNG base podría estar corrupta o no generada.");
                }
                img.src = imgDataURL;
            }
        } catch (err) {
            console.error("Error durante la captura o creación del archivo:", err);
            alert("Error exportando el mapa: " + err.message + "\nIntenta de nuevo. Si el error persiste, verifica la consola.");
        } finally {
            if (tempExportMapInstance) tempExportMapInstance.remove();
            // Clear the container's content and hide it
            if (exportMapContainer) {
                 exportMapContainer.innerHTML = ''; // Clear content
                 exportMapContainer.style.display = 'none';
            }
        }
    }

    // --- Inicialización ---
    resetDrawingState(); // Set initial state of buttons etc.
}); // Fin de DOMContentLoaded
