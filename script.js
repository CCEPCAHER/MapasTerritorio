// Ensure Leaflet, html2canvas, and jsPDF libraries are loaded in your HTML
// e.g., via CDN before this script.

const map = L.map('map').setView([41.3851, 2.1701], 15); // Barcelona center

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

let isMarking = false;
let currentPoints = [];
let allLayers = []; // Stores all saved layers (shapes and text markers)
let tempLayer = null; // Holds the currently drawn shape
let selectedColor = document.getElementById("colorPicker").value;

// DOM Elements
const startBtn = document.getElementById("startMarkingBtn");
const saveBtn = document.getElementById("saveShapeBtn");
const undoBtn = document.getElementById("undoPointBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportJpgBtn = document.getElementById("exportJpgBtn");
const resetBtn = document.getElementById("resetBtn");
const colorPicker = document.getElementById("colorPicker");
const labelTextInput = document.getElementById("labelText"); // Assuming you have these inputs
const textAngleInput = document.getElementById("textAngle"); // Assuming you have these inputs
const textSizeInput = document.getElementById("textSize");   // Assuming you have these inputs

// Panel Toggle (assuming you have these elements)
const toggleBtn = document.getElementById("toggleControlsBtn");
const controlPanel = document.getElementById("controlPanel");

if (toggleBtn && controlPanel) {
    toggleBtn.addEventListener("click", () => {
        controlPanel.classList.toggle("collapsed");
        toggleBtn.textContent = controlPanel.classList.contains("collapsed")
            ? "Mostrar"
            : "Ocultar opciones";
    });
}

// Event Listeners
colorPicker.addEventListener("input", (e) => {
    selectedColor = e.target.value;
    if (tempLayer && isMarking) { // Update current drawing color
        const styleOptions = { color: selectedColor, weight: 3, fillOpacity: 0.1, fillColor: selectedColor, dashArray: '5, 5' };
        const pointStyleOptions = { radius: 6, color: selectedColor, fillColor: selectedColor, fillOpacity: 0.5 };
        if (tempLayer.setStyle) {
             if (currentPoints.length >= 3 || currentPoints.length === 2) { // Polygon or Polyline
                tempLayer.setStyle(styleOptions);
             } else { // CircleMarker
                tempLayer.setStyle(pointStyleOptions);
             }
        }
    }
});

startBtn.addEventListener("click", () => {
    isMarking = true;
    currentPoints = [];
    if (tempLayer) {
        map.removeLayer(tempLayer);
        tempLayer = null;
    }
    if (labelTextInput) labelTextInput.value = "";
    if (textAngleInput) textAngleInput.value = "0";
    if (textSizeInput) textSizeInput.value = "14";

    startBtn.disabled = true;
    saveBtn.disabled = false;
    undoBtn.disabled = false;
    resetBtn.disabled = false;
    alert("Toca el mapa para marcar puntos.");
});

saveBtn.addEventListener("click", () => {
    if (currentPoints.length < 1) {
        alert("Marca al menos un punto.");
        return;
    }
    // For lines/polygons, at least 2 points. For single marker, 1 point is fine.
    if (currentPoints.length < 2 && currentPoints.length !== 1 && tempLayer && !(tempLayer instanceof L.CircleMarker)) {
        alert("Marca al menos dos puntos para una línea o polígono.");
        return;
    }


    if (tempLayer) {
        const defaultName = `Territorio ${allLayers.filter(l => l instanceof L.Path || l instanceof L.CircleMarker).length + 1}`;
        const nombre = prompt("Nombre de esta figura:", defaultName) || defaultName;
        
        tempLayer.options.customName = nombre; // Store custom name

        const center = tempLayer.getBounds ? tempLayer.getBounds().getCenter() : tempLayer.getLatLng();

        tempLayer.bindTooltip(nombre, {
            permanent: true,
            direction: "center",
            className: "custom-label",
            offset: [0, 0]
        }).openTooltip(center);

        // Apply final style (solid, filled)
        if (tempLayer.setStyle) {
            const finalStyle = {
                color: selectedColor,
                weight: 2,
                fillColor: selectedColor,
                fillOpacity: 0.2,
                dashArray: null // Remove dash array for saved shape
            };
            const finalPointStyle = {
                radius: 6,
                color: selectedColor,
                fillColor: selectedColor,
                fillOpacity: 0.5
            };
            if (tempLayer instanceof L.CircleMarker) {
                 tempLayer.setStyle(finalPointStyle);
            } else {
                 tempLayer.setStyle(finalStyle);
            }
        }
        allLayers.push(tempLayer);

        const labelText = labelTextInput ? labelTextInput.value.trim() : "";
        if (labelText) {
            const angle = textAngleInput ? parseFloat(textAngleInput.value) || 0 : 0;
            const fontSize = textSizeInput ? parseInt(textSizeInput.value) || 14 : 14;
            
            const textEl = L.divIcon({
                html: `<div style="transform: rotate(${angle}deg); font-size: ${fontSize}px; color: ${selectedColor}; white-space: nowrap;">${labelText}</div>`,
                className: "custom-free-label",
                iconSize: L.point(labelText.length * (fontSize * 0.7), fontSize + 4), // Approximate size
                iconAnchor: L.point(labelText.length * (fontSize * 0.7) / 2, (fontSize + 4) / 2)
            });
            const textMarker = L.marker(center, { icon: textEl }).addTo(map);
            allLayers.push(textMarker);
        }
        
        tempLayer = null;
        currentPoints = [];
    }

    isMarking = false;
    startBtn.disabled = false;
    saveBtn.disabled = true;
    undoBtn.disabled = true;
    exportPdfBtn.disabled = allLayers.length === 0;
    exportJpgBtn.disabled = allLayers.length === 0;
    alert("Territorio guardado. Puedes crear otro o exportar.");
});

undoBtn.addEventListener("click", () => {
    if (currentPoints.length === 0) return;
    currentPoints.pop();
    if (tempLayer) {
        map.removeLayer(tempLayer);
        tempLayer = null;
    }
    if (currentPoints.length > 0) {
        drawTemporaryShape();
    }
});

resetBtn.addEventListener("click", () => {
    if (!confirm("¿Estás seguro de que quieres reiniciar todo? Se borrarán todas las figuras marcadas.")) {
        return;
    }
    allLayers.forEach(layer => map.removeLayer(layer));
    if (tempLayer) map.removeLayer(tempLayer);
    
    allLayers = [];
    currentPoints = [];
    tempLayer = null;
    isMarking = false;

    if (labelTextInput) labelTextInput.value = "";
    if (textAngleInput) textAngleInput.value = "0";
    if (textSizeInput) textSizeInput.value = "14";

    startBtn.disabled = false;
    saveBtn.disabled = true;
    undoBtn.disabled = true;
    resetBtn.disabled = true;
    exportPdfBtn.disabled = true;
    exportJpgBtn.disabled = true;
});

map.on("click", function (e) {
    if (!isMarking) return;
    const latlng = e.latlng;
    currentPoints.push(latlng);
    drawTemporaryShape();
});

function drawTemporaryShape() {
    if (tempLayer) {
        map.removeLayer(tempLayer);
        tempLayer = null;
    }
    const styleOptions = { color: selectedColor, weight: 3, fillOpacity: 0.1, fillColor: selectedColor, dashArray: '5, 5' };
    const pointStyleOptions = { radius: 6, color: selectedColor, fillColor: selectedColor, fillOpacity: 0.5 };

    if (currentPoints.length >= 3) {
        tempLayer = L.polygon(currentPoints, styleOptions).addTo(map);
    } else if (currentPoints.length === 2) {
        tempLayer = L.polyline(currentPoints, styleOptions).addTo(map);
    } else if (currentPoints.length === 1) {
        tempLayer = L.circleMarker(currentPoints[0], pointStyleOptions).addTo(map);
    }
}

exportPdfBtn.addEventListener("click", () => exportMap("pdf"));
exportJpgBtn.addEventListener("click", () => exportMap("jpg"));

function exportMap(type) {
    if (allLayers.length === 0) {
        alert("No hay figuras marcadas para exportar.");
        return;
    }

    exportPdfBtn.disabled = true;
    exportJpgBtn.disabled = true;

    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loadingOverlayMapExport';
    Object.assign(loadingOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: '20000',
        fontSize: '18px', fontFamily: 'Arial, sans-serif', textAlign: 'center', padding: '20px'
    });
    loadingOverlay.innerHTML = '<span>Exportando mapa, por favor espera...<br>Esto puede tardar unos segundos.</span>';
    document.body.appendChild(loadingOverlay);

    const layersForBounds = allLayers.filter(layer => layer instanceof L.Path || layer instanceof L.CircleMarker);
    let group;
    if (layersForBounds.length > 0) {
        group = L.featureGroup(layersForBounds);
    } else if (allLayers.length > 0) {
        group = L.featureGroup(allLayers);
    } else {
         if (document.getElementById('loadingOverlayMapExport')) {
            document.body.removeChild(document.getElementById('loadingOverlayMapExport'));
        }
        exportPdfBtn.disabled = false;
        exportJpgBtn.disabled = false;
        alert("No hay elementos para definir los límites del mapa.");
        return;
    }
    
    try {
        map.flyToBounds(group.getBounds(), { animate: false, padding: [40, 40] });
    } catch (e) {
         console.warn("No se pudieron calcular los límites para centrar el mapa. Se usará la vista actual.", e);
    }

    map.once("moveend zoomend load", () => { // Added 'load' for initial state if no move happens
        setTimeout(() => { // Short delay for rendering
            map.once("idle", () => {
                html2canvas(document.getElementById("map"), {
                    backgroundColor: "#ffffff",
                    useCORS: true,
                    scale: window.devicePixelRatio || 1.5, // Prioritize devicePixelRatio, fallback to 1.5 for balance
                    logging: false,
                    imageTimeout: 15000, // Increased timeout for slower connections/devices
                    onclone: (documentClone) => {
                        const selectorsToHide = [
                            '.leaflet-control-container',
                            '#controlPanel', // Assuming 'controlPanel' is the ID of your controls
                            '#toggleControlsBtn'
                        ];
                        if (controlPanel && controlPanel.classList.contains('collapsed')) {
                            // If panel is collapsed, its toggle button might be the only thing visible from it.
                            // Ensure it's hidden if its container isn't fully hidden by #controlPanel selector
                        }
                        selectorsToHide.forEach(selector => {
                            const elements = documentClone.querySelectorAll(selector);
                            elements.forEach(el => el.style.display = 'none');
                        });
                    }
                }).then(canvas => {
                    const imgData = canvas.toDataURL("image/png", 1.0); // Always get PNG from html2canvas for quality
                    const originalWidth = canvas.width;
                    const originalHeight = canvas.height;

                    const cleanupAndReenable = () => {
                        if (document.getElementById('loadingOverlayMapExport')) {
                            document.body.removeChild(document.getElementById('loadingOverlayMapExport'));
                        }
                        exportPdfBtn.disabled = false;
                        exportJpgBtn.disabled = false;
                    };

                    if (type === "pdf") {
                        try {
                            const { jsPDF } = window.jspdf;
                            const pdf = new jsPDF({
                                orientation: "landscape",
                                unit: "mm",
                                format: "a6"
                            });
                            const A6_MM_WIDTH = 148;
                            const A6_MM_HEIGHT = 105;

                            let title = "Territorio";
                            const titleLayersWithTooltip = allLayers.filter(layer => layer.getTooltip && layer.getTooltip().getContent());
                            if (titleLayersWithTooltip.length > 0) {
                                title = titleLayersWithTooltip[titleLayersWithTooltip.length - 1].getTooltip().getContent();
                            } else {
                                const shapes = allLayers.filter(l => l instanceof L.Path || l instanceof L.CircleMarker);
                                const lastShapeWithName = shapes.filter(l => l.options && l.options.customName).pop();
                                if (lastShapeWithName) title = lastShapeWithName.options.customName;
                                else if (shapes.length > 0) title = `Territorio ${shapes.length}`;
                            }

                            pdf.setFontSize(14);
                            pdf.setFont("helvetica", "bold");
                            const titleY = 10;
                            pdf.text(title, A6_MM_WIDTH / 2, titleY, { align: 'center' });

                            const pageMargin = 7;
                            const contentX_pdf = pageMargin;
                            const contentY_pdf = titleY + 7;
                            const contentWidth_pdf = A6_MM_WIDTH - 2 * pageMargin;
                            const contentHeight_pdf = A6_MM_HEIGHT - contentY_pdf - pageMargin;
                            const imgAspectRatio = originalWidth / originalHeight;
                            const contentAspectRatio_pdf = contentWidth_pdf / contentHeight_pdf;
                            let pdfImgWidth, pdfImgHeight;
                            if (imgAspectRatio > contentAspectRatio_pdf) {
                                pdfImgWidth = contentWidth_pdf;
                                pdfImgHeight = contentWidth_pdf / imgAspectRatio;
                            } else {
                                pdfImgHeight = contentHeight_pdf;
                                pdfImgWidth = contentHeight_pdf * imgAspectRatio;
                            }
                            const pdfImgX = contentX_pdf + (contentWidth_pdf - pdfImgWidth) / 2;
                            const pdfImgY = contentY_pdf + (contentHeight_pdf - pdfImgHeight) / 2;

                            pdf.addImage(imgData, "PNG", pdfImgX, pdfImgY, pdfImgWidth, pdfImgHeight);
                            pdf.save("territorio-A6.pdf"); // This initiates download
                            cleanupAndReenable();
                        } catch (e) {
                            console.error("Error generating PDF:", e);
                            alert("Se produjo un error al generar el PDF: " + e.message);
                            cleanupAndReenable();
                        }
                    } else { // JPG export
                        const JPG_TARGET_WIDTH = 420; // A6-like dimensions in pixels
                        const JPG_TARGET_HEIGHT = 297;
                        const targetCanvas = document.createElement("canvas");
                        targetCanvas.width = JPG_TARGET_WIDTH;
                        targetCanvas.height = JPG_TARGET_HEIGHT;
                        const ctx = targetCanvas.getContext("2d");
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, JPG_TARGET_WIDTH, JPG_TARGET_HEIGHT);

                        const imgAspectRatio = originalWidth / originalHeight;
                        const targetAspectRatio_jpg = JPG_TARGET_WIDTH / JPG_TARGET_HEIGHT;
                        let drawWidth, drawHeight, dx, dy;
                        if (imgAspectRatio > targetAspectRatio_jpg) {
                            drawWidth = JPG_TARGET_WIDTH;
                            drawHeight = JPG_TARGET_WIDTH / imgAspectRatio;
                        } else {
                            drawHeight = JPG_TARGET_HEIGHT;
                            drawWidth = JPG_TARGET_HEIGHT * imgAspectRatio;
                        }
                        dx = (JPG_TARGET_WIDTH - drawWidth) / 2;
                        dy = (JPG_TARGET_HEIGHT - drawHeight) / 2;

                        const imageForJpg = new Image();
                        imageForJpg.onload = () => {
                            try {
                                ctx.drawImage(imageForJpg, dx, dy, drawWidth, drawHeight);
                                const jpgDataUrl = targetCanvas.toDataURL("image/jpeg", 0.92);
                                const link = document.createElement("a");
                                link.href = jpgDataUrl;
                                link.download = "territorio-A6.jpg";
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                cleanupAndReenable();
                            } catch (e) {
                                console.error("Error generating JPG:", e);
                                alert("Se produjo un error al generar el JPG: " + e.message);
                                cleanupAndReenable();
                            }
                        };
                        imageForJpg.onerror = () => {
                            alert("Error al cargar la imagen capturada para exportar a JPG.");
                            cleanupAndReenable();
                        };
                        imageForJpg.src = imgData; // imgData is already a PNG data URL
                    }
                }).catch(error => {
                    console.error("Error during html2canvas processing:", error);
                    alert("Se produjo un error al capturar el mapa: " + error.message);
                     if (document.getElementById('loadingOverlayMapExport')) {
                        document.body.removeChild(document.getElementById('loadingOverlayMapExport'));
                    }
                    exportPdfBtn.disabled = false;
                    exportJpgBtn.disabled = false;
                });
            });
        }, 300); // Delay for rendering
    });
    // Manually trigger 'load' if map is already loaded and no zoom/move will occur
    if (map._loaded) {
        map.fire('load');
    }
}

// Initialize button states
if(saveBtn) saveBtn.disabled = true;
if(undoBtn) undoBtn.disabled = true;
if(resetBtn) resetBtn.disabled = true; // Or false if you want it enabled initially
if(exportPdfBtn) exportPdfBtn.disabled = true;
if(exportJpgBtn) exportJpgBtn.disabled = true;
