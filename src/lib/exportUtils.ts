// ── Export Utilities ────────────────────────────────────
// Client-side CSV, PNG, PDF, and print export

export function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
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
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Serif:wght@400;500;600&display=swap" rel="stylesheet">
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
            font-family: 'IBM Plex Serif', Georgia, serif;
            color: #111111;
            font-size: 10.5pt;
            line-height: 1.65;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          h1  { font-size: 20pt; font-weight: 700; color: #111; margin-bottom: 6pt; font-family: 'IBM Plex Sans', sans-serif; }
          h2  { font-size: 13pt; font-weight: 600; color: #0891b2; margin: 14pt 0 6pt; border-bottom: 1.5pt solid #d1d5db; padding-bottom: 3pt; font-family: 'IBM Plex Sans', sans-serif; }
          h3  { font-size: 11pt; font-weight: 600; color: #111; margin: 10pt 0 4pt; font-family: 'IBM Plex Sans', sans-serif; }
          p   { margin-bottom: 6pt; }

          /* ── Tables ───────────────────────────────── */
          table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 10pt; page-break-inside: avoid; }
          th, td { border: 0.75pt solid #d1d5db; padding: 5pt 8pt; vertical-align: top; text-align: left; }
          th { background-color: #f0f4f8 !important; font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: #374151; }
          tr:nth-child(even) td { background-color: #f9fafb; }

          /* ── Utility overrides ────────────────────── */
          .font-mono-data, code, .font-mono { font-family: 'IBM Plex Mono', monospace !important; }
          .font-serif-report { font-family: 'IBM Plex Serif', Georgia, serif !important; }
          .text-primary, [class*="text-primary"] { color: #0891b2 !important; }
          .text-muted-foreground, [class*="text-muted"] { color: #6b7280 !important; }
          .bg-primary { background-color: #0891b2 !important; color: #fff !important; }
          .bg-muted, [class*="bg-muted"] { background-color: #f3f4f6 !important; }
          .border, [class*="border-border"] { border-color: #d1d5db !important; }
          [class*="opacity-"] { opacity: 1 !important; }
          [class*="bg-amber"], [class*="bg-warning"] { background-color: #fef9c3 !important; }
          [class*="bg-emerald"], [class*="bg-green"] { background-color: #d1fae5 !important; }
          [class*="bg-primary"] { background-color: #e0f2fe !important; }
          [class*="bg-blue"] { background-color: #dbeafe !important; }
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
          .section-num { font-family: 'IBM Plex Mono', monospace; color: #0891b2; font-size: 9pt; margin-right: 8pt; }

          /* ── Callout blocks ───────────────────────── */
          .disclaimer, [class*="bg-amber/10"], [class*="bg-warning"] {
            background-color: #fef9c3 !important;
            border-left: 3pt solid #d97706 !important;
            padding: 8pt 12pt;
            margin: 8pt 0;
            font-size: 9pt;
          }

          /* ── Gradient / gradient covers ──────────── */
          [class*="bg-gradient"] { background: #f0f4f8 !important; }

          /* ── Hide interactive UI chrome ───────────── */
          button, [class*="hover\\:"], .no-print { display: none !important; }

          /* ── Data readouts ────────────────────────── */
          .readout { border-left: 2pt solid #0891b2; padding: 6pt 10pt; margin: 3pt 0; }
          .readout-value { font-size: 16pt; font-weight: 700; font-family: 'IBM Plex Sans', sans-serif; }

          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>${cloned.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 800);
}

// ── PDF-style export via print ─────────────────────────
// Uses browser print dialog → Save as PDF for clean output

export function exportReportPDF(elementId: string) {
  printElement(elementId);
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
