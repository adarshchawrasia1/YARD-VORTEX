(function () {
  const container = document.getElementById("page-utensil-bg");
  if (!container) return;

  /** Single-path 24×24 outlines — home / appliance / energy (Heroicons-style) */
  const ICON_PATHS = [
    "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z",
    "M6 20.25h12m-7.5-3v3m4.5-3v3m-9-1.5h10.5A2.25 2.25 0 0020.25 18V6.75A2.25 2.25 0 0018 4.5H6A2.25 2.25 0 003.75 6.75V18A2.25 2.25 0 006 20.25z",
    "M4.5 4.5h15A1.5 1.5 0 0121 6v12a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18V6a1.5 1.5 0 011.5-1.5z M7.5 9h9 M7.5 13.5h9",
    "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z",
    "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99",
    "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
    "M12 4.5v15m7.5-7.5h-15",
    "M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9",
    "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3",
    "M9 17.25h6M3.375 19.125h17.25a.75.75 0 00.75-.75v-10.5a2.25 2.25 0 00-2.25-2.25H5.125a2.25 2.25 0 00-2.25 2.25v10.5c0 .414.336.75.75.75zM7.5 6.75h9a2.25 2.25 0 012.25 2.25v2.25H5.25V9a2.25 2.25 0 012.25-2.25z",
    "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 0v3.375c0 .621-.504 1.125-1.125 1.125H18.75m-18-6h3.75c0 3.728 3.022 6.75 6.75 6.75s6.75-3.022 6.75-6.75h3.75m-18 0v-3.75c0-.621.504-1.125 1.125-1.125h5.25a1.125 1.125 0 011.125 1.125v3.75m9-3.75c0-.621-.504-1.125-1.125-1.125h-5.25a1.125 1.125 0 00-1.125 1.125v3.75",
    "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
    "M3.75 4.5h16.5M4.5 19.5h15M6.5 4.5v15m11-15v15M10.5 8.625h3m-2.25 4.125h1.5m-2.25 7.5h3",
    "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.97l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z",
    "M6.75 3v11.25M17.25 3v11.25m-12 4.5h14.25m-14.25 0a3 3 0 103 3m-3-3a3 3 0 113 3m3-3v-.75m0 0a3 3 0 00-3-3h-.75m3 3h3.75m-3.75 0v-.75m0-.75V12",
    "M21 10.5h.375a.375.375 0 01.375.375v2.25a.375.375 0 01-.375.375H21M3.75 18h15A2.25 2.25 0 0021 15.75v-7.5A2.25 2.25 0 0018.75 6h-15A2.25 2.25 0 003 8.25v7.5A2.25 2.25 0 006 18z",
    "M2.25 15a4.5 4.5 0 004.5 4.5h8.75a3.75 3.75 0 00.105-7.5H18a4.5 4.5 0 01-4.5-4.5V9a3 3 0 00-3-3h-.75A3.75 3.75 0 002.25 9v6z",
    "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  ];

  const COLORS = [
    "rgba(56, 189, 248, 0.12)",
    "rgba(34, 211, 238, 0.11)",
    "rgba(52, 211, 153, 0.11)",
    "rgba(16, 185, 129, 0.10)",
    "rgba(167, 139, 250, 0.10)",
    "rgba(196, 181, 253, 0.09)",
    "rgba(251, 191, 36, 0.10)",
    "rgba(252, 211, 77, 0.09)",
    "rgba(148, 163, 184, 0.11)",
    "rgba(100, 116, 139, 0.10)",
  ];

  const COUNT = 300;
  const SIZE_MIN = 40;
  const SIZE_MAX = 54;
  /** Half diagonal of square glyph + gap — circles with this radius never overlap for any rotation */
  const PADDING = 7;
  const SQRT2 = Math.SQRT2;
  const pathsLen = ICON_PATHS.length;
  const colorsLen = COLORS.length;

  function collisionRadius(sizePx) {
    return (sizePx * SQRT2) / 2 + PADDING;
  }

  function svgMarkup(pathD, stroke, sizePx, strokeW) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      sizePx +
      '" height="' +
      sizePx +
      '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path stroke="' +
      stroke +
      '" stroke-width="' +
      strokeW +
      '" stroke-linecap="round" stroke-linejoin="round" d="' +
      pathD +
      '"/></svg>'
    );
  }

  function overlaps(x, y, r, placed) {
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      const dx = x - p.x;
      const dy = y - p.y;
      const need = r + p.r;
      if (dx * dx + dy * dy < need * need) return true;
    }
    return false;
  }

  function buildIcons() {
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    const maxR = collisionRadius(SIZE_MAX);
    const margin = maxR + 4;
    if (w < margin * 2 || h < margin * 2) return;

    container.innerHTML = "";

    const sizes = [];
    for (let i = 0; i < COUNT; i++) {
      sizes.push(SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN));
    }
    sizes.sort(function (a, b) {
      return b - a;
    });

    const placed = [];
    const frag = document.createDocumentFragment();
    const innerW = w - 2 * margin;
    const innerH = h - 2 * margin;
    const maxAttempts = 140;

    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      const r = collisionRadius(size);
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = margin + Math.random() * innerW;
        const y = margin + Math.random() * innerH;
        if (overlaps(x, y, r, placed)) continue;
        placed.push({ x: x, y: y, r: r });

        const span = document.createElement("span");
        span.className = "phantom-bg-icon absolute select-none";
        const rot = Math.random() * 360;
        const path = ICON_PATHS[(Math.random() * pathsLen) | 0];
        const color = COLORS[(Math.random() * colorsLen) | 0];
        const strokeW = 1.2 + Math.random() * 0.35;
        const opacity = 0.55 + Math.random() * 0.45;

        span.style.left = (x / w) * 100 + "%";
        span.style.top = (y / h) * 100 + "%";
        span.style.transform = "translate(-50%, -50%) rotate(" + rot + "deg)";
        span.style.opacity = String(opacity);
        span.innerHTML = svgMarkup(path, color, size, strokeW.toFixed(2));
        frag.appendChild(span);
        break;
      }
    }

    container.appendChild(frag);
  }

  buildIcons();

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildIcons, 200);
  });
})();
