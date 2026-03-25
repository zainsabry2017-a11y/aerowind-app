// ── Export Utilities ────────────────────────────────────
// Client-side CSV, PNG, PDF, and print export
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

export function exportJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
  downloadBlob(blob, filename);
}

export function exportSVGAsPNG(svgElement: SVGElement, filename: string, scale: number = 3) {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename);
    }, "image/png");
  };
  img.src = url;
}

export function printElement(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;

  // ── Serialize all <svg> elements to inline data-URIs so they survive the iframe ──
  const cloned = el.cloneNode(true) as HTMLElement;
  const svgs = el.querySelectorAll("svg");
  const clonedSvgs = cloned.querySelectorAll("svg");
  svgs.forEach((svg, idx) => {
    try {
      const serialized = new XMLSerializer().serializeToString(svg);
      const b64 = btoa(unescape(encodeURIComponent(serialized)));
      const img = document.createElement("img");
      img.src = `data:image/svg+xml;base64,${b64}`;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.style.margin = "8px 0";
      clonedSvgs[idx]?.replaceWith(img);
    } catch (_) { /* keep original if serialization fails */ }
  });

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>AeroWind Engineering Report</title>
        <style>
          /* ── Reset / globals ──────────────────────── */
          @page { size: A4 portrait; margin: 18mm 15mm 18mm 15mm; }
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          /* ── CSS variable overrides — resolve dark-mode tokens to print-safe values ── */
          :root, body, [class*="dark"] {
            --background: #ffffff;
            --foreground: #111111;
            --card: #ffffff;
            --card-foreground: #111111;
            --muted: #f3f4f6;
            --muted-foreground: #6b7280;
            --border: #d1d5db;
            --input: #d1d5db;
            --primary: #0891b2;
            --primary-foreground: #ffffff;
            --secondary: #f3f4f6;
            --secondary-foreground: #111111;
            --accent: #f3f4f6;
            --accent-foreground: #111111;
            --destructive: #dc2626;
            --warning: #d97706;
            --success: #16a34a;
            color-scheme: light !important;
          }

          /* ── Typography ───────────────────────────── */
          body {
            font-family: Arial, sans-serif;
            color: #111111;
            font-size: 11pt;
            line-height: 1.55;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          h1  { font-size: 20pt; font-weight: 700; color: #111; margin-bottom: 6pt; font-family: Arial, sans-serif; }
          h2  { font-size: 13.5pt; font-weight: 700; color: #0f172a; margin: 14pt 0 6pt; border-bottom: 1.25pt solid #cbd5e1; padding-bottom: 3pt; font-family: Arial, sans-serif; }
          h3  { font-size: 11.5pt; font-weight: 700; color: #0f172a; margin: 10pt 0 4pt; font-family: Arial, sans-serif; }
          p   { margin-bottom: 6pt; }

          /* ── Tables ───────────────────────────────── */
          table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 10pt; page-break-inside: avoid; }
          th, td { border: 0.75pt solid #d1d5db; padding: 5pt 8pt; vertical-align: top; text-align: left; }
          th { background-color: #f8fafc !important; font-family: Arial, sans-serif; font-size: 8.5pt; font-weight: 700; color: #0f172a; }
          tr:nth-child(even) td { background-color: #ffffff; }

          /* ── Utility overrides ────────────────────── */
          .font-mono-data, code, .font-mono { font-family: Arial, sans-serif !important; }
          .font-serif-report { font-family: Arial, sans-serif !important; }
          .text-primary, [class*="text-primary"] { color: #111 !important; }
          .text-muted-foreground, [class*="text-muted"] { color: #6b7280 !important; }
          .bg-primary { background-color: #ffffff !important; color: #111 !important; }
          .bg-muted, [class*="bg-muted"] { background-color: #ffffff !important; }
          .border, [class*="border-border"] { border-color: #d1d5db !important; }
          [class*="opacity-"] { opacity: 1 !important; }
          [class*="bg-amber"], [class*="bg-warning"] { background-color: #ffffff !important; }
          [class*="bg-emerald"], [class*="bg-green"] { background-color: #ffffff !important; }
          [class*="bg-primary"] { background-color: #ffffff !important; }
          [class*="bg-blue"] { background-color: #ffffff !important; }
          [class*="border-l-amber"], [class*="border-amber"] { border-color: #d97706 !important; }
          [class*="border-l-primary"], [class*="border-primary"] { border-color: #0891b2 !important; }
          [class*="border-l-blue"], [class*="border-blue"] { border-color: #2563eb !important; }
          [class*="text-amber"] { color: #92400e !important; }
          [class*="text-blue"] { color: #1e40af !important; }
          [class*="text-emerald"], [class*="text-green"] { color: #065f46 !important; }
          [class*="text-destructive"] { color: #dc2626 !important; }
          [class*="dark\\:"] { /* strip dark variants */ }

          /* ── Images and SVG ───────────────────────── */
          img, svg { max-width: 100%; height: auto; page-break-inside: avoid; }

          /* ── Page breaks ──────────────────────────── */
          .report-cover-page { page-break-after: always; text-align: center; padding: 80pt 30pt; }
          .report-toc-page { page-break-after: always; padding: 20pt 0; }
          .report-facility-block { page-break-before: always; }
          .page-break-before { page-break-before: always; }
          .break-inside-avoid, .page-break-inside-avoid { page-break-inside: avoid; }

          /* ── Section numbers ──────────────────────── */
          .section-num { font-family: Arial, sans-serif; color: #111; font-size: 9pt; margin-right: 8pt; }

          /* ── Callout blocks ───────────────────────── */
          .disclaimer, [class*="bg-amber/10"], [class*="bg-warning"] {
            background-color: #ffffff !important;
            border-left: 3pt solid #d1d5db !important;
            padding: 8pt 12pt;
            margin: 8pt 0;
            font-size: 9pt;
          }

          /* ── Gradient / gradient covers ──────────── */
          [class*="bg-gradient"] { background: #ffffff !important; }

          /* ── Hide interactive UI chrome ───────────── */
          button, [class*="hover\\:"], .no-print { display: none !important; }

          /* ── Data readouts ────────────────────────── */
          .readout { border-left: 2pt solid #0f172a; padding: 6pt 10pt; margin: 3pt 0; }
          .readout-value { font-size: 16pt; font-weight: 700; font-family: Arial, sans-serif; }

          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>${cloned.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  // Wait for images to load before printing (prevents missing charts)
  const waitForImages = async () => {
    const imgs = Array.from(printWindow.document.images || []);
    await Promise.all(
      imgs.map(async (img) => {
        try {
          // decode() is best-effort; fallback to load event
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dec = (img as any).decode;
          if (typeof dec === "function") {
            await dec.call(img);
          } else if (!img.complete) {
            await new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            });
          }
        } catch (_) {
          // ignore decode failures
        }
      })
    );
  };

  setTimeout(async () => {
    await waitForImages();
    printWindow.focus();
    printWindow.print();
  }, 400);
}

// ── PDF-style export via print ─────────────────────────
// Uses browser print dialog → Save as PDF for clean output

export function exportReportPDF(elementId: string) {
  printElement(elementId);
}

export function printHTML(html: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();

  const waitForImages = async () => {
    const imgs = Array.from(printWindow.document.images || []);
    await Promise.all(
      imgs.map(async (img) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dec = (img as any).decode;
          if (typeof dec === "function") {
            await dec.call(img);
          } else if (!img.complete) {
            await new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            });
          }
        } catch (_) {}
      })
    );
  };

  setTimeout(async () => {
    await waitForImages();
    printWindow.focus();
    printWindow.print();
  }, 300);
}

export async function exportHTMLAsPDF(html: string, filename: string) {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.background = "#ffffff";
  document.body.appendChild(host);

  try {
    host.innerHTML = html;
    const pages = Array.from(host.querySelectorAll<HTMLElement>(".page"));
    const targets = pages.length ? pages : [host as unknown as HTMLElement];

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginMm = 8;
    const contentWidth = pageWidth - marginMm * 2;
    const contentHeight = pageHeight - marginMm * 2;

    let first = true;
    for (const t of targets) {
      const canvas = await html2canvas(t, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
        logging: false,
      });
      const img = canvas.toDataURL("image/png", 1.0);
      if (!first) pdf.addPage();
      first = false;

      const imgProps = pdf.getImageProperties(img);
      const imgWidth = contentWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      const scaleFit = imgHeight > contentHeight ? contentHeight / imgHeight : 1;
      pdf.addImage(img, "PNG", marginMm, marginMm, imgWidth * scaleFit, imgHeight * scaleFit, undefined, "FAST");
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(host);
  }
}

function cloneAndInlineSvgs(el: HTMLElement): HTMLElement {
  const cloned = el.cloneNode(true) as HTMLElement;
  const svgs = el.querySelectorAll("svg");
  const clonedSvgs = cloned.querySelectorAll("svg");
  svgs.forEach((svg, idx) => {
    try {
      const serialized = new XMLSerializer().serializeToString(svg);
      const b64 = btoa(unescape(encodeURIComponent(serialized)));
      const img = document.createElement("img");
      img.src = `data:image/svg+xml;base64,${b64}`;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.style.margin = "8px 0";
      clonedSvgs[idx]?.replaceWith(img);
    } catch (_) {
      // keep original if serialization fails
    }
  });
  return cloned;
}

function applyProfessionalExportOverrides(cloned: HTMLElement) {
  cloned.style.fontFamily = "Arial, sans-serif";
  cloned.style.background = "#ffffff";
  cloned.style.color = "#111111";

  const style = document.createElement("style");
  style.textContent = `
    :root { color-scheme: light; }
    * { font-family: Arial, sans-serif !important; background-image: none !important; }
    body { background: #ffffff !important; color: #111111 !important; font-size: 11pt !important; line-height: 1.55 !important; }

    /* Make layout clean and printable (keep structure) */
    [class*="bg-gradient"] { background: #ffffff !important; }
    [class*="shadow"], .shadow-sm, .shadow-custom { box-shadow: none !important; }

    /* Force white cards but preserve borders/padding */
    .bg-card, .bg-muted, .bg-secondary, .bg-primary,
    [class*="bg-card"], [class*="bg-muted"], [class*="bg-secondary"], [class*="bg-primary"] { background-color: #ffffff !important; }

    /* Text colors */
    .text-foreground { color: #111111 !important; }
    .text-muted-foreground, [class*="text-muted"] { color: #4b5563 !important; }
    .text-primary, [class*="text-primary"] { color: #0f172a !important; }
    h1, h2, h3, h4 { color: #0f172a !important; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; }
    th, td { border-color: #d1d5db !important; background: #ffffff !important; }
    th { font-weight: 700 !important; background: #f8fafc !important; }
    tr:nth-child(even) td { background: #ffffff !important; }

    /* Borders */
    [class*="border-"], .border { border-color: #d1d5db !important; }

    /* Remove colored callout fills but keep left border as gray */
    [class*="bg-amber"], [class*="bg-warning"],
    [class*="bg-emerald"], [class*="bg-green"],
    [class*="bg-blue"] { background-color: #ffffff !important; }
    [class*="border-l-"] { border-left-color: #d1d5db !important; }
  `;
  cloned.prepend(style);
}

async function inlineImagesToDataUri(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
      try {
        const res = await fetch(src, { mode: "cors" });
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(blob);
        });
        img.setAttribute("src", dataUrl);
      } catch (_) {
        // If CORS blocks it, leave it as-is; html2canvas may still render same-origin assets.
      }
    })
  );
}

export async function exportElementAsPDF(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const cloned = cloneAndInlineSvgs(el);
  applyProfessionalExportOverrides(cloned);
  cloned.style.position = "fixed";
  cloned.style.left = "-100000px";
  cloned.style.top = "0";
  cloned.style.width = "210mm";
  document.body.appendChild(cloned);

  try {
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginMm = 10;
    const contentWidth = pageWidth - marginMm * 2;
    const contentHeight = pageHeight - marginMm * 2;

    // Inline external <img> sources to reduce "missing images".
    await inlineImagesToDataUri(cloned);

    // Render in logical blocks to reduce bad page breaks.
    const blocks: HTMLElement[] = [];
    const cover = cloned.querySelector<HTMLElement>(".report-cover-page");
    const toc = cloned.querySelector<HTMLElement>(".report-toc-page");
    if (cover) blocks.push(cover);
    if (toc) blocks.push(toc);
    blocks.push(...Array.from(cloned.querySelectorAll<HTMLElement>(".report-facility-block")));
    blocks.push(...Array.from(cloned.querySelectorAll<HTMLElement>(".page-break-before")));
    if (blocks.length === 0) blocks.push(cloned);

    let firstPage = true;
    for (const block of blocks) {
      const canvas = await html2canvas(block, {
        backgroundColor: "#ffffff",
        scale: Math.max(2, Math.min(3, window.devicePixelRatio || 1)),
        useCORS: true,
        logging: false,
        windowWidth: cloned.scrollWidth,
      });

      const pageImages = sliceCanvasToA4Pages(canvas);
      for (const img of pageImages) {
        if (!firstPage) pdf.addPage();
        firstPage = false;
        const imgProps = pdf.getImageProperties(img);
        const imgWidth = contentWidth;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        const scaleFit = imgHeight > contentHeight ? contentHeight / imgHeight : 1;
        const finalW = imgWidth * scaleFit;
        const finalH = imgHeight * scaleFit;
        pdf.addImage(img, "PNG", marginMm, marginMm, finalW, finalH, undefined, "FAST");
      }
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(cloned);
  }
}

export function exportHTMLAsWordDoc(html: string, filename: string) {
  const blob = new Blob([html], { type: "application/msword;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function sliceCanvasToA4Pages(canvas: HTMLCanvasElement) {
  // Using PDF's A4 aspect ratio: 210mm x 297mm
  const pageAspect = 297 / 210;
  const pageWidthPx = canvas.width;
  const pageHeightPx = Math.floor(pageWidthPx * pageAspect);

  const pages: string[] = [];
  let y = 0;

  while (y < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - y);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = pageWidthPx;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, y, pageWidthPx, sliceHeight, 0, 0, pageWidthPx, sliceHeight);
    pages.push(pageCanvas.toDataURL("image/png", 1.0));
    y += sliceHeight;
  }

  return pages;
}

export async function exportElementAsWordDoc(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const cloned = cloneAndInlineSvgs(el);
  cloned.style.background = "#ffffff";
  cloned.style.color = "#111111";
  cloned.style.position = "fixed";
  cloned.style.left = "-100000px";
  cloned.style.top = "0";
  cloned.style.width = "210mm";
  document.body.appendChild(cloned);

  try {
    const canvas = await html2canvas(cloned, {
      backgroundColor: "#ffffff",
      scale: Math.min(2, window.devicePixelRatio || 1),
      useCORS: true,
      logging: false,
      windowWidth: cloned.scrollWidth,
    });

    const pages = sliceCanvasToA4Pages(canvas);

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>AeroWind Engineering Report</title>
        <style>
          @page { size: A4 portrait; margin: 15mm 12mm; }
          body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; background: #fff; }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          img { width: 100%; height: auto; display: block; border: none; }
        </style>
      </head>
      <body>
        ${pages.map((src) => `<div class="page"><img src="${src}" alt="Report page"/></div>`).join("")}
      </body>
      </html>
    `;

    exportHTMLAsWordDoc(html, filename);
  } finally {
    document.body.removeChild(cloned);
  }
}


// ── Excel/XLSX export ──────────────────────────────────

export function exportXLSX(filename: string, headers: string[], rows: string[][]) {
  // Dynamically import xlsx to keep bundle lean
  import("xlsx").then((XLSX) => {
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-width columns
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map(r => (r[i] || "").length));
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, filename);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
