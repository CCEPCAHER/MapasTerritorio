// Inicialización del mapa principal
const map = L.map('map', {
  minZoom: 2,
  maxZoom: 20,
  rotate: true, // Habilita la rotación del mapa
  touchRotate: true // Habilita la rotación táctil (dos dedos)
}).setView([41.3851, 2.1701], 15);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & CARTO',
  subdomains: 'abcd',
  maxZoom: 20,
  minZoom: 0
}).addTo(map);

// Variables de estado
let isMarking = false;
let currentPoints = [];
let allLayers = []; // Almacena todas las capas guardadas (polígonos, líneas, marcadores, etiquetas)
let tempLayer = null; // Capa temporal para el dibujo en progreso
let selectedColor = "#0078d4"; // Color por defecto

// Elementos del DOM
const startBtn = document.getElementById("startMarkingBtn");
const saveBtn = document.getElementById("saveShapeBtn");
const undoBtn = document.getElementById("undoPointBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportJpgBtn = document.getElementById("exportJpgBtn");
const resetBtn = document.getElementById("resetBtn");
const colorPicker = document.getElementById("colorPicker");
const labelTextInput = document.getElementById("labelText");
const textAngleInput = document.getElementById("textAngle");
const textSizeInput = document.getElementById("textSize");

// Panel desplegable
const toggleBtn = document.getElementById("toggleControlsBtn");
const controlPanel = document.getElementById("controlPanel");

// Modal de vista previa
const previewModal = document.getElementById("previewModal");
const previewImage = document.getElementById("previewImage");
const closeModalBtn = document.getElementById("closeModalBtn");
const confirmExportBtn = document.getElementById("confirmExportBtn");
const cancelExportBtn = document.getElementById("cancelExportBtn");

let exportType = ''; // Para saber si se va a exportar a PDF o JPG

// --- Funcionalidad del panel de control ---
toggleBtn.addEventListener("click", () => {
  controlPanel.classList.toggle("collapsed");
  toggleBtn.textContent = controlPanel.classList.contains("collapsed") ? "Mostrar opciones" : "Ocultar opciones";
});
// Establecer el texto inicial del botón al cargar
toggleBtn.textContent = controlPanel.classList.contains("collapsed") ? "Mostrar opciones" : "Ocultar opciones";

// --- Cambiar color dinámicamente ---
colorPicker.addEventListener("input", (e) => {
  selectedColor = e.target.value;
  if (tempLayer && isMarking) {
    if (tempLayer instanceof L.Path) {
      tempLayer.setStyle({
        color: selectedColor,
        weight: 3,
        fillOpacity: 0,
        fillColor: "transparent",
        dashArray: '5, 5'
      });
    } else if (tempLayer instanceof L.CircleMarker) {
      tempLayer.setStyle({
        radius: 6,
        color: selectedColor,
        fillColor: selectedColor,
        fillOpacity: 0.5
      });
    }
  }
});

// --- Dibujar figura temporal ---
function drawTemporaryShape() {
  if (tempLayer) map.removeLayer(tempLayer);

  const style = {
    color: selectedColor,
    weight: 3,
    fillOpacity: 0,
    fillColor: "transparent",
    dashArray: '5, 5'
  };
  const pointStyle = {
    radius: 6,
    color: selectedColor,
    fillColor: selectedColor,
    fillOpacity: 0.5
  };

  if (currentPoints.length >= 3) {
    tempLayer = L.polygon(currentPoints, style).addTo(map);
  } else if (currentPoints.length === 2) {
    tempLayer = L.polyline(currentPoints, style).addTo(map);
  } else if (currentPoints.length === 1) {
    tempLayer = L.circleMarker(currentPoints[0], pointStyle).addTo(map);
  } else {
    tempLayer = null;
  }
}

// --- Evento clic en el mapa ---
map.on("click", (e) => {
  if (!isMarking) return;
  currentPoints.push(e.latlng);
  drawTemporaryShape();
});

// --- Botón iniciar marcación ---
startBtn.addEventListener("click", () => {
  isMarking = true;
  currentPoints = [];
  if (tempLayer) map.removeLayer(tempLayer);
  tempLayer = null;

  labelTextInput.value = "";
  textAngleInput.value = "0";
  textSizeInput.value = "14";
  colorPicker.value = "#0078d4";

  startBtn.disabled = true;
  saveBtn.disabled = false;
  undoBtn.disabled = false;
  resetBtn.disabled = false;
  exportPdfBtn.disabled = true;
  exportJpgBtn.disabled = true;

  alert("Toca el mapa para marcar puntos.");
});

// --- Botón deshacer ---
undoBtn.addEventListener("click", () => {
  if (currentPoints.length === 0) return;
  currentPoints.pop();
  if (tempLayer) {
    map.removeLayer(tempLayer);
    tempLayer = null;
  }
  drawTemporaryShape();

  if (currentPoints.length === 0) {
    saveBtn.disabled = true;
  }
});

// --- Botón guardar figura ---
saveBtn.addEventListener("click", () => {
  if (currentPoints.length === 0) {
    alert("Marca al menos un punto para guardar una figura.");
    return;
  }

  if (tempLayer) {
    let finalLayer;
    const finalStyle = {
      color: selectedColor,
      weight: 2,
      fillColor: "transparent",
      fillOpacity: 0,
      dashArray: null
    };
    const finalPointStyle = {
      radius: 6,
      color: selectedColor,
      fillColor: selectedColor,
      fillOpacity: 0.5
    };

    if (tempLayer instanceof L.Polygon) {
      finalLayer = L.polygon(currentPoints, finalStyle).addTo(map);
    } else if (tempLayer instanceof L.Polyline) {
      finalLayer = L.polyline(currentPoints, finalStyle).addTo(map);
    } else if (tempLayer instanceof L.CircleMarker) {
      finalLayer = L.circleMarker(currentPoints[0], finalPointStyle).addTo(map);
    }

    if (finalLayer) {
      const defaultName = "Territorio " + (allLayers.filter(l => l instanceof L.Path).length + 1);
      const nombre = prompt("Nombre de esta figura:", defaultName) || defaultName;

      const center = finalLayer.getBounds?.().getCenter() || finalLayer.getLatLng();

      finalLayer.bindTooltip(nombre, { permanent: true, direction: "center", className: "custom-label" }).openTooltip(center);

      allLayers.push(finalLayer);

      const labelText = labelTextInput.value.trim();
      if (labelText) {
        const angle = parseFloat(textAngleInput.value) || 0;
        const fontSize = parseInt(textSizeInput.value) || 14;

        const labelIcon = L.divIcon({
          html: `<div style="transform: rotate(${angle}deg); font-size: ${fontSize}px; color: ${selectedColor};">${labelText}</div>`,
          className: "custom-free-label",
          iconSize: [labelText.length * fontSize * 0.6 + 10, fontSize + 4],
          iconAnchor: [labelText.length * fontSize * 0.3 + 5, (fontSize + 4) / 2]
        });
        const labelMarker = L.marker(center, { icon: labelIcon }).addTo(map);
        allLayers.push(labelMarker);
      }
    }

    map.removeLayer(tempLayer);
    tempLayer = null;
    currentPoints = [];
  }

  isMarking = false;
  startBtn.disabled = false;
  saveBtn.disabled = true;
  undoBtn.disabled = true;
  exportPdfBtn.disabled = false;
  exportJpgBtn.disabled = false;
  alert("Territorio guardado.");
});

// --- Botón reiniciar ---
resetBtn.addEventListener("click", () => {
  if (!confirm("¿Reiniciar todo? Esto eliminará todos los dibujos y etiquetas del mapa.")) return;
  allLayers.forEach(layer => map.removeLayer(layer));
  if (tempLayer) map.removeLayer(tempLayer);
  currentPoints = [];
  allLayers = [];
  tempLayer = null;
  isMarking = false;

  startBtn.disabled = false;
  saveBtn.disabled = true;
  undoBtn.disabled = true;
  resetBtn.disabled = true;
  exportPdfBtn.disabled = true;
  exportJpgBtn.disabled = true;

  labelTextInput.value = "";
  textAngleInput.value = "0";
  textSizeInput.value = "14";
  colorPicker.value = "#0078d4";

  map.setBearing(0); // Reinicia la rotación del mapa
});

// --- Funcionalidad de exportación ---
exportPdfBtn.addEventListener("click", () => showPreview("pdf"));
exportJpgBtn.addEventListener("click", () => showPreview("jpg"));

async function showPreview(type) {
  if (allLayers.length === 0) {
    alert("No hay figuras marcadas para exportar.");
    return;
  }

  exportType = type;
  previewModal.style.display = "flex";

  // Capturar el estado actual del mapa (centro, zoom, rotación)
  const originalCenter = map.getCenter();
  const originalZoom = map.getZoom();
  const originalBearing = map.getBearing(); // Obtener la rotación actual

  // Ocultar controles antes de capturar la imagen para la vista previa
  const mapElement = document.getElementById("map");
  const originalControlPanelDisplay = controlPanel.style.display;
  const originalToggleBtnDisplay = toggleBtn.style.display;
  const leafletControls = mapElement.querySelectorAll('.leaflet-control-container');

  controlPanel.style.display = 'none';
  toggleBtn.style.display = 'none';
  leafletControls.forEach(el => el.style.display = 'none');

  try {
    const canvas = await html2canvas(mapElement, {
      backgroundColor: "#ffffff",
      useCORS: true,
      scale: 2,
    });

    previewImage.src = canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Error al generar la vista previa:", err);
    alert("Error al generar la vista previa: " + err.message);
    previewModal.style.display = "none";
  } finally {
    // Restaurar la visibilidad de los controles
    controlPanel.style.display = originalControlPanelDisplay;
    toggleBtn.style.display = originalToggleBtnDisplay;
    leafletControls.forEach(el => el.style.display = ''); // Restore default display
    // Restaurar el estado del mapa (esto se hará automáticamente al volver a interactuar con el mapa)
    map.setBearing(originalBearing);
  }
}

// Eventos del modal de vista previa
closeModalBtn.addEventListener("click", () => {
  previewModal.style.display = "none";
});

cancelExportBtn.addEventListener("click", () => {
  previewModal.style.display = "none";
});

confirmExportBtn.addEventListener("click", () => {
  previewModal.style.display = "none";
  exportMap(exportType); // Procede con la exportación
});

// Función de exportación final
async function exportMap(type) {
  const exportContainer = document.getElementById("exportMapContainer");
  const tempMapDiv = document.createElement('div');
  tempMapDiv.style.width = '12cm';
  tempMapDiv.style.height = '8cm';
  tempMapDiv.style.position = 'relative'; // Necesario para que html2canvas funcione bien
  exportContainer.style.display = 'block'; // Muestra el contenedor oculto temporalmente
  exportContainer.appendChild(tempMapDiv);

  // Crear un mapa temporal con las mismas opciones que el principal
  const tempMap = L.map(tempMapDiv, {
    minZoom: 2,
    maxZoom: 20,
    zoomControl: false, // Ocultar controles de zoom
    attributionControl: false, // Ocultar atribución
    rotate: true, // Habilita la rotación para el mapa temporal
    touchRotate: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20,
    minZoom: 0
  }).addTo(tempMap);

  // Replicar las capas dibujadas en el mapa temporal
  allLayers.forEach(layer => {
    let newLayer;
    if (layer instanceof L.Polygon) {
      newLayer = L.polygon(layer.getLatLngs(), layer.options).addTo(tempMap);
    } else if (layer instanceof L.Polyline) {
      newLayer = L.polyline(layer.getLatLngs(), layer.options).addTo(tempMap);
    } else if (layer instanceof L.CircleMarker) {
      newLayer = L.circleMarker(layer.getLatLng(), layer.options).addTo(tempMap);
    } else if (layer instanceof L.Marker && layer.options.icon && layer.options.icon.options.className === 'custom-free-label') {
        const iconOptions = layer.options.icon.options;
        const newIcon = L.divIcon({
            html: iconOptions.html,
            className: iconOptions.className,
            iconSize: iconOptions.iconSize,
            iconAnchor: iconOptions.iconAnchor
        });
        newLayer = L.marker(layer.getLatLng(), { icon: newIcon }).addTo(tempMap);
    }
    // Si la capa original tiene un tooltip, replicarlo
    if (layer.getTooltip && layer.getTooltip()) {
        const tooltipContent = layer.getTooltip().getContent();
        const tooltipOptions = layer.getTooltip().options;
        newLayer.bindTooltip(tooltipContent, tooltipOptions).openTooltip(newLayer.getBounds?.().getCenter() || newLayer.getLatLng());
    }
  });

  // Ajustar el mapa temporal a las figuras y centrarlo
  let bounds = null;
  if (allLayers.length > 0) {
    const featureGroup = L.featureGroup(allLayers.filter(l => l instanceof L.Path || l instanceof L.CircleMarker));
    if (featureGroup.getLayers().length > 0) {
      bounds = featureGroup.getBounds();
      tempMap.fitBounds(bounds, { padding: [10, 10], maxZoom: 18 }); // Pequeño padding para que no se pegue a los bordes
    }
  }

  // Sincronizar la rotación del mapa principal al mapa temporal
  tempMap.setBearing(map.getBearing());

  // Esperar un poco para que el mapa temporal se renderice completamente
  await new Promise(resolve => setTimeout(resolve, 500)); // Ajusta este tiempo si los tiles no cargan a tiempo

  try {
    const canvas = await html2canvas(tempMapDiv, {
      backgroundColor: "#ffffff",
      useCORS: true,
      scale: 3, // Mayor escala para la exportación final
    });

    const imgData = canvas.toDataURL("image/png");
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    if (type === "pdf") {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "landscape", // Horizontal
        unit: "mm",
        format: [120, 80] // Ancho: 120mm, Alto: 80mm
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgRatio = originalWidth / originalHeight;
      const pdfRatio = pdfWidth / pdfHeight;

      let drawW, drawH;
      if (imgRatio > pdfRatio) {
        drawW = pdfWidth;
        drawH = pdfWidth / imgRatio;
      } else {
        drawH = pdfHeight;
        drawW = pdfHeight * imgRatio;
      }

      const x = (pdfWidth - drawW) / 2;
      const y = (pdfHeight - drawH) / 2;

      pdf.addImage(imgData, "PNG", x, y, drawW, drawH);

      const titleLayer = allLayers.find(l => l.getTooltip && l.getTooltip());
      const title = titleLayer ? titleLayer.getTooltip().getContent() : "Mapa de Territorio";

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(title, pdfWidth / 2, 8, { align: 'center' });

      pdf.save("territorio.pdf");

    } else if (type === "jpg") {
      const targetWidthPx = 12 * 96 / 2.54; // Convertir cm a px (96dpi, 2.54cm/inch)
      const targetHeightPx = 8 * 96 / 2.54;

      const canvasJPG = document.createElement("canvas");
      canvasJPG.width = targetWidthPx;
      canvasJPG.height = targetHeightPx;
      const ctx = canvasJPG.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, targetWidthPx, targetHeightPx);

      const image = new Image();
      image.onload = () => {
        const imgRatio = originalWidth / originalHeight;
        const targetRatio = targetWidthPx / targetHeightPx;

        let drawW, drawH;
        if (imgRatio > targetRatio) {
          drawW = targetWidthPx;
          drawH = targetWidthPx / imgRatio;
        } else {
          drawH = targetHeightPx;
          drawW = targetHeightPx * imgRatio;
        }

        const dx = (targetWidthPx - drawW) / 2;
        const dy = (targetHeightPx - drawH) / 2;
        ctx.drawImage(image, dx, dy, drawW, drawH);

        const jpgURL = canvasJPG.toDataURL("image/jpeg", 0.95);
        const link = document.createElement("a");
        link.href = jpgURL;
        link.download = "territorio.jpg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      image.src = imgData;
    }
  } catch (err) {
    console.error("Error exportando el mapa:", err);
    alert("Error exportando el mapa: " + err.message);
  } finally {
    // Limpiar el mapa temporal y el contenedor
    tempMap.remove();
    exportContainer.removeChild(tempMapDiv);
    exportContainer.style.display = 'none'; // Oculta el contenedor de nuevo
  }
}
