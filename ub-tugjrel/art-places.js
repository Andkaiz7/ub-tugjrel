(function (root) {
  var KINDS = [
    'palace',
    'skytower',
    'flats',
    'memorial',
    'hill',
    'market',
    'ger',
    'pines',
    'generic'
  ];

  var FLATS_PALETTES = [
    { wall: '#f6c9a8', shade: '#dda984', trim: '#c78f6a' },
    { wall: '#f5e3a1', shade: '#dcc77f', trim: '#bfa862' },
    { wall: '#bfe3cf', shade: '#9ac6ae', trim: '#7ba88f' },
    { wall: '#bcd7f0', shade: '#98b9d9', trim: '#789ab9' }
  ];

  var MARKET_COLORS = [
    { top: '#ef4444', wall: '#b91c1c' },
    { top: '#2563eb', wall: '#1d4ed8' },
    { top: '#16a34a', wall: '#15803d' },
    { top: '#f97316', wall: '#c2410c' }
  ];

  var HOUSE_ROOFS = [
    { top: '#2563eb', shade: '#1d4ed8' },
    { top: '#16a34a', shade: '#15803d' },
    { top: '#dc2626', shade: '#b91c1c' }
  ];

  var MOSAIC_COLORS = ['#ef4444', '#2563eb', '#facc15', '#22c55e', '#f8fafc'];

  function hashInt(n) {
    var x = (n | 0) ^ 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  }

  function hashSeed(seed, salt) {
    var h = 2166136261 >>> 0;
    if (typeof seed === 'string') {
      for (var i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
      }
    } else {
      h = hashInt((seed || 0) | 0);
    }
    return hashInt(h ^ ((salt || 0) | 0));
  }

  function rand01(seed, salt) {
    return (hashSeed(seed, salt) >>> 0) / 4294967296;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    var rad = r;
    if (rad > w * 0.5) rad = w * 0.5;
    if (rad > h * 0.5) rad = h * 0.5;
    if (rad < 0) rad = 0;
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function drawDish(ctx, cx, cy, ts) {
    var r = Math.max(2, ts * 0.085);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.35, cy + r * 0.35, r, r * 0.72, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(0.8, ts * 0.022);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.74, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(0.8, ts * 0.022);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - r * 0.65, cy + r * 0.55);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(cx - r * 0.65, cy + r * 0.55, Math.max(0.9, r * 0.2), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSoyombo(ctx, cx, cy, w, h) {
    ctx.fillStyle = '#ffd900';
    var r = Math.max(0.8, w * 0.24);
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.33, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - w * 0.32, cy - h * 0.22, w * 0.64, Math.max(0.8, h * 0.09));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - w * 0.32, cy + h * 0.16, w * 0.64, Math.max(0.8, h * 0.09));
    ctx.fillRect(cx - w * 0.38, cy - h * 0.22, Math.max(0.8, w * 0.14), h * 0.52);
    ctx.fillRect(cx + w * 0.24, cy - h * 0.22, Math.max(0.8, w * 0.14), h * 0.52);
  }

  function drawBronzeFigure(ctx, cx, baseY, scale, ts, isMain) {
    var s = scale * ts;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.26)';
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.12, baseY + s * 0.04, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3b2c22';
    ctx.strokeStyle = '#1a120d';
    ctx.lineWidth = Math.max(0.9, ts * 0.024);

    if (isMain) {
      roundRectPath(ctx, cx - s * 0.36, baseY - s * 0.72, s * 0.72, s * 0.72, s * 0.1);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4e3b2e';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.3, baseY);
      ctx.lineTo(cx - s * 0.26, baseY - s * 0.46);
      ctx.quadraticCurveTo(cx, baseY - s * 0.62, cx + s * 0.26, baseY - s * 0.46);
      ctx.lineTo(cx + s * 0.3, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6e5441';
      ctx.beginPath();
      ctx.arc(cx - s * 0.06, baseY - s * 0.58, s * 0.13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4e3b2e';
      ctx.beginPath();
      ctx.arc(cx, baseY - s * 0.6, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - s * 0.11, baseY - s * 0.68);
      ctx.lineTo(cx, baseY - s * 0.86);
      ctx.lineTo(cx + s * 0.11, baseY - s * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#7c604a';
      ctx.fillRect(cx - s * 0.2, baseY - s * 0.28, s * 0.4, s * 0.07);
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.22, baseY);
      ctx.lineTo(cx - s * 0.18, baseY - s * 0.45);
      ctx.quadraticCurveTo(cx, baseY - s * 0.56, cx + s * 0.18, baseY - s * 0.45);
      ctx.lineTo(cx + s * 0.22, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, baseY - s * 0.56, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawPalace(ctx, x, y, w, h, ts, now) {
    var cx = x + w * 0.5;
    var padX = Math.min(ts * 0.08, w * 0.025);
    var bx = x + padX;
    var bw = w - padX * 2;
    var baseY = y + h * 0.62;
    var wingTop = y - ts * 0.30;
    var roofDepth = ts * 0.11;
    var cbW = Math.min(bw * 0.34, ts * 1.78);
    var cbX = cx - cbW * 0.5;
    var cbTop = y - ts * 0.52;
    var outline = Math.max(1, ts * 0.028);

    ctx.fillStyle = '#cbd5e1';
    roundRectPath(ctx, x + ts * 0.04, y + h * 0.48, w - ts * 0.08, h * 0.48, ts * 0.08);
    ctx.fill();

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x + ts * 0.1, y + h * 0.54, w * 0.24, h * 0.34);
    ctx.fillRect(x + w - ts * 0.1 - w * 0.24, y + h * 0.54, w * 0.24, h * 0.34);

    var stairW = Math.min(bw * 0.44, ts * 2.15);
    var stairX = cx - stairW * 0.5;
    ctx.fillStyle = '#b4bfd0';
    ctx.fillRect(stairX, baseY, stairW, y + h * 0.96 - baseY);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(0.8, ts * 0.02);
    for (var st = 1; st <= 4; st++) {
      var sy = baseY + (y + h * 0.96 - baseY) * (st / 5);
      ctx.beginPath();
      ctx.moveTo(stairX, sy);
      ctx.lineTo(stairX + stairW, sy);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.20)';
    ctx.fillRect(bx + ts * 0.06, wingTop + ts * 0.05, bw, baseY - wingTop);
    ctx.fillRect(cbX + ts * 0.06, cbTop + ts * 0.05, cbW, baseY - cbTop);

    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = outline;
    ctx.fillRect(bx, wingTop, bw, baseY - wingTop);
    ctx.strokeRect(bx, wingTop, bw, baseY - wingTop);

    ctx.fillStyle = '#cfd8e3';
    ctx.fillRect(bx + bw * 0.55, wingTop, bw * 0.45, baseY - wingTop);

    var endW = Math.min(bw * 0.095, ts * 0.46);
    ctx.fillStyle = '#eef2f7';
    ctx.fillRect(bx, wingTop - ts * 0.04, endW, baseY - wingTop + ts * 0.04);
    ctx.strokeRect(bx, wingTop - ts * 0.04, endW, baseY - wingTop + ts * 0.04);
    ctx.fillStyle = '#d3dce8';
    ctx.fillRect(bx + bw - endW, wingTop - ts * 0.04, endW, baseY - wingTop + ts * 0.04);
    ctx.strokeRect(bx + bw - endW, wingTop - ts * 0.04, endW, baseY - wingTop + ts * 0.04);

    ctx.fillStyle = '#475569';
    var endWinW = endW * 0.26;
    var endWinH = (baseY - wingTop) * 0.48;
    var endWinY = wingTop + (baseY - wingTop) * 0.26;
    ctx.fillRect(bx + endW * 0.2, endWinY, endWinW, endWinH);
    ctx.fillRect(bx + endW * 0.54, endWinY, endWinW, endWinH);
    ctx.fillRect(bx + bw - endW * 0.8, endWinY, endWinW, endWinH);
    ctx.fillRect(bx + bw - endW * 0.46, endWinY, endWinW, endWinH);

    var galX = bx + endW + ts * 0.04;
    var galW = bw - (endW + ts * 0.04) * 2;
    var galY = wingTop + ts * 0.14;
    var galH = baseY - galY - ts * 0.03;
    ctx.fillStyle = '#435063';
    ctx.fillRect(galX, galY, galW, galH);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(bx + ts * 0.02, wingTop - roofDepth, bw - ts * 0.04, roofDepth);
    ctx.strokeRect(bx + ts * 0.02, wingTop - roofDepth, bw - ts * 0.04, roofDepth);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + ts * 0.03, wingTop - roofDepth + 1, bw - ts * 0.06, roofDepth * 0.65);

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(cbX, cbTop, cbW, baseY - cbTop);
    ctx.strokeRect(cbX, cbTop, cbW, baseY - cbTop);

    ctx.fillStyle = '#dbe4ef';
    ctx.fillRect(cbX + cbW * 0.58, cbTop, cbW * 0.42, baseY - cbTop);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cbX - ts * 0.02, cbTop - roofDepth * 0.9, cbW + ts * 0.04, roofDepth * 0.9);
    ctx.strokeRect(cbX - ts * 0.02, cbTop - roofDepth * 0.9, cbW + ts * 0.04, roofDepth * 0.9);

    ctx.fillStyle = '#334155';
    var cbGalY = cbTop + ts * 0.17;
    var cbGalH = baseY - cbGalY - ts * 0.03;
    ctx.fillRect(cbX + ts * 0.08, cbGalY, cbW - ts * 0.16, cbGalH);

    var colCount = Math.max(10, Math.round(galW / (ts * 0.24)));
    var colW = Math.max(2, ts * 0.062);
    for (var i = 0; i < colCount; i++) {
      var u = (i + 0.5) / colCount;
      var colX = galX + u * galW - colW * 0.5;
      var inCenter = colX + colW > cbX + ts * 0.05 && colX < cbX + cbW - ts * 0.05;
      var cTop = inCenter ? cbGalY : galY;
      var cH = baseY - cTop;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(colX, cTop, colW, cH);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(colX + colW * 0.65, cTop, colW * 0.35, cH);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = Math.max(0.6, ts * 0.015);
      ctx.strokeRect(colX, cTop, colW, cH);
    }

    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = outline;
    ctx.fillRect(bx + endW, wingTop, bw - endW * 2, ts * 0.14);
    ctx.strokeRect(bx + endW, wingTop, bw - endW * 2, ts * 0.14);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cbX - ts * 0.03, cbTop, cbW + ts * 0.06, ts * 0.16);
    ctx.strokeRect(cbX - ts * 0.03, cbTop, cbW + ts * 0.06, ts * 0.16);

    var sideOff = Math.min(cbW * 0.33, ts * 0.54);
    var sidePedW = ts * 0.26;
    var sidePedTop = y + h * 0.58;
    var sidePedBot = y + h * 0.88;
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(0.8, ts * 0.022);
    ctx.fillRect(cx - sideOff - sidePedW * 0.5, sidePedTop, sidePedW, sidePedBot - sidePedTop);
    ctx.strokeRect(cx - sideOff - sidePedW * 0.5, sidePedTop, sidePedW, sidePedBot - sidePedTop);
    ctx.fillRect(cx + sideOff - sidePedW * 0.5, sidePedTop, sidePedW, sidePedBot - sidePedTop);
    ctx.strokeRect(cx + sideOff - sidePedW * 0.5, sidePedTop, sidePedW, sidePedBot - sidePedTop);

    drawBronzeFigure(ctx, cx - sideOff, sidePedTop + ts * 0.01, 0.36, ts, false);
    drawBronzeFigure(ctx, cx + sideOff, sidePedTop + ts * 0.01, 0.36, ts, false);

    var mainPedW = ts * 0.56;
    var mainPedTop = y + h * 0.50;
    var mainPedBot = y + h * 0.93;
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx - mainPedW * 0.58, mainPedBot - ts * 0.10, mainPedW * 1.16, ts * 0.10);
    ctx.strokeRect(cx - mainPedW * 0.58, mainPedBot - ts * 0.10, mainPedW * 1.16, ts * 0.10);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(cx - mainPedW * 0.5, mainPedTop, mainPedW, mainPedBot - mainPedTop - ts * 0.08);
    ctx.strokeRect(cx - mainPedW * 0.5, mainPedTop, mainPedW, mainPedBot - mainPedTop - ts * 0.08);

    drawBronzeFigure(ctx, cx, mainPedTop + ts * 0.02, 0.48, ts, true);

    var poleX = cx;
    var poleBot = cbTop - roofDepth * 0.85;
    var poleTop = y - ts * 0.79;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.2, ts * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(poleX, poleBot);
    ctx.lineTo(poleX, poleTop);
    ctx.stroke();

    ctx.fillStyle = '#ffd900';
    ctx.beginPath();
    ctx.arc(poleX, poleTop, Math.max(1.3, ts * 0.038), 0, Math.PI * 2);
    ctx.fill();

    var fw = ts * 0.45;
    var fh = ts * 0.22;
    var wave = Math.sin(now * 0.005) * ts * 0.02;
    var fx = poleX + ts * 0.015;
    var fy = poleTop + ts * 0.02;
    var sw = fw / 3;

    ctx.fillStyle = '#da2032';
    ctx.fillRect(fx, fy, sw + 0.5, fh);
    ctx.fillStyle = '#0066b3';
    ctx.fillRect(fx + sw, fy + wave * 0.4, sw + 0.5, fh);
    ctx.fillStyle = '#da2032';
    ctx.fillRect(fx + sw * 2, fy + wave, sw, fh);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(0.7, ts * 0.018);
    ctx.strokeRect(fx, fy, fw, fh);

    drawSoyombo(ctx, fx + sw * 0.5, fy + fh * 0.5, sw * 0.76, fh * 0.76);
  }

  function drawSkytower(ctx, x, y, w, h, ts) {
    var baseY = y + h - ts * 0.14;
    var podTop = y + h - ts * 0.36;
    var peakX = x + w * 0.62;
    var peakY = y - ts * 0.58;
    var baseL = x + w * 0.14;
    var baseR = x + w * 0.86;
    var spireTop = y - ts * 0.79;

    ctx.fillStyle = '#cbd5e1';
    roundRectPath(ctx, x + w * 0.06, y + h - ts * 0.26, w * 0.88, ts * 0.22, ts * 0.06);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    roundRectPath(ctx, x + w * 0.09, y + h - ts * 0.24, w * 0.38, ts * 0.12, ts * 0.04);
    ctx.fill();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.beginPath();
    ctx.moveTo(baseL + ts * 0.08, baseY + ts * 0.04);
    ctx.lineTo(baseR + ts * 0.26, baseY + ts * 0.08);
    ctx.lineTo(baseR + ts * 0.32, baseY - ts * 0.24);
    ctx.lineTo(baseR, baseY - ts * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1e3a8a';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1, ts * 0.028);
    roundRectPath(ctx, x + w * 0.08, podTop, w * 0.84, baseY - podTop + ts * 0.04, ts * 0.04);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + w * 0.10, podTop - ts * 0.02, w * 0.80, ts * 0.05);

    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(x + w * 0.34, baseY - ts * 0.11, w * 0.32, ts * 0.11);

    function traceSail() {
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.quadraticCurveTo(x + w * 0.02, y + h * 0.18, baseL, baseY);
      ctx.lineTo(baseR, baseY);
      ctx.quadraticCurveTo(x + w * 0.78, y + h * 0.18, peakX + ts * 0.06, peakY + ts * 0.06);
      ctx.closePath();
    }

    var grad = ctx.createLinearGradient(x + w * 0.1, peakY, x + w * 0.9, baseY);
    grad.addColorStop(0, '#60a5fa');
    grad.addColorStop(0.28, '#2563eb');
    grad.addColorStop(0.68, '#1e40af');
    grad.addColorStop(1, '#0b1f47');

    ctx.save();
    traceSail();
    ctx.clip();

    ctx.fillStyle = grad;
    ctx.fillRect(x, peakY - ts * 0.05, w, baseY - peakY + ts * 0.1);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.quadraticCurveTo(x + w * 0.14, y + h * 0.14, baseL + w * 0.12, baseY);
    ctx.lineTo(baseL + w * 0.28, baseY);
    ctx.quadraticCurveTo(x + w * 0.36, y + h * 0.16, peakX + ts * 0.02, peakY + ts * 0.05);
    ctx.closePath();
    ctx.fill();

    var bandStep = Math.max(4, ts * 0.16);
    for (var by = peakY + ts * 0.12; by < baseY - ts * 0.06; by += bandStep) {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.fillRect(x, by, w, Math.max(1.2, ts * 0.036));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.fillRect(x, by, w * 0.56, Math.max(0.8, ts * 0.018));
    }

    ctx.fillStyle = 'rgba(10, 22, 52, 0.42)';
    ctx.beginPath();
    ctx.moveTo(peakX + ts * 0.01, peakY + ts * 0.04);
    ctx.lineTo(x + w * 0.68, baseY);
    ctx.lineTo(baseR + ts * 0.05, baseY);
    ctx.lineTo(peakX + ts * 0.08, peakY + ts * 0.04);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    traceSail();
    ctx.strokeStyle = '#0c1e3a';
    ctx.lineWidth = Math.max(1.1, ts * 0.032);
    ctx.stroke();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(1.4, ts * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(peakX + ts * 0.02, peakY + ts * 0.03);
    ctx.lineTo(peakX + ts * 0.02, spireTop);
    ctx.stroke();

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(0.7, ts * 0.016);
    ctx.beginPath();
    ctx.moveTo(peakX + ts * 0.02, peakY + ts * 0.03);
    ctx.lineTo(peakX + ts * 0.02, spireTop);
    ctx.stroke();
  }

  function drawFlats(ctx, x, y, w, h, ts, seed) {
    var pal = FLATS_PALETTES[hashSeed(seed, 1) % FLATS_PALETTES.length];
    var padX = ts * 0.08;
    var bx = x + padX;
    var bw = w - padX * 2;
    var rise = ts * 0.34;
    var topY = y - rise;
    var botY = y + h - ts * 0.08;
    var totH = botY - topY;
    var facadeH = Math.min(totH * 0.72, ts * 0.96);
    var roofH = totH - facadeH;
    var wallY = topY + roofH;
    var outline = Math.max(1, ts * 0.026);
    var r = Math.max(1.5, ts * 0.04);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    roundRectPath(ctx, bx + ts * 0.06, topY + ts * 0.06, bw, totH, r);
    ctx.fill();

    ctx.fillStyle = pal.wall;
    roundRectPath(ctx, bx, topY, bw, totH, r);
    ctx.fill();

    ctx.fillStyle = pal.shade;
    ctx.fillRect(bx + bw * 0.88, wallY, bw * 0.12, facadeH);

    ctx.fillStyle = pal.trim;
    ctx.fillRect(bx, topY, bw, roofH);

    var rim = Math.max(1.5, ts * 0.045);
    ctx.fillStyle = '#f8fafc';
    roundRectPath(ctx, bx + rim, topY + rim, bw - rim * 2, roofH - rim * 1.6, r * 0.6);
    ctx.fill();

    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(bx + rim, topY + roofH - rim * 1.4, bw - rim * 2, rim * 0.7);

    var boxW = Math.max(3, ts * 0.16);
    var boxH = Math.max(2.5, Math.min(roofH * 0.34, ts * 0.12));
    var boxX = bx + bw * 0.24;
    var boxY = topY + roofH * 0.35;
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(boxX, boxY, boxW, boxH * 0.45);

    var dishCount = (bw > ts * 1.2 || roofH > ts * 0.5) ? 2 : 1;
    drawDish(ctx, bx + bw * 0.74, topY + roofH * 0.48, ts);
    if (dishCount > 1) {
      drawDish(ctx, bx + bw * 0.48, topY + roofH * 0.64, ts);
    }

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.16)';
    ctx.lineWidth = Math.max(0.7, ts * 0.016);
    for (var fl = 1; fl < 5; fl++) {
      var fy = wallY + facadeH * (fl / 5);
      ctx.beginPath();
      ctx.moveTo(bx + 1, fy);
      ctx.lineTo(bx + bw - 1, fy);
      ctx.stroke();
    }

    var cols = Math.max(4, Math.round(bw / (ts * 0.21)));
    var cellW = (bw - ts * 0.10) / cols;
    var cellH = (facadeH - ts * 0.06) / 5;
    var winW = Math.max(2, cellW * 0.56);
    var winH = Math.max(2, cellH * 0.58);

    var doorCols = [];
    if (cols >= 7) {
      doorCols.push(Math.floor(cols * 0.25));
      doorCols.push(Math.floor(cols * 0.75));
    } else {
      doorCols.push(Math.floor(cols * 0.5));
    }

    for (var rIdx = 0; rIdx < 5; rIdx++) {
      for (var cIdx = 0; cIdx < cols; cIdx++) {
        var wx = bx + ts * 0.05 + cIdx * cellW + (cellW - winW) * 0.5;
        var wy = wallY + ts * 0.03 + rIdx * cellH + (cellH - winH) * 0.45;
        var isDoor = rIdx === 4 && doorCols.indexOf(cIdx) !== -1;
        if (isDoor) {
          var dw = Math.max(winW * 1.15, ts * 0.10);
          var dh = cellH * 0.92;
          var dx = wx + (winW - dw) * 0.5;
          var dy = botY - dh;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(dx, dy, dw, dh);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(dx - ts * 0.02, dy - ts * 0.025, dw + ts * 0.04, ts * 0.03);
        } else {
          var lit = (hashSeed(seed, rIdx * 41 + cIdx * 17 + 9) & 3) === 0;
          ctx.fillStyle = lit ? '#fde047' : '#334155';
          ctx.fillRect(wx, wy, winW, winH);
          ctx.fillStyle = lit ? '#fef9c3' : 'rgba(148, 163, 184, 0.35)';
          ctx.fillRect(wx, wy, winW, Math.max(0.8, winH * 0.25));
        }
      }
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = outline;
    roundRectPath(ctx, bx, topY, bw, totH, r);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, wallY);
    ctx.lineTo(bx + bw, wallY);
    ctx.stroke();
  }

  function drawMemorial(ctx, x, y, w, h, ts) {
    var cx = x + w * 0.5;
    var platY = y + h * 0.35;
    var hillBot = y + h * 0.96;
    var outline = Math.max(1, ts * 0.026);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.beginPath();
    ctx.ellipse(cx + ts * 0.08, hillBot - ts * 0.06, w * 0.45, ts * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7c6e63';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.04, hillBot - ts * 0.06);
    ctx.quadraticCurveTo(x + w * 0.16, platY + ts * 0.12, cx - ts * 0.72, platY);
    ctx.lineTo(cx + ts * 0.72, platY);
    ctx.quadraticCurveTo(x + w * 0.84, platY + ts * 0.12, x + w * 0.96, hillBot - ts * 0.06);
    ctx.quadraticCurveTo(cx, hillBot + ts * 0.04, x + w * 0.04, hillBot - ts * 0.06);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.05, hillBot - ts * 0.10);
    ctx.quadraticCurveTo(x + w * 0.18, platY + ts * 0.10, cx - ts * 0.72, platY);
    ctx.lineTo(cx + ts * 0.65, platY);
    ctx.quadraticCurveTo(cx + ts * 0.45, hillBot - ts * 0.25, cx - ts * 0.18, hillBot - ts * 0.12);
    ctx.quadraticCurveTo(x + w * 0.22, hillBot - ts * 0.04, x + w * 0.05, hillBot - ts * 0.10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#cbd9ea';
    ctx.beginPath();
    ctx.moveTo(cx + ts * 0.20, platY + ts * 0.02);
    ctx.lineTo(cx + ts * 0.72, platY);
    ctx.quadraticCurveTo(x + w * 0.83, platY + ts * 0.12, x + w * 0.94, hillBot - ts * 0.10);
    ctx.quadraticCurveTo(x + w * 0.74, hillBot - ts * 0.04, cx + ts * 0.35, hillBot - ts * 0.14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#5c5047';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.16, y + h * 0.72);
    ctx.lineTo(x + w * 0.28, y + h * 0.62);
    ctx.lineTo(x + w * 0.34, y + h * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.70, y + h * 0.68);
    ctx.lineTo(x + w * 0.82, y + h * 0.58);
    ctx.lineTo(x + w * 0.86, y + h * 0.74);
    ctx.closePath();
    ctx.fill();

    var topSW = ts * 0.24;
    var botSW = ts * 0.44;
    var stTop = platY + ts * 0.08;
    var stBot = y + h * 0.96;

    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = outline;
    ctx.beginPath();
    ctx.moveTo(cx - topSW * 0.5, stTop);
    ctx.lineTo(cx + topSW * 0.5, stTop);
    ctx.lineTo(cx + botSW * 0.5, stBot);
    ctx.lineTo(cx - botSW * 0.5, stBot);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#475569';
    var rail = ts * 0.04;
    ctx.beginPath();
    ctx.moveTo(cx - topSW * 0.5 + rail, stTop);
    ctx.lineTo(cx + topSW * 0.5 - rail, stTop);
    ctx.lineTo(cx + botSW * 0.5 - rail, stBot);
    ctx.lineTo(cx - botSW * 0.5 + rail, stBot);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = Math.max(1, ts * 0.025);
    var steps = 11;
    for (var sIdx = 1; sIdx < steps; sIdx++) {
      var frac = sIdx / steps;
      var sy = stTop + (stBot - stTop) * frac;
      var sw = (topSW + (botSW - topSW) * frac) * 0.5 - rail;
      ctx.beginPath();
      ctx.moveTo(cx - sw, sy);
      ctx.lineTo(cx + sw, sy);
      ctx.stroke();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = outline;
    ctx.beginPath();
    ctx.ellipse(cx, platY, ts * 0.84, ts * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.ellipse(cx, platY - ts * 0.02, ts * 0.72, ts * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    var steleX = cx + ts * 0.72;
    var steleW = ts * 0.13;
    var steleBot = platY - ts * 0.02;
    var steleTop = y - ts * 0.64;

    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = outline;
    ctx.beginPath();
    ctx.moveTo(steleX - steleW * 0.5, steleBot);
    ctx.lineTo(steleX - steleW * 0.36, steleTop + ts * 0.08);
    ctx.lineTo(steleX, steleTop);
    ctx.lineTo(steleX + steleW * 0.36, steleTop + ts * 0.08);
    ctx.lineTo(steleX + steleW * 0.5, steleBot);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(steleX, steleTop);
    ctx.lineTo(steleX + steleW * 0.36, steleTop + ts * 0.08);
    ctx.lineTo(steleX + steleW * 0.5, steleBot);
    ctx.lineTo(steleX, steleBot);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(steleX, steleTop + ts * 0.16, Math.max(1.5, ts * 0.036), 0, Math.PI * 2);
    ctx.fill();

    var ringCx = cx - ts * 0.08;
    var ringCy = y + h * 0.08;
    var ringRx = ts * 0.56;
    var ringRy = ts * 0.28;
    var ringThick = ts * 0.13;

    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(0.9, ts * 0.022);
    var legOffsets = [-0.68, -0.24, 0.24, 0.68];
    for (var l = 0; l < legOffsets.length; l++) {
      var lx = ringCx + legOffsets[l] * ringRx;
      var lyTop = ringCy + ringRy * 0.55;
      var lyBot = platY + ts * 0.02;
      ctx.fillRect(lx - ts * 0.04, lyTop, ts * 0.08, lyBot - lyTop);
      ctx.strokeRect(lx - ts * 0.04, lyTop, ts * 0.08, lyBot - lyTop);
    }

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(ringCx, ringCy + ts * 0.04, ringRx, ringRy, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ringCx, ringCy - ts * 0.02, ringRx - ts * 0.04, ringRy - ts * 0.03, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(ringCx - ringRx, ringCy - ringRy, ringRx * 2, ringRy * 2);

    var segCount = 10;
    for (var m = 0; m < segCount; m++) {
      var sx0 = ringCx - ringRx + (m / segCount) * ringRx * 2;
      var sx1 = ringCx - ringRx + ((m + 1) / segCount) * ringRx * 2;
      ctx.fillStyle = MOSAIC_COLORS[m % MOSAIC_COLORS.length];
      ctx.fillRect(sx0, ringCy - ringRy - ts * 0.02, sx1 - sx0 + 0.5, ringRy * 1.15);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = Math.max(0.7, ts * 0.016);
      ctx.beginPath();
      ctx.moveTo(sx0, ringCy - ringRy);
      ctx.lineTo(sx0, ringCy + ts * 0.05);
      ctx.stroke();
    }

    ctx.fillStyle = '#93c5fd';
    ctx.beginPath();
    ctx.ellipse(ringCx, ringCy + ts * 0.04, ringRx - ringThick, ringRy - ringThick * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = ringThick;
    ctx.beginPath();
    ctx.ellipse(ringCx, ringCy - ts * 0.02, ringRx - ringThick * 0.45, ringRy - ringThick * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = outline;
    ctx.beginPath();
    ctx.ellipse(ringCx, ringCy - ts * 0.02, ringRx, ringRy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(ringCx, ringCy - ts * 0.02, ringRx - ringThick * 0.9, ringRy - ringThick * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(cx, platY - ts * 0.02, Math.max(1.6, ts * 0.045), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHill(ctx, x, y, w, h, ts, seed) {
    var outline = Math.max(1, ts * 0.024);

    ctx.fillStyle = '#7d6e63';
    ctx.strokeStyle = '#3f362f';
    ctx.lineWidth = outline;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.03, y + h * 0.94);
    ctx.quadraticCurveTo(x + w * 0.08, y + h * 0.14, x + w * 0.24, y + h * 0.06);
    ctx.lineTo(x + w * 0.76, y + h * 0.06);
    ctx.quadraticCurveTo(x + w * 0.92, y + h * 0.14, x + w * 0.97, y + h * 0.94);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 1.0, x + w * 0.03, y + h * 0.94);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#5c5047';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.56, y + h * 0.06);
    ctx.lineTo(x + w * 0.76, y + h * 0.06);
    ctx.quadraticCurveTo(x + w * 0.92, y + h * 0.14, x + w * 0.96, y + h * 0.92);
    ctx.lineTo(x + w * 0.58, y + h * 0.94);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.06, y + h * 0.80);
    ctx.quadraticCurveTo(x + w * 0.14, y + h * 0.18, x + w * 0.26, y + h * 0.08);
    ctx.lineTo(x + w * 0.48, y + h * 0.08);
    ctx.quadraticCurveTo(x + w * 0.36, y + h * 0.45, x + w * 0.24, y + h * 0.88);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#dce7f4';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.64, y + h * 0.10);
    ctx.lineTo(x + w * 0.82, y + h * 0.14);
    ctx.quadraticCurveTo(x + w * 0.90, y + h * 0.50, x + w * 0.90, y + h * 0.84);
    ctx.quadraticCurveTo(x + w * 0.74, y + h * 0.60, x + w * 0.64, y + h * 0.10);
    ctx.closePath();
    ctx.fill();

    var rocks = 6;
    for (var i = 0; i < rocks; i++) {
      var side = i % 2 === 0 ? 0.10 + rand01(seed, i * 7 + 1) * 0.22 : 0.68 + rand01(seed, i * 7 + 2) * 0.22;
      var rx = x + w * side;
      var ry = y + h * (0.24 + rand01(seed, i * 7 + 3) * 0.62);
      var rw = ts * (0.14 + rand01(seed, i * 7 + 4) * 0.12);
      var rh = rw * 0.68;

      ctx.fillStyle = '#6b7280';
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = Math.max(0.8, ts * 0.02);
      ctx.beginPath();
      ctx.moveTo(rx - rw * 0.5, ry + rh * 0.4);
      ctx.lineTo(rx - rw * 0.3, ry - rh * 0.45);
      ctx.lineTo(rx + rw * 0.2, ry - rh * 0.5);
      ctx.lineTo(rx + rw * 0.5, ry + rh * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(rx - rw * 0.32, ry - rh * 0.35);
      ctx.lineTo(rx + rw * 0.18, ry - rh * 0.45);
      ctx.lineTo(rx + rw * 0.26, ry - rh * 0.18);
      ctx.lineTo(rx - rw * 0.24, ry - rh * 0.12);
      ctx.closePath();
      ctx.fill();
    }

    var pts = [
      { x: x + w * 0.54, y: y + h * 0.94 },
      { x: x + w * 0.35, y: y + h * 0.66 },
      { x: x + w * 0.64, y: y + h * 0.38 },
      { x: x + w * 0.50, y: y + h * 0.06 }
    ];

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(4, ts * 0.18);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
    ctx.stroke();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(2.6, ts * 0.12);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var p2 = 1; p2 < pts.length; p2++) ctx.lineTo(pts[p2].x, pts[p2].y);
    ctx.stroke();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(0.9, ts * 0.024);
    for (var seg = 0; seg < pts.length - 1; seg++) {
      var a = pts[seg];
      var b = pts[seg + 1];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var dist = Math.hypot(dx, dy);
      var nx = (-dy / dist) * ts * 0.055;
      var ny = (dx / dist) * ts * 0.055;
      var ticks = Math.max(3, Math.floor(dist / (ts * 0.14)));
      for (var tIdx = 1; tIdx < ticks; tIdx++) {
        var f = tIdx / ticks;
        var tx = a.x + dx * f;
        var ty = a.y + dy * f;
        ctx.beginPath();
        ctx.moveTo(tx - nx, ty - ny);
        ctx.lineTo(tx + nx, ty + ny);
        ctx.stroke();
      }
    }
  }

  function drawMarket(ctx, x, y, w, h, ts, seed) {
    var colsCount = Math.max(2, Math.round((w / ts) * 1.8));
    var rowsCount = Math.max(2, Math.round((h / ts) * 1.6));
    var pad = ts * 0.06;
    var innerW = w - pad * 2;
    var innerH = h - pad * 2;

    ctx.fillStyle = '#cbd5e1';
    roundRectPath(ctx, x + ts * 0.02, y + ts * 0.02, w - ts * 0.04, h - ts * 0.04, ts * 0.08);
    ctx.fill();

    ctx.fillStyle = '#b4c0cf';
    var aisleGapY = innerH / rowsCount;
    for (var ay = 0; ay < rowsCount; ay++) {
      ctx.fillRect(x + pad, y + pad + ay * aisleGapY + aisleGapY * 0.64, innerW, aisleGapY * 0.34);
    }

    var cellW = innerW / colsCount;
    var cellH = innerH / rowsCount;
    var outline = Math.max(0.8, ts * 0.02);

    for (var r = 0; r < rowsCount; r++) {
      for (var c = 0; c < colsCount; c++) {
        var idx = r * colsCount + c;
        var colObj = MARKET_COLORS[hashSeed(seed, idx * 19 + 3) % MARKET_COLORS.length];
        var sx = x + pad + c * cellW + ts * 0.03;
        var sy = y + pad + r * cellH + ts * 0.03;
        var sw = cellW - ts * 0.07;
        var sh = cellH * 0.56;
        var wallH = Math.max(2.5, sh * 0.34);
        var roofH = sh - wallH;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        ctx.fillRect(sx + ts * 0.03, sy + ts * 0.03, sw, sh);

        ctx.fillStyle = colObj.wall;
        ctx.fillRect(sx, sy + roofH, sw, wallH);

        ctx.fillStyle = colObj.top;
        ctx.fillRect(sx, sy, sw, roofH);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = Math.max(0.7, ts * 0.015);
        var ribs = Math.max(2, Math.floor(sw / (ts * 0.10)));
        for (var rb = 1; rb < ribs; rb++) {
          var rx = sx + (rb / ribs) * sw;
          ctx.beginPath();
          ctx.moveTo(rx, sy + 1);
          ctx.lineTo(rx, sy + roofH - 1);
          ctx.stroke();
        }

        ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
        ctx.fillRect(sx + 1, sy + 1, sw * 0.45, roofH * 0.45);

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = outline;
        ctx.strokeRect(sx, sy, sw, sh);

        if ((hashSeed(seed, idx * 29 + 7) & 3) !== 0) {
          var awnY = sy + roofH + wallH * 0.35;
          var awnH = Math.max(2.2, cellH * 0.16);
          var awnColor = (hashSeed(seed, idx * 11) & 1) === 0 ? '#ef4444' : '#2563eb';
          var stripes = Math.max(3, Math.floor(sw / (ts * 0.08)));
          for (var sp = 0; sp < stripes; sp++) {
            var spX = sx + (sp / stripes) * sw;
            var spW = sw / stripes + 0.3;
            ctx.fillStyle = (sp & 1) === 0 ? '#ffffff' : awnColor;
            ctx.fillRect(spX, awnY, spW, awnH);
          }
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = Math.max(0.6, ts * 0.014);
          ctx.strokeRect(sx, awnY, sw, awnH);
        }

        if ((hashSeed(seed, idx * 31 + 5) % 3) === 0) {
          var crS = Math.max(2, ts * 0.085);
          var crX = sx + sw - crS * 0.8;
          var crY = sy + sh + ts * 0.02;
          ctx.fillStyle = '#d97706';
          ctx.fillRect(crX, crY, crS, crS * 0.8);
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = Math.max(0.6, ts * 0.014);
          ctx.strokeRect(crX, crY, crS, crS * 0.8);
        }
      }
    }

    var peopleCount = Math.max(4, Math.round((w / ts) * (h / ts) * 4));
    var coatColors = ['#0f172a', '#1e293b', '#334155', '#7f1d1d', '#1e3a8a'];
    for (var p = 0; p < peopleCount; p++) {
      var pr = hashSeed(seed, p * 53 + 11) % rowsCount;
      var px = x + pad + ts * 0.08 + rand01(seed, p * 59 + 1) * (innerW - ts * 0.16);
      var py = y + pad + pr * cellH + cellH * (0.68 + rand01(seed, p * 61 + 2) * 0.24);
      var coat = coatColors[hashSeed(seed, p * 67) % coatColors.length];
      var prRad = Math.max(1.3, ts * 0.042);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.beginPath();
      ctx.ellipse(px + prRad * 0.4, py + prRad * 0.5, prRad * 0.9, prRad * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.ellipse(px, py, prRad, prRad * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(px, py - prRad * 0.45, prRad * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSingleGer(ctx, cx, cy, r, ts, now, phase) {
    var wallH = r * 0.46;
    var roofRx = r;
    var roofRy = r * 0.68;
    var outline = Math.max(0.9, ts * 0.024);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.18, cy + wallH * 0.85, roofRx * 1.02, roofRy * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = outline;
    ctx.beginPath();
    ctx.ellipse(cx, cy + wallH, roofRx * 0.96, roofRy * 0.88, 0, 0, Math.PI);
    ctx.lineTo(cx - roofRx * 0.96, cy);
    ctx.ellipse(cx, cy, roofRx * 0.96, roofRy * 0.88, 0, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = Math.max(1.4, r * 0.16);
    ctx.beginPath();
    ctx.ellipse(cx, cy + wallH * 0.66, roofRx * 0.94, roofRy * 0.84, 0, 0.08, Math.PI - 0.08);
    ctx.stroke();

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.beginPath();
    ctx.ellipse(cx, cy + wallH * 0.82, roofRx * 0.94, roofRy * 0.84, 0, 0.12, Math.PI - 0.12);
    ctx.stroke();

    var doorW = Math.max(2, r * 0.34);
    var doorH = Math.max(2.5, wallH * 0.92);
    var doorY = cy + roofRy * 0.92;
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(cx - doorW * 0.5, doorY, doorW, doorH);
    ctx.strokeStyle = '#431407';
    ctx.lineWidth = Math.max(0.7, ts * 0.016);
    ctx.strokeRect(cx - doorW * 0.5, doorY, doorW, doorH);

    var peakY = cy - r * 0.24;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = outline;
    ctx.beginPath();
    ctx.ellipse(cx, cy, roofRx, roofRy, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
    ctx.beginPath();
    ctx.moveTo(cx, peakY);
    ctx.ellipse(cx, cy, roofRx, roofRy, 0, -0.2, Math.PI * 0.55);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = outline;
    ctx.beginPath();
    ctx.ellipse(cx, cy, roofRx, roofRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(cx, peakY + r * 0.08, r * 0.28, r * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(0.6, ts * 0.015);
    ctx.stroke();

    var pipeX = cx + r * 0.22;
    var pipeBaseY = peakY + r * 0.05;
    var pipeTopY = peakY - r * 0.32;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(1.3, ts * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pipeX, pipeBaseY);
    ctx.lineTo(pipeX, pipeTopY);
    ctx.stroke();

    for (var p = 0; p < 3; p++) {
      var u = ((now * 0.00048) + phase + p / 3) % 1;
      var sx = pipeX + u * ts * 0.34 + Math.sin(u * 5 + phase * 6) * ts * 0.025;
      var sy = pipeTopY - u * ts * 0.38;
      var sr = Math.max(1.2, ts * (0.045 + u * 0.075));
      var alpha = Math.sin(u * Math.PI) * 0.52;
      ctx.fillStyle = 'rgba(100, 116, 139, ' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSmallHouse(ctx, hx, hy, hw, hh, ts, seed) {
    var roofObj = HOUSE_ROOFS[hashSeed(seed, 91) % HOUSE_ROOFS.length];
    var roofH = hh * 0.56;
    var wallH = hh - roofH;
    var outline = Math.max(0.8, ts * 0.022);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.fillRect(hx + ts * 0.03, hy + ts * 0.03, hw, hh);

    ctx.fillStyle = '#9c6637';
    ctx.fillRect(hx, hy + roofH, hw, wallH);
    ctx.fillStyle = '#7c4f28';
    ctx.fillRect(hx + hw * 0.72, hy + roofH, hw * 0.28, wallH);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(hx + hw * 0.18, hy + roofH + wallH * 0.28, hw * 0.22, wallH * 0.42);
    ctx.fillRect(hx + hw * 0.54, hy + roofH + wallH * 0.22, hw * 0.20, wallH * 0.78);

    ctx.fillStyle = roofObj.top;
    ctx.fillRect(hx - ts * 0.015, hy, hw + ts * 0.03, roofH);
    ctx.fillStyle = roofObj.shade;
    ctx.fillRect(hx - ts * 0.015, hy + roofH * 0.55, hw + ts * 0.03, roofH * 0.45);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(hx + ts * 0.01, hy + ts * 0.015, hw * 0.65, roofH * 0.36);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = outline;
    ctx.strokeRect(hx, hy + roofH, hw, wallH);
    ctx.strokeRect(hx - ts * 0.015, hy, hw + ts * 0.03, roofH);
  }

  function drawFenceSpan(ctx, x1, y1, x2, y2, fh, ts, isHorizontal) {
    var boardStep = Math.max(2.2, ts * 0.075);
    ctx.strokeStyle = '#4a3219';
    ctx.lineWidth = Math.max(1, ts * 0.025);
    if (isHorizontal) {
      var len = x2 - x1;
      ctx.fillStyle = '#8b6239';
      ctx.fillRect(x1, y1 - fh, len, fh);
      ctx.fillStyle = '#6b4927';
      ctx.fillRect(x1, y1 - fh * 0.45, len, fh * 0.2);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x1, y1 - fh - ts * 0.015, len, ts * 0.025);
      var count = Math.max(3, Math.floor(len / boardStep));
      ctx.beginPath();
      for (var i = 0; i <= count; i++) {
        var bx = x1 + (i / count) * len;
        ctx.moveTo(bx, y1 - fh);
        ctx.lineTo(bx, y1);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = '#75502c';
      ctx.fillRect(x1 - ts * 0.025, y1, ts * 0.05, y2 - y1);
      ctx.strokeRect(x1 - ts * 0.025, y1, ts * 0.05, y2 - y1);
    }
  }

  function drawGer(ctx, x, y, w, h, ts, now, seed) {
    var pad = ts * 0.055;
    var fx = x + pad;
    var fy = y + pad;
    var fw = w - pad * 2;
    var fh = h - pad * 2;
    var fenceH = Math.max(3.5, ts * 0.11);

    ctx.fillStyle = '#eef4fb';
    roundRectPath(ctx, fx, fy, fw, fh, ts * 0.04);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(fx + fw * 0.42, fy + fh * 0.56, fw * 0.16, fh * 0.44);

    drawFenceSpan(ctx, fx, fy + fenceH * 0.5, fx + fw, fy + fenceH * 0.5, fenceH, ts, true);
    drawFenceSpan(ctx, fx, fy, fx, fy + fh, fenceH, ts, false);
    drawFenceSpan(ctx, fx + fw, fy, fx + fw, fy + fh, fenceH, ts, false);

    if (w >= ts * 1.6) {
      var gerR = Math.min(ts * 0.23, fh * 0.30);
      drawSingleGer(ctx, fx + fw * 0.24, fy + fh * 0.44, gerR, ts, now, rand01(seed, 1));
      drawSingleGer(ctx, fx + fw * 0.58, fy + fh * 0.42, gerR * 0.96, ts, now, rand01(seed, 2));
      drawSmallHouse(ctx, fx + fw * 0.74, fy + fh * 0.40, fw * 0.20, fh * 0.44, ts, seed);
    } else {
      var gerR1 = Math.min(fw * 0.26, fh * 0.28);
      drawSingleGer(ctx, fx + fw * 0.34, fy + fh * 0.44, gerR1, ts, now, rand01(seed, 3));
      drawSmallHouse(ctx, fx + fw * 0.56, fy + fh * 0.38, fw * 0.36, fh * 0.44, ts, seed);
    }

    var gateX1 = fx + fw * 0.42;
    var gateX2 = fx + fw * 0.58;
    drawFenceSpan(ctx, fx, fy + fh, gateX1, fy + fh, fenceH * 0.85, ts, true);
    drawFenceSpan(ctx, gateX2, fy + fh, fx + fw, fy + fh, fenceH * 0.85, ts, true);
  }

  function drawSinglePine(ctx, cx, baseY, height, width, ts) {
    var outline = Math.max(0.9, ts * 0.022);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.beginPath();
    ctx.ellipse(cx + width * 0.24, baseY + height * 0.04, width * 0.56, width * 0.24, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a3222';
    ctx.fillRect(cx - width * 0.1, baseY - height * 0.16, width * 0.2, height * 0.18);

    var tiers = [
      { top: 0.50, bot: 0.88, w: 0.52 },
      { top: 0.24, bot: 0.64, w: 0.42 },
      { top: 0.00, bot: 0.38, w: 0.30 }
    ];

    for (var i = 0; i < tiers.length; i++) {
      var tr = tiers[i];
      var ty = baseY - height * (1 - tr.top);
      var by = baseY - height * (1 - tr.bot);
      var tw = width * tr.w;

      ctx.fillStyle = '#14452f';
      ctx.strokeStyle = '#0d2e1f';
      ctx.lineWidth = outline;
      ctx.beginPath();
      ctx.moveTo(cx, ty);
      ctx.lineTo(cx + tw, by);
      ctx.quadraticCurveTo(cx, by + height * 0.05, cx - tw, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1f6a46';
      ctx.beginPath();
      ctx.moveTo(cx, ty);
      ctx.lineTo(cx, by + height * 0.02);
      ctx.quadraticCurveTo(cx - tw * 0.5, by + height * 0.03, cx - tw, by);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(cx, ty);
      ctx.lineTo(cx + tw * 0.62, ty + (by - ty) * 0.55);
      ctx.quadraticCurveTo(cx + tw * 0.22, ty + (by - ty) * 0.44, cx - tw * 0.08, ty + (by - ty) * 0.52);
      ctx.quadraticCurveTo(cx - tw * 0.45, ty + (by - ty) * 0.62, cx - tw * 0.78, ty + (by - ty) * 0.72);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPines(ctx, x, y, w, h, ts, seed) {
    var count = w >= ts * 1.6 ? 3 : 2;
    var spots = count === 3
      ? [
          { fx: 0.24, fy: 0.76, sc: 0.92 },
          { fx: 0.54, fy: 0.68, sc: 1.08 },
          { fx: 0.78, fy: 0.82, sc: 0.84 }
        ]
      : [
          { fx: 0.34, fy: 0.76, sc: 1.02 },
          { fx: 0.68, fy: 0.84, sc: 0.86 }
        ];

    for (var i = 0; i < spots.length; i++) {
      var sp = spots[i];
      var jx = (rand01(seed, i * 11 + 1) - 0.5) * ts * 0.08;
      var jy = (rand01(seed, i * 11 + 2) - 0.5) * ts * 0.06;
      var cx = x + w * sp.fx + jx;
      var by = y + h * sp.fy + jy;
      var ph = ts * 0.78 * sp.sc;
      var pw = ts * 0.54 * sp.sc;
      drawSinglePine(ctx, cx, by, ph, pw, ts);
    }
  }

  function drawGeneric(ctx, x, y, w, h, ts) {
    var pad = ts * 0.12;
    var bx = x + pad;
    var by = y + pad;
    var bw = w - pad * 2;
    var bh = h - pad * 2;
    var roofH = bh * 0.60;
    var wallH = bh - roofH;
    var r = Math.max(1.5, ts * 0.06);
    var outline = Math.max(0.9, ts * 0.024);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.20)';
    roundRectPath(ctx, bx + ts * 0.05, by + ts * 0.06, bw, bh, r);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    roundRectPath(ctx, bx, by, bw, bh, r);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(bx, by + roofH, bw, wallH);

    ctx.fillStyle = '#f8fafc';
    var rim = Math.max(1.5, ts * 0.045);
    roundRectPath(ctx, bx + rim, by + rim, bw - rim * 2, roofH - rim * 1.5, r * 0.6);
    ctx.fill();

    var ventW = Math.max(3, ts * 0.16);
    var ventH = Math.max(2.5, Math.min(roofH * 0.35, ts * 0.12));
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(bx + bw * 0.62, by + roofH * 0.32, ventW, ventH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + bw * 0.62, by + roofH * 0.32, ventW, ventH * 0.45);

    var winCount = Math.max(2, Math.floor(bw / (ts * 0.24)));
    var winW = Math.max(2, (bw / winCount) * 0.45);
    var winH = Math.max(2, wallH * 0.48);
    ctx.fillStyle = '#334155';
    for (var i = 0; i < winCount; i++) {
      var wx = bx + ((i + 0.5) / winCount) * bw - winW * 0.5;
      ctx.fillRect(wx, by + roofH + wallH * 0.24, winW, winH);
    }

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = outline;
    roundRectPath(ctx, bx, by, bw, bh, r);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by + roofH);
    ctx.lineTo(bx + bw, by + roofH);
    ctx.stroke();
  }

  var UBArtPlaces = {
    KINDS: KINDS,
    draw: function (ctx, kind, x, y, w, h, ts, now, seed) {
      if (!ctx || w <= 0 || h <= 0 || ts <= 0) return;
      var t = typeof now === 'number' ? now : 0;
      var s = seed === undefined || seed === null ? 0 : seed;
      ctx.save();
      if (kind === 'palace') {
        drawPalace(ctx, x, y, w, h, ts, t);
      } else if (kind === 'skytower') {
        drawSkytower(ctx, x, y, w, h, ts);
      } else if (kind === 'flats') {
        drawFlats(ctx, x, y, w, h, ts, s);
      } else if (kind === 'memorial') {
        drawMemorial(ctx, x, y, w, h, ts);
      } else if (kind === 'hill') {
        drawHill(ctx, x, y, w, h, ts, s);
      } else if (kind === 'market') {
        drawMarket(ctx, x, y, w, h, ts, s);
      } else if (kind === 'ger') {
        drawGer(ctx, x, y, w, h, ts, t, s);
      } else if (kind === 'pines') {
        drawPines(ctx, x, y, w, h, ts, s);
      } else {
        drawGeneric(ctx, x, y, w, h, ts);
      }
      ctx.restore();
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = UBArtPlaces;
  else root.UBArtPlaces = UBArtPlaces;
})(this);
