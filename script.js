// Inicialización del mapa
const map = L.map('map').setView([41.3851, 2.1701], 15);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

// Variables de estado
let isMarking = false;
let currentPoints = [];
let allLayers = [];
let tempLayer = null;
let selectedColor = document.getElementById("colorPicker").value;

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

toggleBtn?.addEventListener("click", () => {
  controlPanel?.classList.toggle("collapsed");
  toggleBtn.textContent = controlPanel.classList.contains("collapsed") ? "Mostrar opciones" : "Ocultar opciones";
});
toggleBtn.textContent = controlPanel.classList.contains("collapsed") ? "Mostrar opciones" : "Ocultar opciones";

// Cambiar color dinámicamente
colorPicker.addEventListener("input", (e) => {
  selectedColor = e.target.value;
  if (tempLayer && isMarking && tempLayer.setStyle) {
    const style = { color: selectedColor, weight: 3, fillOpacity: 0, fillColor: "transparent", dashArray: '5, 5' };
    const pointStyle = { radius: 6, color: selectedColor, fillColor: selectedColor, fillOpacity: 0.5 };
    if (currentPoints.length >= 2) tempLayer.setStyle(style);
    else tempLayer.setStyle(pointStyle);
  }
});

// Dibujar figura temporal
function drawTemporaryShape() {
  if (tempLayer) map.removeLayer(tempLayer);
  const style = { color: selectedColor, weight: 3, fillOpacity: 0, fillColor: "transparent", dashArray: '5, 5' };
  const pointStyle = { radius: 6, color: selectedColor, fillColor: selectedColor, fillOpacity: 0.5 };

  if (currentPoints.length >= 3)
    tempLayer = L.polygon(currentPoints, style).addTo(map);
  else if (currentPoints.length === 2)
    tempLayer = L.polyline(currentPoints, style).addTo(map);
  else if (currentPoints.length === 1)
    tempLayer = L.circleMarker(currentPoints[0], pointStyle).addTo(map);
}

// Evento clic en el mapa
map.on("click", (e) => {
  if (!isMarking) return;
  currentPoints.push(e.latlng);
  drawTemporaryShape();
});

// Botón iniciar marcación
startBtn.addEventListener("click", () => {
  isMarking = true;
  currentPoints = [];
  if (tempLayer) map.removeLayer(tempLayer);
  tempLayer = null;

  labelTextInput.value = "";
  textAngleInput.value = "0";
  textSizeInput.value = "14";

  startBtn.disabled = true;
  saveBtn.disabled = false;
  undoBtn.disabled = false;
  resetBtn.disabled = false;

  alert("Toca el mapa para marcar puntos.");
});

// Botón deshacer
undoBtn.addEventListener("click", () => {
  if (currentPoints.length === 0) return;
  currentPoints.pop();
  if (tempLayer) {
    map.removeLayer(tempLayer);
    tempLayer = null;
  }
  drawTemporaryShape();
});

// Botón guardar figura
saveBtn.addEventListener("click", () => {
  if (currentPoints.length === 0) {
    alert("Marca al menos un punto.");
    return;
  }

  if (tempLayer) {
    const defaultName = "Territorio " + (allLayers.filter(l => l instanceof L.Path).length + 1);
    const nombre = prompt("Nombre de esta figura:", defaultName) || defaultName;

    tempLayer.options.customName = nombre;
    const center = tempLayer.getBounds?.().getCenter() || tempLayer.getLatLng();

    tempLayer.bindTooltip(nombre, { permanent: true, direction: "center", className: "custom-label" }).openTooltip(center);

    const finalStyle = {
      color: selectedColor, weight: 2, fillColor: "transparent", fillOpacity: 0, dashArray: null
    };
    const finalPointStyle = {
      radius: 6, color: selectedColor, fillColor: selectedColor, fillOpacity: 0.5
    };
    tempLayer.setStyle?.(tempLayer instanceof L.CircleMarker ? finalPointStyle : finalStyle);
    allLayers.push(tempLayer);

    const labelText = labelTextInput.value.trim();
    if (labelText) {
      const angle = parseFloat(textAngleInput.value) || 0;
      const fontSize = parseInt(textSizeInput.value) || 14;

      const labelIcon = L.divIcon({
        html: `<div style="transform: rotate(${angle}deg); font-size: ${fontSize}px; color: ${selectedColor};">${labelText}</div>`,
        className: "custom-free-label",
        iconSize: [labelText.length * fontSize * 0.6, fontSize + 4],
        iconAnchor: [labelText.length * fontSize * 0.3, (fontSize + 4) / 2]
      });
      const labelMarker = L.marker(center, { icon: labelIcon }).addTo(map);
      allLayers.push(labelMarker);
    }

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

// Botón reiniciar
resetBtn.addEventListener("click", () => {
  if (!confirm("¿Reiniciar todo? Esto eliminará todos los dibujos.")) return;
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
});

// Exportar
exportPdfBtn.addEventListener("click", () => exportMap("pdf"));
exportJpgBtn.addEventListener("click", () => exportMap("jpg"));
function exportMap(type) {
  if (allLayers.length === 0) {
    alert("No hay figuras marcadas para exportar.");
    return;
  }

  // Ocultar controles antes de capturar
  html2canvas(document.getElementById("map"), {
    backgroundColor: "#ffffff",
    useCORS: true,
    scale: 2,
    onclone: (doc) => {
      const hide = ['.leaflet-control-container', '#controlPanel', '#toggleControlsBtn'];
      hide.forEach(sel => {
        doc.querySelectorAll(sel).forEach(el => el.style.display = 'none');
      });
    }
  }).then(canvas => {
    const imgData = canvas.toDataURL("image/png");
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    if (type === "pdf") {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a6" });

      const title = allLayers.find(l => l.getTooltip)?.getTooltip()?.getContent() || "Territorio";

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(title, 148 / 2, 10, { align: 'center' });

      const margin = 7;
      const contentW = 148 - margin * 2;
      const contentH = 105 - margin * 2 - 10;
      const imgRatio = originalWidth / originalHeight;
      const boxRatio = contentW / contentH;

      let drawW, drawH;
      if (imgRatio > boxRatio) {
        drawW = contentW;
        drawH = contentW / imgRatio;
      } else {
        drawH = contentH;
        drawW = contentH * imgRatio;
      }

      const x = (148 - drawW) / 2;
      const y = 10 + (contentH - drawH) / 2;
      pdf.addImage(imgData, "PNG", x, y, drawW, drawH);
      pdf.save("territorio-A6.pdf");
    } else if (type === "jpg") {
      const canvasJPG = document.createElement("canvas");
      canvasJPG.width = 420;
      canvasJPG.height = 297;
      const ctx = canvasJPG.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 420, 297);

      const image = new Image();
      image.onload = () => {
        const imgRatio = originalWidth / originalHeight;
        const targetRatio = 420 / 297;
        let drawW, drawH;
        if (imgRatio > targetRatio) {
          drawW = 420;
          drawH = 420 / imgRatio;
        } else {
          drawH = 297;
          drawW = 297 * imgRatio;
        }

        const dx = (420 - drawW) / 2;
        const dy = (297 - drawH) / 2;
        ctx.drawImage(image, dx, dy, drawW, drawH);

        const jpgURL = canvasJPG.toDataURL("image/jpeg", 0.92);
        const link = document.createElement("a");
        link.href = jpgURL;
        link.download = "territorio-A6.jpg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      image.src = imgData;
    }
  }).catch(err => {
    alert("Error exportando el mapa: " + err.message);
  });
}