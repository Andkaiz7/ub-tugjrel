(function (root) {
  var FONT_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  function hashSeed(seed) {
    var n = ((seed | 0) ^ 0x9e3779b9) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35) >>> 0;
    return (n ^ (n >>> 16)) >>> 0;
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

  function priusBodyPath(ctx, hl, hw) {
    ctx.beginPath();
    ctx.moveTo(-hl * 0.88, -hw * 0.86);
    ctx.quadraticCurveTo(-hl * 0.25, -hw * 1.02, hl * 0.42, -hw * 0.96);
    ctx.bezierCurveTo(hl * 0.82, -hw * 0.90, hl * 1.02, -hw * 0.46, hl, 0);
    ctx.bezierCurveTo(hl * 1.02, hw * 0.46, hl * 0.82, hw * 0.90, hl * 0.42, hw * 0.96);
    ctx.quadraticCurveTo(-hl * 0.25, hw * 1.02, -hl * 0.88, hw * 0.86);
    ctx.quadraticCurveTo(-hl * 1.03, hw * 0.52, -hl * 1.02, 0);
    ctx.quadraticCurveTo(-hl * 1.03, -hw * 0.52, -hl * 0.88, -hw * 0.86);
    ctx.closePath();
  }

  function priusGlassPath(ctx, hl, hw) {
    ctx.beginPath();
    ctx.moveTo(-hl * 0.82, -hw * 0.60);
    ctx.quadraticCurveTo(-hl * 0.15, -hw * 0.76, hl * 0.45, -hw * 0.66);
    ctx.quadraticCurveTo(hl * 0.62, 0, hl * 0.45, hw * 0.66);
    ctx.quadraticCurveTo(-hl * 0.15, hw * 0.76, -hl * 0.82, hw * 0.60);
    ctx.quadraticCurveTo(-hl * 0.88, 0, -hl * 0.82, -hw * 0.60);
    ctx.closePath();
  }

  function car(ctx, x, y, angle, ts, color, seed) {
    var bodyColor = color || '#2f7cf6';
    var hl = 0.23 * ts;
    var hw = 0.13 * ts;
    var h = hashSeed(seed);
    var lw = Math.max(0.75, 0.02 * ts);
    var cosA = Math.cos(-angle);
    var sinA = Math.sin(-angle);
    var lx = (-cosA + sinA) * 0.707;
    var ly = (-sinA - cosA) * 0.707;

    ctx.save();

    ctx.save();
    ctx.translate(x + 0.03 * ts, y + 0.04 * ts);
    ctx.rotate(angle);
    priusBodyPath(ctx, hl * 1.03, hw * 1.06);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.fill();
    ctx.restore();

    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.38)';
    ctx.lineWidth = lw;
    roundRectPath(ctx, hl * 0.16, -hw * 1.18, 0.055 * ts, 0.045 * ts, 0.015 * ts);
    ctx.fill();
    ctx.stroke();
    roundRectPath(ctx, hl * 0.16, hw * 1.18 - 0.045 * ts, 0.055 * ts, 0.045 * ts, 0.015 * ts);
    ctx.fill();
    ctx.stroke();

    priusBodyPath(ctx, hl, hw);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.40)';
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.save();
    priusBodyPath(ctx, hl * 0.94, hw * 0.92);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.ellipse(hl * 0.15 + lx * 0.04 * ts, ly * 0.04 * ts, hl * 0.85, hw * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(254, 249, 195, 0.92)';
    ctx.beginPath();
    ctx.ellipse(hl * 0.82, -hw * 0.56, 0.042 * ts, 0.02 * ts, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hl * 0.82, hw * 0.56, 0.042 * ts, 0.02 * ts, 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(153, 27, 27, 0.85)';
    roundRectPath(ctx, -hl * 0.99, -hw * 0.72, 0.025 * ts, 0.045 * ts, 0.01 * ts);
    ctx.fill();
    roundRectPath(ctx, -hl * 0.99, hw * 0.72 - 0.045 * ts, 0.025 * ts, 0.045 * ts, 0.01 * ts);
    ctx.fill();

    priusGlassPath(ctx, hl, hw);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-hl * 0.34, -hw * 0.54);
    ctx.quadraticCurveTo(hl * 0.08, -hw * 0.62, hl * 0.18, -hw * 0.52);
    ctx.quadraticCurveTo(hl * 0.24, 0, hl * 0.18, hw * 0.52);
    ctx.quadraticCurveTo(hl * 0.08, hw * 0.62, -hl * 0.34, hw * 0.54);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = bodyColor;
    ctx.globalAlpha = 0.82;
    roundRectPath(ctx, -hl * 0.30, -hw * 0.50, hl * 0.42, hw * 1.00, 0.025 * ts);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-hl * 0.08 + lx * 0.015 * ts, -hw * 0.16 + ly * 0.015 * ts, hl * 0.17, hw * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.lineWidth = Math.max(0.8, 0.018 * ts);
    ctx.beginPath();
    ctx.moveTo(hl * 0.26, -hw * 0.42);
    ctx.lineTo(hl * 0.42, -hw * 0.08);
    ctx.stroke();

    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = Math.max(0.8, 0.018 * ts);
    ctx.beginPath();
    ctx.moveTo(-hl * 0.68, -hw * 0.56);
    ctx.lineTo(-hl * 0.68, hw * 0.56);
    ctx.stroke();

    if ((h % 7) === 0) {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.lineWidth = Math.max(0.7, 0.014 * ts);
      ctx.beginPath();
      ctx.moveTo(-hl * 0.24, -hw * 0.46);
      ctx.lineTo(hl * 0.06, -hw * 0.46);
      ctx.moveTo(-hl * 0.24, hw * 0.46);
      ctx.lineTo(hl * 0.06, hw * 0.46);
      ctx.stroke();
    }

    ctx.restore();
  }

  function bus(ctx, x, y, angle, ts, seed) {
    var L = 0.80 * ts;
    var W = 0.30 * ts;
    var hl = L * 0.5;
    var hw = W * 0.5;
    var h = hashSeed(seed);
    var lw = Math.max(0.8, 0.02 * ts);
    var i;

    ctx.save();

    ctx.save();
    ctx.translate(x + 0.035 * ts, y + 0.045 * ts);
    ctx.rotate(angle);
    roundRectPath(ctx, -hl - 0.01 * ts, -hw - 0.01 * ts, L + 0.02 * ts, W + 0.02 * ts, 0.055 * ts);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.20)';
    ctx.fill();
    ctx.restore();

    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = '#334155';
    roundRectPath(ctx, hl - 0.05 * ts, -hw - 0.025 * ts, 0.04 * ts, 0.03 * ts, 0.01 * ts);
    ctx.fill();
    roundRectPath(ctx, hl - 0.05 * ts, hw - 0.005 * ts, 0.04 * ts, 0.03 * ts, 0.01 * ts);
    ctx.fill();

    roundRectPath(ctx, -hl, -hw, L, W, 0.05 * ts);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.42)';
    ctx.lineWidth = lw;
    ctx.stroke();

    roundRectPath(ctx, hl - 0.11 * ts, -hw + 0.025 * ts, 0.08 * ts, W - 0.05 * ts, 0.025 * ts);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = Math.max(0.8, 0.018 * ts);
    ctx.beginPath();
    ctx.moveTo(hl - 0.085 * ts, -hw + 0.045 * ts);
    ctx.lineTo(hl - 0.045 * ts, -hw + 0.10 * ts);
    ctx.stroke();

    ctx.fillStyle = '#fef9c3';
    roundRectPath(ctx, hl - 0.025 * ts, -hw + 0.025 * ts, 0.022 * ts, 0.04 * ts, 0.008 * ts);
    ctx.fill();
    roundRectPath(ctx, hl - 0.025 * ts, hw - 0.065 * ts, 0.022 * ts, 0.04 * ts, 0.008 * ts);
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    roundRectPath(ctx, -hl + 0.005 * ts, -hw + 0.025 * ts, 0.018 * ts, 0.042 * ts, 0.006 * ts);
    ctx.fill();
    roundRectPath(ctx, -hl + 0.005 * ts, hw - 0.067 * ts, 0.018 * ts, 0.042 * ts, 0.006 * ts);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    var winStart = -hl + 0.075 * ts;
    var winW = 0.095 * ts;
    var winGap = 0.112 * ts;
    var winH = 0.036 * ts;
    for (i = 0; i < 5; i++) {
      var wx = winStart + i * winGap;
      roundRectPath(ctx, wx, -hw + 0.010 * ts, winW, winH, 0.008 * ts);
      ctx.fill();
      roundRectPath(ctx, wx, hw - 0.010 * ts - winH, winW, winH, 0.008 * ts);
      ctx.fill();
    }

    roundRectPath(ctx, -hl + 0.04 * ts, -hw + 0.052 * ts, L - 0.15 * ts, W - 0.104 * ts, 0.03 * ts);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(0.75, 0.016 * ts);
    ctx.stroke();

    if ((h % 3) === 0) {
      ctx.fillStyle = 'rgba(37, 99, 235, 0.18)';
      roundRectPath(ctx, -hl + 0.06 * ts, -hw + 0.062 * ts, L - 0.19 * ts, 0.018 * ts, 0.008 * ts);
      ctx.fill();
    }

    roundRectPath(ctx, -0.17 * ts, -0.068 * ts, 0.22 * ts, 0.136 * ts, 0.02 * ts);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(0.75, 0.015 * ts);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    roundRectPath(ctx, -0.14 * ts, -0.045 * ts, 0.065 * ts, 0.09 * ts, 0.01 * ts);
    ctx.fill();
    roundRectPath(ctx, -0.045 * ts, -0.045 * ts, 0.065 * ts, 0.09 * ts, 0.01 * ts);
    ctx.fill();

    roundRectPath(ctx, 0.11 * ts, -0.045 * ts, 0.08 * ts, 0.09 * ts, 0.014 * ts);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();

    ctx.restore();
  }

  function drawDangerGlow(ctx, x, y, ts, now, danger) {
    if (!(danger > 0)) return;
    var d = Math.max(0, Math.min(1, danger));
    var t = (now || 0) * (0.006 + d * 0.007);
    var pulse = 0.5 + 0.5 * Math.sin(t);
    var alpha = d * (0.45 + 0.55 * pulse);
    var pad = 0.02 * ts;
    var r = 0.10 * ts;

    ctx.save();
    roundRectPath(ctx, x + pad, y + pad, ts - pad * 2, ts - pad * 2, r);
    ctx.fillStyle = 'rgba(239, 68, 68, ' + (0.12 * alpha).toFixed(3) + ')';
    ctx.fill();

    ctx.strokeStyle = 'rgba(239, 68, 68, ' + (0.24 * alpha).toFixed(3) + ')';
    ctx.lineWidth = Math.max(3, 0.15 * ts);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(239, 68, 68, ' + (0.48 * alpha).toFixed(3) + ')';
    ctx.lineWidth = Math.max(2, 0.085 * ts);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(239, 68, 68, ' + (0.92 * alpha).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1.4, 0.04 * ts);
    ctx.stroke();
    ctx.restore();
  }

  function drawQueueDots(ctx, color, x, y, ts, queue) {
    var count = Math.max(0, Math.min(5, Math.round(queue || 0)));
    if (count <= 0) return;
    var r = Math.max(2.1, 0.055 * ts);
    var step = 0.145 * ts;
    var startX = x + ts * 0.5 - (count - 1) * step * 0.5;
    var cy = y - 0.085 * ts;
    var i;

    ctx.save();
    for (i = 0; i < count; i++) {
      var dx = startX + i * step;
      ctx.beginPath();
      ctx.arc(dx + 0.015 * ts, cy + 0.02 * ts, r + 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 0.024 * ts);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(dx - r * 0.28, cy - r * 0.28, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFlatsSource(ctx, color, x, y, ts) {
    var bx = x + 0.12 * ts;
    var bw = 0.76 * ts;
    var roofY = y + 0.14 * ts;
    var roofH = 0.28 * ts;
    var wallY = roofY + roofH;
    var wallH = 0.46 * ts;
    var lw = Math.max(0.8, 0.02 * ts);
    var row, col;

    roundRectPath(ctx, bx + 0.05 * ts, roofY + 0.06 * ts, bw, roofH + wallH, 0.04 * ts);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.fill();

    roundRectPath(ctx, bx, wallY - 0.03 * ts, bw, wallH + 0.03 * ts, 0.03 * ts);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.07)';
    ctx.fillRect(bx + bw * 0.5, wallY, bw * 0.5, wallH);

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    ctx.lineWidth = Math.max(0.6, 0.012 * ts);
    for (col = 1; col < 4; col++) {
      var sx = bx + (bw * col) / 4;
      ctx.beginPath();
      ctx.moveTo(sx, wallY);
      ctx.lineTo(sx, wallY + wallH);
      ctx.stroke();
    }

    var winW = 0.10 * ts;
    var winH = 0.055 * ts;
    for (row = 0; row < 4; row++) {
      var wy = wallY + 0.045 * ts + row * 0.088 * ts;
      for (col = 0; col < 4; col++) {
        if (row === 3 && (col === 1 || col === 2)) continue;
        var wx = bx + 0.045 * ts + col * 0.188 * ts;
        var lit = ((row * 7 + col * 3) % 5) === 0 || ((row + col) % 4) === 1;
        ctx.fillStyle = lit ? '#fde047' : '#334155';
        ctx.fillRect(wx, wy, winW, winH);
      }
    }

    var entW = 0.22 * ts;
    var entX = x + (ts - entW) * 0.5;
    var entY = wallY + wallH - 0.17 * ts;
    ctx.fillStyle = '#1e293b';
    roundRectPath(ctx, entX + 0.05 * ts, entY + 0.05 * ts, entW - 0.10 * ts, 0.12 * ts, 0.015 * ts);
    ctx.fill();

    roundRectPath(ctx, entX, entY, entW, 0.065 * ts, 0.018 * ts);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.30)';
    ctx.lineWidth = lw;
    ctx.stroke();

    roundRectPath(ctx, entX + 0.015 * ts, entY - 0.012 * ts, entW - 0.03 * ts, 0.025 * ts, 0.01 * ts);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    roundRectPath(ctx, bx, roofY, bw, roofH, 0.035 * ts);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.32)';
    ctx.lineWidth = lw;
    ctx.stroke();

    roundRectPath(ctx, bx + 0.055 * ts, roofY + 0.05 * ts, bw - 0.11 * ts, roofH - 0.10 * ts, 0.02 * ts);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    roundRectPath(ctx, bx + 0.14 * ts, roofY + 0.09 * ts, 0.14 * ts, 0.08 * ts, 0.015 * ts);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, bx + 0.14 * ts, roofY + 0.085 * ts, 0.14 * ts, 0.035 * ts, 0.01 * ts);
    ctx.fill();
  }

  function drawGerSource(ctx, color, x, y, ts, now) {
    var fx = x + 0.09 * ts;
    var fy = y + 0.14 * ts;
    var fw = 0.82 * ts;
    var fh = 0.76 * ts;
    var lw = Math.max(0.8, 0.018 * ts);
    var i;

    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = Math.max(1.2, 0.032 * ts);
    ctx.beginPath();
    ctx.moveTo(fx, fy + fh);
    ctx.lineTo(fx, fy);
    ctx.lineTo(fx + fw, fy);
    ctx.lineTo(fx + fw, fy + fh);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.8, 0.016 * ts);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + fw, fy);
    ctx.stroke();

    var hx = x + 0.47 * ts;
    var hy = y + 0.19 * ts;
    var hw = 0.38 * ts;
    var hh = 0.36 * ts;

    roundRectPath(ctx, hx + 0.035 * ts, hy + 0.045 * ts, hw, hh, 0.025 * ts);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.fill();

    roundRectPath(ctx, hx, hy + hh * 0.45, hw, hh * 0.55, 0.02 * ts);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.fillRect(hx + 0.07 * ts, hy + hh * 0.62, 0.08 * ts, 0.07 * ts);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(hx + 0.22 * ts, hy + hh * 0.60, 0.07 * ts, hh * 0.40);

    roundRectPath(ctx, hx - 0.02 * ts, hy, hw + 0.04 * ts, hh * 0.54, 0.03 * ts);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.30)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
    roundRectPath(ctx, hx + 0.01 * ts, hy + 0.02 * ts, hw * 0.72, hh * 0.30, 0.025 * ts);
    ctx.fill();

    var gx = x + 0.34 * ts;
    var gy = y + 0.58 * ts;
    var gr = 0.21 * ts;

    ctx.beginPath();
    ctx.ellipse(gx + 0.03 * ts, gy + 0.06 * ts, gr * 1.04, gr * 0.92, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(gx, gy + 0.04 * ts, gr, gr * 0.85, 0, 0, Math.PI);
    ctx.lineTo(gx - gr, gy);
    ctx.closePath();
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.fillStyle = '#c2410c';
    roundRectPath(ctx, gx - 0.04 * ts, gy + gr * 0.28, 0.08 * ts, gr * 0.54, 0.015 * ts);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(0.6, 0.012 * ts);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(gx, gy - 0.01 * ts, gr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.26)';
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(gx + 0.02 * ts, gy + 0.01 * ts, gr * 0.78, 0.2, Math.PI * 1.15);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = Math.max(1, 0.025 * ts);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(gx, gy - 0.02 * ts, gr * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#ea580c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gx, gy - 0.02 * ts, gr * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = '#334155';
    ctx.fill();

    var pipeX = gx + 0.04 * ts;
    var pipeBaseY = gy - 0.06 * ts;
    var pipeTopY = gy - 0.24 * ts;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.5, 0.04 * ts);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pipeX, pipeBaseY);
    ctx.lineTo(pipeX, pipeTopY);
    ctx.stroke();

    var tBase = (now || 0) * 0.0011;
    for (i = 0; i < 3; i++) {
      var p = (tBase + i / 3) % 1;
      var sx = pipeX + p * 0.17 * ts + Math.sin(p * 6 + i * 2) * 0.018 * ts;
      var sy = pipeTopY - 0.02 * ts - p * 0.28 * ts;
      var sr = (0.032 + p * 0.062) * ts;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(148, 163, 184, ' + (0.52 * (1 - p)).toFixed(3) + ')';
      ctx.fill();
    }

    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = Math.max(1.3, 0.032 * ts);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(fx, fy + fh);
    ctx.lineTo(fx + fw * 0.34, fy + fh);
    ctx.moveTo(fx + fw * 0.64, fy + fh);
    ctx.lineTo(fx + fw, fy + fh);
    ctx.stroke();
  }

  function source(ctx, art, color, x, y, ts, now, queue, danger) {
    var col = color || '#2f7cf6';
    var pad = 0.04 * ts;

    ctx.save();

    roundRectPath(ctx, x + pad, y + pad, ts - pad * 2, ts - pad * 2, 0.09 * ts);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(0.75, 0.018 * ts);
    ctx.stroke();

    drawDangerGlow(ctx, x, y, ts, now, danger);

    if (art === 'ger') {
      drawGerSource(ctx, col, x, y, ts, now);
    } else {
      drawFlatsSource(ctx, col, x, y, ts);
    }

    drawQueueDots(ctx, col, x, y, ts, queue);

    ctx.restore();
  }

  function drawSignIcon(ctx, kind, cx, cy, r, now) {
    var k = (kind || '').toLowerCase();
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (k === 'work' || k === 'office') {
      var bw = r * 1.05;
      var bh = r * 0.72;
      ctx.lineWidth = Math.max(1.2, r * 0.16);
      ctx.beginPath();
      ctx.arc(cx, cy - bh * 0.45, bw * 0.24, Math.PI, 0);
      ctx.stroke();
      roundRectPath(ctx, cx - bw * 0.5, cy - bh * 0.36, bw, bh, r * 0.14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.30)';
      ctx.lineWidth = Math.max(0.8, r * 0.10);
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.46, cy - bh * 0.05);
      ctx.lineTo(cx + bw * 0.46, cy - bh * 0.05);
      ctx.stroke();
    } else if (k === 'school') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.48);
      ctx.lineTo(cx + r * 0.64, cy - r * 0.14);
      ctx.lineTo(cx, cy + r * 0.20);
      ctx.lineTo(cx - r * 0.64, cy - r * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.34, cy + r * 0.12);
      ctx.lineTo(cx - r * 0.34, cy + r * 0.40);
      ctx.quadraticCurveTo(cx, cy + r * 0.54, cx + r * 0.34, cy + r * 0.40);
      ctx.lineTo(cx + r * 0.34, cy + r * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.54, cy - r * 0.10);
      ctx.lineTo(cx + r * 0.54, cy + r * 0.38);
      ctx.stroke();
    } else if (k === 'market') {
      ctx.lineWidth = Math.max(1.2, r * 0.16);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.58, cy - r * 0.36);
      ctx.lineTo(cx - r * 0.34, cy - r * 0.36);
      ctx.lineTo(cx - r * 0.18, cy + r * 0.22);
      ctx.lineTo(cx + r * 0.44, cy + r * 0.22);
      ctx.lineTo(cx + r * 0.56, cy - r * 0.18);
      ctx.lineTo(cx - r * 0.26, cy - r * 0.18);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - r * 0.12, cy + r * 0.44, r * 0.12, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.36, cy + r * 0.44, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else if (k === 'hospital') {
      var arm = r * 0.54;
      var thick = r * 0.34;
      roundRectPath(ctx, cx - thick * 0.5, cy - arm, thick, arm * 2, r * 0.08);
      ctx.fill();
      roundRectPath(ctx, cx - arm, cy - thick * 0.5, arm * 2, thick, r * 0.08);
      ctx.fill();
    } else if (k === 'store') {
      var sw = r * 0.88;
      var sh = r * 0.78;
      ctx.lineWidth = Math.max(1.2, r * 0.15);
      ctx.beginPath();
      ctx.arc(cx, cy - sh * 0.32, sw * 0.26, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - sw * 0.44, cy - sh * 0.28);
      ctx.lineTo(cx + sw * 0.44, cy - sh * 0.28);
      ctx.lineTo(cx + sw * 0.50, cy + sh * 0.54);
      ctx.lineTo(cx - sw * 0.50, cy + sh * 0.54);
      ctx.closePath();
      ctx.fill();
    } else {
      var wave = Math.sin((now || 0) * 0.005) * r * 0.07;
      ctx.lineWidth = Math.max(1.3, r * 0.16);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.34, cy + r * 0.52);
      ctx.lineTo(cx - r * 0.34, cy - r * 0.48);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.30, cy - r * 0.46);
      ctx.quadraticCurveTo(cx + r * 0.12, cy - r * 0.54 + wave, cx + r * 0.48, cy - r * 0.36 - wave);
      ctx.lineTo(cx + r * 0.48, cy + r * 0.08 - wave);
      ctx.quadraticCurveTo(cx + r * 0.12, cy - r * 0.08 + wave, cx - r * 0.30, cy + r * 0.02);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function destination(ctx, kind, color, x, y, ts, now) {
    var col = color || '#2f7cf6';
    var pad = 0.04 * ts;
    var bx = x + 0.10 * ts;
    var bw = 0.80 * ts;
    var roofY = y + 0.17 * ts;
    var roofH = 0.33 * ts;
    var wallY = roofY + roofH;
    var wallH = 0.39 * ts;
    var lw = Math.max(0.8, 0.02 * ts);
    var signX = x + ts * 0.5;
    var signY = y + 0.36 * ts;
    var signR = 0.22 * ts;

    ctx.save();

    roundRectPath(ctx, x + pad, y + pad, ts - pad * 2, ts - pad * 2, 0.09 * ts);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(0.75, 0.018 * ts);
    ctx.stroke();

    roundRectPath(ctx, bx + 0.05 * ts, roofY + 0.06 * ts, bw, roofH + wallH, 0.045 * ts);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.20)';
    ctx.fill();

    roundRectPath(ctx, bx + 0.02 * ts, wallY - 0.02 * ts, bw - 0.04 * ts, wallH + 0.02 * ts, 0.03 * ts);
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.26)';
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
    ctx.fillRect(bx + bw * 0.5, wallY, bw * 0.5 - 0.02 * ts, wallH);

    ctx.fillStyle = '#334155';
    roundRectPath(ctx, x + 0.38 * ts, wallY + wallH - 0.18 * ts, 0.24 * ts, 0.18 * ts, 0.02 * ts);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + 0.18 * ts, wallY + 0.14 * ts, 0.12 * ts, 0.12 * ts);
    ctx.fillRect(x + 0.70 * ts, wallY + 0.14 * ts, 0.12 * ts, 0.12 * ts);

    roundRectPath(ctx, bx, roofY, bw, roofH, 0.04 * ts);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.32)';
    ctx.lineWidth = lw;
    ctx.stroke();

    roundRectPath(ctx, bx + 0.04 * ts, roofY + 0.035 * ts, bw - 0.08 * ts, roofH * 0.58, 0.03 * ts);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = 'rgba(191, 219, 254, 0.45)';
    roundRectPath(ctx, bx + 0.08 * ts, roofY + roofH * 0.46, bw - 0.14 * ts, roofH * 0.14, 0.015 * ts);
    ctx.fill();

    roundRectPath(ctx, bx - 0.02 * ts, wallY - 0.03 * ts, bw + 0.04 * ts, 0.10 * ts, 0.03 * ts);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.30)';
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(bx + 0.08 * ts, wallY - 0.02 * ts, 0.09 * ts, 0.08 * ts);
    ctx.fillRect(bx + 0.35 * ts, wallY - 0.02 * ts, 0.09 * ts, 0.08 * ts);
    ctx.fillRect(bx + 0.62 * ts, wallY - 0.02 * ts, 0.09 * ts, 0.08 * ts);

    ctx.beginPath();
    ctx.arc(signX + 0.02 * ts, signY + 0.03 * ts, signR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(signX, signY, signR, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.4, 0.038 * ts);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(signX - signR * 0.25, signY - signR * 0.25, signR * 0.65, Math.PI * 1.1, Math.PI * 1.85);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = Math.max(0.8, 0.018 * ts);
    ctx.stroke();

    drawSignIcon(ctx, kind, signX, signY, signR * 0.72, now);

    ctx.restore();
  }

  function label(ctx, text, cx, cy, ts, color) {
    var str = (text === undefined || text === null) ? '' : String(text);
    var col = color || '#2f7cf6';
    var h = Math.max(13, 0.36 * ts);
    var fontSize = Math.max(9, 0.26 * ts);
    var maxTextW = 2.2 * ts;
    var measuredW;
    var displayText = str;

    ctx.save();
    ctx.font = '700 ' + fontSize + 'px ' + FONT_STACK;
    measuredW = ctx.measureText(displayText).width;

    if (measuredW > maxTextW) {
      fontSize = Math.max(8, fontSize * (maxTextW / measuredW));
      ctx.font = '700 ' + fontSize + 'px ' + FONT_STACK;
      measuredW = ctx.measureText(displayText).width;
      while (measuredW > maxTextW && fontSize > 8) {
        fontSize = Math.max(8, fontSize - 0.5);
        ctx.font = '700 ' + fontSize + 'px ' + FONT_STACK;
        measuredW = ctx.measureText(displayText).width;
      }
      if (measuredW > maxTextW) {
        var cut = displayText.length;
        while (cut > 0) {
          var cand = displayText.slice(0, cut) + '\u2026';
          var cw = ctx.measureText(cand).width;
          if (cw <= maxTextW) {
            displayText = cand;
            measuredW = cw;
            break;
          }
          cut--;
        }
        if (cut === 0) {
          displayText = '\u2026';
          measuredW = ctx.measureText(displayText).width;
        }
      }
    }

    var padX = Math.max(5, 0.16 * ts);
    var chipW = Math.max(h, measuredW + padX * 2);
    var rx = cx - chipW * 0.5;
    var ry = cy - h * 0.5;
    var rad = h * 0.5;

    roundRectPath(ctx, rx + 0.015 * ts, ry + Math.max(1, 0.035 * ts), chipW, h, rad);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.fill();

    roundRectPath(ctx, rx, ry, chipW, h, rad);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 0.03 * ts);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, cx, cy + 0.3);

    ctx.restore();
  }

  function bubblePath(ctx, bx1, by1, bx2, by2, r, cx, cy, tailHW) {
    ctx.beginPath();
    ctx.moveTo(bx1 + r, by1);
    ctx.lineTo(bx2 - r, by1);
    ctx.quadraticCurveTo(bx2, by1, bx2, by1 + r);
    ctx.lineTo(bx2, by2 - r);
    ctx.quadraticCurveTo(bx2, by2, bx2 - r, by2);
    ctx.lineTo(cx + tailHW, by2);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - tailHW, by2);
    ctx.lineTo(bx1 + r, by2);
    ctx.quadraticCurveTo(bx1, by2, bx1, by2 - r);
    ctx.lineTo(bx1, by1 + r);
    ctx.quadraticCurveTo(bx1, by1, bx1 + r, by1);
    ctx.closePath();
  }

  function bubble(ctx, text, cx, cy, ts, alpha) {
    var a = (alpha === undefined) ? 1 : Math.max(0, Math.min(1, alpha));
    if (a <= 0) return;

    var str = (text === undefined || text === null) ? '' : String(text);
    var fontSize = Math.max(10, 0.30 * ts);

    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * a;
    ctx.font = '700 ' + fontSize + 'px ' + FONT_STACK;

    var tw = ctx.measureText(str).width;
    var padX = Math.max(7, 0.22 * ts);
    var padY = Math.max(4, 0.14 * ts);
    var bw = Math.max(0.75 * ts, tw + padX * 2);
    var bh = fontSize + padY * 2;
    var r = Math.min(bh * 0.45, Math.max(5, 0.18 * ts));
    var tailH = Math.max(4, 0.16 * ts);
    var tailHW = Math.min(Math.max(3, 0.11 * ts), bw * 0.5 - r - 1);
    var by2 = cy - tailH;
    var by1 = by2 - bh;
    var bx1 = cx - bw * 0.5;
    var bx2 = cx + bw * 0.5;

    ctx.save();
    ctx.translate(0.025 * ts, 0.035 * ts);
    bubblePath(ctx, bx1, by1, bx2, by2, r, cx, cy, tailHW);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.fill();
    ctx.restore();

    bubblePath(ctx, bx1, by1, bx2, by2, r, cx, cy, tailHW);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.4, 0.04 * ts);
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, cx, (by1 + by2) * 0.5 + 0.3);

    ctx.restore();
  }

  function streetName(ctx, text, x1, x2, cy, ts) {
    var str = (text === undefined || text === null) ? '' : String(text);
    if (!str) return;
    var span = Math.abs(x2 - x1);
    var maxW = Math.max(4, span - Math.min(span * 0.12, 0.16 * ts));
    var midX = (x1 + x2) * 0.5;
    var fontSize = Math.max(8.5, 0.23 * ts);
    var tw;

    ctx.save();
    ctx.font = '700 ' + fontSize + 'px ' + FONT_STACK;
    tw = ctx.measureText(str).width;
    if (tw > maxW) {
      fontSize = Math.max(6, fontSize * (maxW / tw));
      ctx.font = '700 ' + fontSize + 'px ' + FONT_STACK;
      tw = ctx.measureText(str).width;
      while (tw > maxW && fontSize > 6) {
        fontSize = Math.max(6, fontSize - 0.5);
        ctx.font = '700 ' + fontSize + 'px ' + FONT_STACK;
        tw = ctx.measureText(str).width;
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.lineWidth = Math.max(2, fontSize * 0.28);
    ctx.strokeText(str, midX, cy);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(str, midX, cy);

    ctx.restore();
  }

  var UBArtThings = {
    car: car,
    bus: bus,
    source: source,
    destination: destination,
    label: label,
    bubble: bubble,
    streetName: streetName
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = UBArtThings;
  else root.UBArtThings = UBArtThings;
})(this);
