let loadPromise = null;

async function ensureLibraries() {
  // 이미 로드 완료된 경우
  if (window.html2canvas && window.jspdf?.jsPDF) {
    return;
  }

  // 이미 로딩 중인 경우, 같은 Promise 반환 (race condition 방지)
  if (loadPromise) {
    return loadPromise;
  }

  // 새로운 로딩 시작
  loadPromise = (async () => {
    const html2canvasScript = document.createElement("script");
    html2canvasScript.src =
      "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

    const jspdfScript = document.createElement("script");
    jspdfScript.src =
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";

    await Promise.all([
      new Promise((resolve, reject) => {
        html2canvasScript.onload = resolve;
        html2canvasScript.onerror = reject;
        document.head.appendChild(html2canvasScript);
      }),
      new Promise((resolve, reject) => {
        jspdfScript.onload = resolve;
        jspdfScript.onerror = reject;
        document.head.appendChild(jspdfScript);
      }),
    ]);

    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      throw new Error(
        "내보내기 라이브러리를 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
      );
    }
  })();

  return loadPromise;
}

function sanitizeFilename(name) {
  return (name || "modum-auction")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

export async function exportElementAsImage(element, filename) {
  try {
    await ensureLibraries();
    const canvas = await window.html2canvas(element, {
      backgroundColor: "#fff8ec",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `${sanitizeFilename(filename)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    console.error("Image export failed:", error);
    throw new Error("이미지 저장에 실패했습니다. " + (error.message || ""));
  }
}

export async function exportElementAsPdf(element, filename) {
  try {
    await ensureLibraries();
    const canvas = await window.html2canvas(element, {
      backgroundColor: "#fff8ec",
      scale: 2,
      useCORS: true,
    });
    const imageData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "pt",
      format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const imageWidth = canvas.width * ratio;
    const imageHeight = canvas.height * ratio;
    const x = (pageWidth - imageWidth) / 2;
    const y = (pageHeight - imageHeight) / 2;
    pdf.addImage(imageData, "PNG", x, y, imageWidth, imageHeight);
    pdf.save(`${sanitizeFilename(filename)}.pdf`);
  } catch (error) {
    console.error("PDF export failed:", error);
    throw new Error("PDF 저장에 실패했습니다. " + (error.message || ""));
  }
}
