const map = L.map('map').setView([41.3851, 2.1701], 15);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & Carto',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

let isMarking = false;
let currentPoints = [];
let allLayers = [];
let tempLayer = null;
let selectedColor = document.getElementById("colorPicker").value;

const startBtn = document.getElementById("startMarkingBtn");
const saveBtn = document.getElementById("saveShapeBtn");
const undoBtn = document.getElementById("undoPointBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportJpgBtn = document.getElementById("exportJpgBtn");
const resetBtn = document.getElementById("resetBtn");

document.getElementById("colorPicker").addEventListener("input", (e) => {
  selectedColor = e.target.value;
});

startBtn.addEventListener("click", () => {
  isMarking = true;
  currentPoints = [];
  if (tempLayer) map.removeLayer(tempLayer);
  tempLayer = null;

  startBtn.disabled = true;
  saveBtn.disabled = false;
  undoBtn.disabled = false;
  resetBtn.disabled = false;
  alert("Toca el mapa para marcar puntos.");
});

saveBtn.addEventListener("click", () => {
  if (currentPoints.length < 2) {
    alert("Marca al menos dos puntos.");
    return;
  }

  if (tempLayer) {
    const nombre = prompt("Nombre de esta figura:", `Figura ${allLayers.length + 1}`) || `Figura ${allLayers.length + 1}`;
    const labelText = document.getElementById("labelText").value.trim();
    const angle = parseFloat(document.getElementById("textAngle").value) || 0;
    const fontSize = parseInt(document.getElementById("textSize").value) || 14;
    const center = tempLayer.getBounds().getCenter();

    tempLayer.bindTooltip(nombre, {
      permanent: true,
      direction: "center",
      className: "custom-label"
    }).openTooltip(center);

    if (labelText) {
      const textEl = L.divIcon({
        html: `<div style="transform: rotate(${angle}deg); font-size: ${fontSize}px; color: ${selectedColor};">${labelText}</div>`,
        className: "custom-free-label",
        iconSize: [100, 30]
      });

      const textMarker = L.marker(center, { icon: textEl }).addTo(map);
      allLayers.push(textMarker);
    }

    allLayers.push(tempLayer);
    tempLayer = null;
    currentPoints = [];
  }

  isMarking = false;
  startBtn.disabled = false;
  saveBtn.disabled = true;
  undoBtn.disabled = true;
  exportPdfBtn.disabled = false;
  exportJpgBtn.disabled = false;
  alert("Figura guardada. Puedes crear otra.");
});

undoBtn.addEventListener("click", () => {
  if (currentPoints.length === 0) return;

  currentPoints.pop();
  if (tempLayer) {
    map.removeLayer(tempLayer);
    tempLayer = null;
  }

  const style = {
    color: selectedColor,
    weight: 2,
    fillOpacity: 0
  };

  if (currentPoints.length >= 3) {
    tempLayer = L.polygon(currentPoints, style).addTo(map);
  } else if (currentPoints.length === 2) {
    tempLayer = L.polyline(currentPoints, style).addTo(map);
  } else if (currentPoints.length === 1) {
    tempLayer = L.circleMarker(currentPoints[0], {
      radius: 6,
      color: selectedColor
    }).addTo(map);
  }
});

resetBtn.addEventListener("click", () => {
  allLayers.forEach(layer => map.removeLayer(layer));
  if (tempLayer) map.removeLayer(tempLayer);
  allLayers = [];
  currentPoints = [];
  tempLayer = null;
  isMarking = false;

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

  if (tempLayer) map.removeLayer(tempLayer);

  const style = {
    color: selectedColor,
    weight: 2,
    fillOpacity: 0
  };

  if (currentPoints.length >= 3) {
    tempLayer = L.polygon(currentPoints, style).addTo(map);
  } else if (currentPoints.length === 2) {
    tempLayer = L.polyline(currentPoints, style).addTo(map);
  } else {
    tempLayer = L.circleMarker(latlng, {
      radius: 6,
      color: selectedColor
    }).addTo(map);
  }
});

exportPdfBtn.addEventListener("click", () => exportMap("pdf"));
exportJpgBtn.addEventListener("click", () => exportMap("jpg"));

function exportMap(type) {
  if (allLayers.length === 0) {
    alert("No hay figuras marcadas.");
    return;
  }

  const group = L.featureGroup(allLayers);
  map.flyToBounds(group.getBounds(), { animate: false });

  setTimeout(() => {
    html2canvas(document.getElementById("map"), {
      backgroundColor: "#ffffff",
      useCORS: true
    }).then(canvas => {
      const imgData = canvas.toDataURL(
        type === "jpg" ? "image/jpeg" : "image/png",
        0.95
      );

      if (type === "pdf") {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save("mapa-exportado.pdf");
      } else {
        const link = document.createElement("a");
        link.href = imgData;
        link.download = "mapa-exportado.jpg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }, 700);
}

// Control de despliegue del panel
const toggleBtn = document.getElementById("toggleControlsBtn");
const controlPanel = document.getElementById("controlPanel");

toggleBtn.addEventListener("click", () => {
  controlPanel.classList.toggle("collapsed");
  toggleBtn.textContent = controlPanel.classList.contains("collapsed")
    ? "Mostrar opciones"
    : "Ocultar opciones";
});