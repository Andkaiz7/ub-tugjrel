(function (root) {
  var FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w * 0.5, h * 0.5);
    if (rr < 0) rr = 0;
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  function drawSmokePlume(ctx, x, y, t, scale, dirX, dirY, count, maxDist, alphaBase, phaseOffset) {
    for (var i = 0; i < count; i++) {
      var phase = ((t * 0.00016 + i / count + phaseOffset) % 1 + 1) % 1;
      var px = x + dirX * phase * maxDist;
      var py = y + dirY * phase * maxDist * 0.55 - Math.sin(phase * Math.PI * 1.4) * 3 * scale;
      var r = (2.2 + phase * 6.8) * scale;
      var a = Math.sin(phase * Math.PI) * alphaBase;
      if (a <= 0.005 || r <= 0.3) continue;
      ctx.fillStyle = 'rgba(166, 169, 176, ' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBackdropSkyline(ctx, cw, topH, baseY, t) {
    if (topH < 3) return;
    var s = clamp(topH / 56, 0.08, 1.35);
    var hillAmp = Math.min(topH * 0.82, 54);
    var maxBldH = Math.min(topH * 0.86, 68);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, Math.max(0, baseY + 2));
    ctx.clip();

    ctx.fillStyle = 'rgba(182, 193, 206, 0.52)';
    ctx.beginPath();
    ctx.moveTo(-10, baseY + 2);
    ctx.lineTo(-10, baseY - hillAmp * 0.55);
    ctx.quadraticCurveTo(cw * 0.14, baseY - hillAmp * 0.92, cw * 0.32, baseY - hillAmp * 0.62);
    ctx.quadraticCurveTo(cw * 0.52, baseY - hillAmp * 0.96, cw * 0.72, baseY - hillAmp * 0.68);
    ctx.quadraticCurveTo(cw * 0.88, baseY - hillAmp * 0.88, cw + 10, baseY - hillAmp * 0.52);
    ctx.lineTo(cw + 10, baseY + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(236, 241, 247, 0.48)';
    ctx.beginPath();
    ctx.moveTo(-10, baseY - hillAmp * 0.55);
    ctx.quadraticCurveTo(cw * 0.14, baseY - hillAmp * 0.92, cw * 0.32, baseY - hillAmp * 0.62);
    ctx.quadraticCurveTo(cw * 0.52, baseY - hillAmp * 0.96, cw * 0.72, baseY - hillAmp * 0.68);
    ctx.quadraticCurveTo(cw * 0.88, baseY - hillAmp * 0.88, cw + 10, baseY - hillAmp * 0.52);
    ctx.lineTo(cw + 10, baseY - hillAmp * 0.38);
    ctx.quadraticCurveTo(cw * 0.85, baseY - hillAmp * 0.66, cw * 0.68, baseY - hillAmp * 0.48);
    ctx.quadraticCurveTo(cw * 0.48, baseY - hillAmp * 0.74, cw * 0.28, baseY - hillAmp * 0.45);
    ctx.quadraticCurveTo(cw * 0.12, baseY - hillAmp * 0.68, -10, baseY - hillAmp * 0.40);
    ctx.closePath();
    ctx.fill();

    if (topH >= 14) {
      var gerCount = Math.max(10, Math.round(cw / 28));
      var gerR = clamp(s * 3.1, 1.8, 3.8);
      for (var g = 0; g < gerCount; g++) {
        var gx = (0.04 + (g + hash(g + 3) * 0.6) / gerCount * 0.92) * cw;
        var gy = baseY - hillAmp * (0.36 + hash(g + 19) * 0.36);
        ctx.fillStyle = 'rgba(148, 142, 134, 0.35)';
        ctx.fillRect(gx - gerR * 1.4, gy - gerR * 0.2, gerR * 2.8, gerR * 1.1);
        ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
        ctx.beginPath();
        ctx.arc(gx, gy, gerR, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (topH >= 6) {
      var bCount = Math.max(12, Math.round(cw / 22));
      for (var b = 0; b < bCount; b++) {
        var bx = (0.02 + (b / bCount) * 0.96) * cw;
        if (Math.abs(bx - cw * 0.5) < cw * 0.032) continue;
        if (Math.abs(bx - cw * 0.145) < cw * 0.035) continue;
        var bw = clamp((0.02 + hash(b + 41) * 0.026) * cw, 8, 24);
        var bh = maxBldH * (0.28 + hash(b + 73) * 0.42);
        var by = baseY - bh;
        ctx.fillStyle = b % 2 === 0 ? 'rgba(130, 141, 156, 0.48)' : 'rgba(116, 128, 144, 0.56)';
        ctx.fillRect(bx - bw * 0.5, by, bw, bh + 2);
        ctx.fillStyle = 'rgba(241, 245, 249, 0.42)';
        ctx.fillRect(bx - bw * 0.5, by, bw, Math.max(1, Math.min(2.2, bh * 0.1)));
      }

      var sailX = cw * 0.5;
      var sailW = clamp(cw * 0.036, 9, 22);
      var sailH = maxBldH * 0.98;
      ctx.fillStyle = 'rgba(92, 122, 158, 0.72)';
      ctx.beginPath();
      ctx.moveTo(sailX - sailW * 0.45, baseY + 2);
      ctx.lineTo(sailX - sailW * 0.36, baseY - sailH * 0.96);
      ctx.quadraticCurveTo(sailX + sailW * 0.75, baseY - sailH * 0.55, sailX + sailW * 0.52, baseY + 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(219, 234, 254, 0.48)';
      ctx.lineWidth = Math.max(1, s * 1.1);
      ctx.beginPath();
      ctx.moveTo(sailX - sailW * 0.34, baseY - sailH * 0.93);
      ctx.quadraticCurveTo(sailX + sailW * 0.65, baseY - sailH * 0.52, sailX + sailW * 0.46, baseY);
      ctx.stroke();

      var plantX = cw * 0.145;
      var ch1X = plantX - clamp(cw * 0.015, 5, 11);
      var ch2X = plantX + clamp(cw * 0.015, 5, 11);
      var chH1 = maxBldH * 0.94;
      var chH2 = maxBldH * 0.86;
      var chW = clamp(s * 4.2, 2.2, 5.5);

      ctx.fillStyle = 'rgba(116, 126, 140, 0.58)';
      ctx.fillRect(plantX - chW * 4.5, baseY - maxBldH * 0.28, chW * 9, maxBldH * 0.28 + 2);

      var chimneys = [
        { x: ch1X, h: chH1, off: 0.12 },
        { x: ch2X, h: chH2, off: 0.58 }
      ];
      for (var c = 0; c < chimneys.length; c++) {
        var chm = chimneys[c];
        ctx.fillStyle = 'rgba(104, 116, 132, 0.68)';
        ctx.beginPath();
        ctx.moveTo(chm.x - chW * 0.65, baseY + 2);
        ctx.lineTo(chm.x - chW * 0.36, baseY - chm.h);
        ctx.lineTo(chm.x + chW * 0.36, baseY - chm.h);
        ctx.lineTo(chm.x + chW * 0.65, baseY + 2);
        ctx.closePath();
        ctx.fill();

        if (topH >= 12) {
          drawSmokePlume(
            ctx,
            chm.x,
            baseY - chm.h,
            t,
            clamp(topH / 48, 0.35, 1.15),
            1,
            -0.28,
            8,
            Math.max(42, cw * 0.16),
            0.34,
            chm.off
          );
        }
      }
    }

    ctx.restore();
  }

  function drawBackdropMountains(ctx, cw, ch, botY, botH) {
    if (botH < 3) return;
    var ridgeH = Math.min(botH * 0.92, 86);
    var topY = ch - ridgeH;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, Math.max(0, botY - 2), cw, ch - botY + 4);
    ctx.clip();

    ctx.fillStyle = 'rgba(92, 108, 128, 0.62)';
    ctx.beginPath();
    ctx.moveTo(-10, ch + 2);
    ctx.lineTo(-10, ch - ridgeH * 0.52);
    ctx.lineTo(cw * 0.12, ch - ridgeH * 0.86);
    ctx.lineTo(cw * 0.26, ch - ridgeH * 0.62);
    ctx.lineTo(cw * 0.42, ch - ridgeH * 0.96);
    ctx.lineTo(cw * 0.58, ch - ridgeH * 0.72);
    ctx.lineTo(cw * 0.76, ch - ridgeH * 0.98);
    ctx.lineTo(cw * 0.90, ch - ridgeH * 0.68);
    ctx.lineTo(cw + 10, ch - ridgeH * 0.82);
    ctx.lineTo(cw + 10, ch + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(72, 88, 108, 0.74)';
    ctx.beginPath();
    ctx.moveTo(-10, ch + 2);
    ctx.lineTo(-10, ch - ridgeH * 0.38);
    ctx.lineTo(cw * 0.16, ch - ridgeH * 0.68);
    ctx.lineTo(cw * 0.33, ch - ridgeH * 0.46);
    ctx.lineTo(cw * 0.51, ch - ridgeH * 0.78);
    ctx.lineTo(cw * 0.68, ch - ridgeH * 0.52);
    ctx.lineTo(cw * 0.85, ch - ridgeH * 0.74);
    ctx.lineTo(cw + 10, ch - ridgeH * 0.48);
    ctx.lineTo(cw + 10, ch + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(235, 241, 248, 0.78)';
    var peaks = [
      [0.12, 0.86, 0.06],
      [0.42, 0.96, 0.08],
      [0.76, 0.98, 0.08],
      [0.51, 0.78, 0.065],
      [0.85, 0.74, 0.055]
    ];
    for (var p = 0; p < peaks.length; p++) {
      var pk = peaks[p];
      var px = pk[0] * cw;
      var py = ch - ridgeH * pk[1];
      var pw = pk[2] * cw;
      var ph = Math.min(ridgeH * 0.34, Math.max(2, ch - topY));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - pw, py + ph);
      ctx.lineTo(px - pw * 0.35, py + ph * 0.72);
      ctx.lineTo(px, py + ph * 0.95);
      ctx.lineTo(px + pw * 0.4, py + ph * 0.70);
      ctx.lineTo(px + pw, py + ph);
      ctx.closePath();
      ctx.fill();
    }

    if (botH >= 14) {
      var treeCount = Math.max(18, Math.round(cw / 14));
      var treeH = clamp(ridgeH * 0.24, 4, 14);
      ctx.fillStyle = 'rgba(46, 62, 78, 0.58)';
      for (var i = 0; i < treeCount; i++) {
        var tx = (0.02 + (i + hash(i + 9) * 0.7) / treeCount * 0.96) * cw;
        var ty = ch - ridgeH * (0.14 + hash(i + 31) * 0.36);
        var th = treeH * (0.7 + hash(i + 53) * 0.5);
        var tw = th * 0.52;
        ctx.beginPath();
        ctx.moveTo(tx, ty - th);
        ctx.lineTo(tx - tw, ty);
        ctx.lineTo(tx + tw, ty);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function backdrop(ctx, cw, ch, board, now) {
    if (!ctx || cw <= 0 || ch <= 0) return;
    var t = (typeof now === 'number' && isFinite(now)) ? now : 0;
    var bx = board ? board.x : 0;
    var by = board ? board.y : 0;
    var bw = board ? board.w : cw;
    var bh = board ? board.h : ch;

    ctx.save();

    var sky = ctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, '#c4d1de');
    sky.addColorStop(0.35, '#d6dce2');
    sky.addColorStop(0.72, '#e4dcd0');
    sky.addColorStop(1, '#dad0c2');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);

    for (var m = 0; m < 3; m++) {
      var my = ch * (0.28 + m * 0.25);
      var mh = ch * 0.16;
      var shift = Math.sin(t * 0.00022 + m * 1.9) * cw * 0.03;
      var mist = ctx.createLinearGradient(0, my - mh * 0.5, 0, my + mh * 0.5);
      mist.addColorStop(0, 'rgba(229, 221, 209, 0)');
      mist.addColorStop(0.5, 'rgba(226, 217, 204, 0.24)');
      mist.addColorStop(1, 'rgba(229, 221, 209, 0)');
      ctx.fillStyle = mist;
      ctx.fillRect(shift - cw * 0.05, my - mh * 0.5, cw * 1.1, mh);
    }

    drawBackdropSkyline(ctx, cw, by, by, t);
    drawBackdropMountains(ctx, cw, ch, by + bh, ch - (by + bh));

    var sideLeft = Math.max(0, bx);
    var sideRight = Math.max(0, cw - (bx + bw));
    if (sideLeft > 4 || sideRight > 4) {
      var sideHaze = ctx.createLinearGradient(0, 0, 0, ch);
      sideHaze.addColorStop(0, 'rgba(216, 223, 232, 0.12)');
      sideHaze.addColorStop(1, 'rgba(224, 214, 200, 0.22)');
      ctx.fillStyle = sideHaze;
      if (sideLeft > 0) ctx.fillRect(0, 0, sideLeft, ch);
      if (sideRight > 0) ctx.fillRect(bx + bw, 0, sideRight, ch);
    }

    ctx.restore();
  }

  function drawMapGerHills(ctx, cw, ch, minDim, t) {
    ctx.save();

    ctx.fillStyle = '#d9e3ee';
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(cw + 10, -10);
    ctx.lineTo(cw + 10, ch * 0.19);
    ctx.quadraticCurveTo(cw * 0.82, ch * 0.23, cw * 0.65, ch * 0.18);
    ctx.quadraticCurveTo(cw * 0.58, ch * 0.14, cw * 0.50, ch * 0.19);
    ctx.quadraticCurveTo(cw * 0.30, ch * 0.24, cw * 0.14, ch * 0.18);
    ctx.quadraticCurveTo(cw * 0.05, ch * 0.16, -10, ch * 0.20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e5edf5';
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(cw + 10, -10);
    ctx.lineTo(cw + 10, ch * 0.13);
    ctx.quadraticCurveTo(cw * 0.78, ch * 0.16, cw * 0.61, ch * 0.11);
    ctx.quadraticCurveTo(cw * 0.44, ch * 0.15, cw * 0.24, ch * 0.12);
    ctx.quadraticCurveTo(cw * 0.10, ch * 0.15, -10, ch * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = Math.max(1.2, minDim * 0.003);
    ctx.beginPath();
    ctx.moveTo(0, ch * 0.19);
    ctx.quadraticCurveTo(cw * 0.20, ch * 0.22, cw * 0.45, ch * 0.18);
    ctx.moveTo(cw * 0.62, ch * 0.17);
    ctx.quadraticCurveTo(cw * 0.80, ch * 0.22, cw, ch * 0.18);
    ctx.stroke();

    var gerCount = 28;
    var gerR = clamp(minDim * 0.0085, 2.4, 4.4);
    for (var i = 0; i < gerCount; i++) {
      var nx = 0.04 + (i + hash(i + 11) * 0.65) / gerCount * 0.92;
      if (nx > 0.53 && nx < 0.62) continue;
      var ny = 0.045 + hash(i + 29) * 0.145;
      var gx = nx * cw;
      var gy = ny * ch;

      ctx.strokeStyle = '#b4a899';
      ctx.lineWidth = Math.max(0.8, gerR * 0.28);
      ctx.strokeRect(gx - gerR * 1.45, gy - gerR * 0.95, gerR * 2.9, gerR * 1.9);

      ctx.fillStyle = 'rgba(100, 116, 139, 0.25)';
      ctx.beginPath();
      ctx.ellipse(gx + gerR * 0.22, gy + gerR * 0.28, gerR * 0.92, gerR * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(gx, gy, gerR * 0.88, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(0.6, gerR * 0.2);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(0.7, gerR * 0.2), 0, Math.PI * 2);
      ctx.fill();

      var sway = Math.sin(t * 0.002 + i) * gerR * 0.55;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = Math.max(0.7, gerR * 0.24);
      ctx.beginPath();
      ctx.moveTo(gx, gy - gerR * 0.3);
      ctx.quadraticCurveTo(gx + gerR * 0.7 + sway, gy - gerR * 1.4, gx + gerR * 1.6 + sway, gy - gerR * 2.3);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawMapCityBlocks(ctx, cw, ch, minDim) {
    ctx.save();
    var blockPad = Math.max(2, minDim * 0.005);
    var cols = 6;
    var rows = 4;
    var startX = 0.32 * cw;
    var areaW = 0.28 * cw;
    var startY = 0.28 * ch;
    var areaH = 0.23 * ch;
    var cellW = areaW / cols;
    var cellH = areaH / rows;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cx = startX + c * cellW;
        var cy = startY + r * cellH;
        var normX = (cx + cellW * 0.5) / cw;
        var normY = (cy + cellH * 0.5) / ch;
        if (normX > 0.53 && normX < 0.61) continue;
        if (Math.abs(normX - 0.47) < 0.045 && Math.abs(normY - 0.435) < 0.05) continue;

        roundRectPath(ctx, cx + blockPad, cy + blockPad, cellW - blockPad * 2, cellH - blockPad * 2, 3);
        ctx.fillStyle = 'rgba(203, 213, 225, 0.58)';
        ctx.fill();

        var bCount = 2;
        for (var k = 0; k < bCount; k++) {
          var idx = r * 10 + c * 3 + k;
          var bx = cx + blockPad * 1.5 + (k === 0 ? 0 : (cellW - blockPad * 3) * 0.48);
          var by = cy + blockPad * 1.5 + hash(idx + 5) * (cellH * 0.22);
          var bw = (cellW - blockPad * 3.5) * (0.36 + hash(idx + 17) * 0.12);
          var bh = (cellH - blockPad * 3) * (0.34 + hash(idx + 23) * 0.26);
          if (bw < 3 || bh < 3) continue;

          ctx.fillStyle = 'rgba(100, 116, 139, 0.2)';
          ctx.fillRect(bx + 1.5, by + 2, bw, bh);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(bx, by + bh * 0.72, bw, bh * 0.28);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(bx, by, bw, bh * 0.74);
        }
      }
    }

    var clusters = [
      { x: 0.24, y: 0.78, w: 0.08, h: 0.05, seed: 101 },
      { x: 0.76, y: 0.36, w: 0.09, h: 0.06, seed: 202 },
      { x: 0.23, y: 0.41, w: 0.07, h: 0.05, seed: 303 },
      { x: 0.67, y: 0.50, w: 0.07, h: 0.05, seed: 404 }
    ];
    for (var cl = 0; cl < clusters.length; cl++) {
      var cls = clusters[cl];
      for (var j = 0; j < 4; j++) {
        var jx = (cls.x - cls.w * 0.5 + hash(cls.seed + j * 7) * cls.w) * cw;
        var jy = (cls.y - cls.h * 0.5 + hash(cls.seed + j * 13) * cls.h) * ch;
        var jw = clamp(minDim * 0.022, 6, 11);
        var jh = clamp(minDim * 0.015, 4, 8);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(jx, jy + jh * 0.65, jw, jh * 0.35);
        ctx.fillStyle = cl === 3 && j % 2 === 0 ? '#fca5a5' : '#f8fafc';
        ctx.fillRect(jx, jy, jw, jh * 0.68);
      }
    }

    var sqX = cw * 0.47;
    var sqY = ch * 0.436;
    var sqW = clamp(cw * 0.065, 20, 42);
    var sqH = clamp(ch * 0.048, 16, 28);
    roundRectPath(ctx, sqX - sqW * 0.5, sqY - sqH * 0.5, sqW, sqH, 4);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(sqX, sqY + sqH * 0.08, Math.max(1.8, minDim * 0.005), 0, Math.PI * 2);
    ctx.fill();

    var palX = cw * 0.47;
    var palY = ch * 0.415;
    var palW = clamp(minDim * 0.064, 18, 30);
    var palH = clamp(minDim * 0.026, 8, 13);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.fillRect(palX - palW * 0.5 + 1.5, palY - palH * 0.5 + 2, palW, palH);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(palX - palW * 0.5, palY - palH * 0.5, palW, palH);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(palX - palW * 0.52, palY - palH * 0.55, palW * 1.04, palH * 0.35);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(palX - palW * 0.22, palY - palH * 0.22, palW * 0.44, palH * 0.72);
    ctx.fillStyle = '#475569';
    ctx.fillRect(palX - palW * 0.12, palY - palH * 0.72, palW * 0.24, palH * 0.22);

    var skyX = cw * 0.51;
    var skyY = ch * 0.442;
    var skyH = clamp(minDim * 0.056, 15, 26);
    var skyW = skyH * 0.48;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.beginPath();
    ctx.ellipse(skyX + 2, skyY + 2, skyW * 0.55, skyW * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f7cf6';
    ctx.beginPath();
    ctx.moveTo(skyX - skyW * 0.45, skyY + 1);
    ctx.lineTo(skyX - skyW * 0.35, skyY - skyH);
    ctx.quadraticCurveTo(skyX + skyW * 0.8, skyY - skyH * 0.55, skyX + skyW * 0.5, skyY + 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#bfdbfe';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.restore();
  }

  function drawMapRivers(ctx, cw, ch, minDim) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var selbeW = clamp(minDim * 0.018, 5, 9);
    ctx.beginPath();
    ctx.moveTo(cw * 0.585, -8);
    ctx.bezierCurveTo(cw * 0.56, ch * 0.20, cw * 0.59, ch * 0.44, cw * 0.568, ch * 0.70);
    ctx.strokeStyle = '#dbe4ee';
    ctx.lineWidth = selbeW + 4;
    ctx.stroke();
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = selbeW;
    ctx.stroke();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = Math.max(1.5, selbeW * 0.35);
    ctx.stroke();

    var tuulW = clamp(minDim * 0.048, 14, 24);
    ctx.beginPath();
    ctx.moveTo(-16, ch * 0.735);
    ctx.bezierCurveTo(cw * 0.22, ch * 0.675, cw * 0.46, ch * 0.72, cw * 0.72, ch * 0.685);
    ctx.quadraticCurveTo(cw * 0.88, ch * 0.67, cw + 16, ch * 0.705);
    ctx.strokeStyle = '#dbe4ee';
    ctx.lineWidth = tuulW + 6;
    ctx.stroke();
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = tuulW;
    ctx.stroke();
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = tuulW * 0.55;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = Math.max(1, tuulW * 0.12);
    ctx.setLineDash([14, 18]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  function drawMapRailway(ctx, cw, ch, minDim) {
    ctx.save();
    var ry0 = ch * 0.566;
    var ry1 = ch * 0.556;
    var ry2 = ch * 0.558;
    var bedW = clamp(minDim * 0.015, 4, 7);

    ctx.beginPath();
    ctx.moveTo(-10, ry0);
    ctx.quadraticCurveTo(cw * 0.48, ry1, cw + 10, ry2);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = bedW + 2;
    ctx.stroke();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = bedW + 3;
    ctx.setLineDash([2, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.6, bedW * 0.42);
    ctx.stroke();

    ctx.restore();
  }

  function drawMapRoads(ctx, cw, ch, minDim, lang) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var roadW = clamp(minDim * 0.022, 6, 11);

    function strokeRoad(drawPath) {
      ctx.beginPath();
      drawPath();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = roadW + 3;
      ctx.stroke();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = roadW;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.78)';
      ctx.lineWidth = Math.max(1, roadW * 0.18);
      ctx.setLineDash([7, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    strokeRoad(function () {
      ctx.moveTo(-10, ch * 0.466);
      ctx.quadraticCurveTo(cw * 0.47, ch * 0.456, cw + 10, ch * 0.458);
    });

    strokeRoad(function () {
      ctx.moveTo(cw * 0.47, ch * 0.438);
      ctx.lineTo(cw * 0.47, ch * 0.805);
    });

    var brX = cw * 0.47;
    var brY = ch * 0.70;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(brX - roadW * 0.8, brY - roadW * 1.4, roadW * 1.6, roadW * 2.8);
    ctx.fillStyle = '#475569';
    ctx.fillRect(brX - roadW * 0.5, brY - roadW * 1.4, roadW, roadW * 2.8);

    var label = lang === 'mn' ? 'Энхтайваны өргөн чөлөө' : 'Peace Avenue';
    var fontSize = clamp(minDim * 0.024, 9, 11.5);
    ctx.font = '600 ' + fontSize + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var lx = cw * 0.295;
    var ly = ch * 0.461 - roadW * 0.95 - fontSize * 0.5;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = '#334155';
    ctx.fillText(label, lx, ly);

    ctx.restore();
  }

  function drawMapPowerPlant(ctx, cw, ch, minDim, t) {
    ctx.save();
    var px = cw * 0.15;
    var py = ch * 0.50;
    var s = clamp(minDim / 390, 0.85, 1.35);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.fillRect(px - 15 * s, py - 2 * s, 32 * s, 14 * s);

    ctx.fillStyle = '#64748b';
    ctx.fillRect(px - 16 * s, py - 4 * s, 30 * s, 12 * s);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(px - 16 * s, py - 6 * s, 30 * s, 4 * s);

    var cxs = [px - 6 * s, px + 6 * s];
    var chs = [22 * s, 19 * s];
    for (var i = 0; i < 2; i++) {
      var cx = cxs[i];
      var chH = chs[i];
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(cx - 3.2 * s, py - 4 * s);
      ctx.lineTo(cx - 1.8 * s, py - 4 * s - chH);
      ctx.lineTo(cx + 1.8 * s, py - 4 * s - chH);
      ctx.lineTo(cx + 3.2 * s, py - 4 * s);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 2 * s, py - 4 * s - chH * 0.85, 4 * s, 2.5 * s);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 2 * s, py - 4 * s - chH * 0.72, 4 * s, 2 * s);

      drawSmokePlume(ctx, cx, py - 4 * s - chH, t, s * 0.95, 1, -0.35, 7, 46 * s, 0.42, i * 0.45);
    }

    ctx.restore();
  }

  function drawMapBogdKhanAndLandmarks(ctx, cw, ch, minDim) {
    ctx.save();

    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-10, ch + 10);
    ctx.lineTo(-10, ch * 0.93);
    ctx.lineTo(cw * 0.12, ch * 0.92);
    ctx.lineTo(cw * 0.25, ch * 0.875);
    ctx.lineTo(cw * 0.37, ch * 0.905);
    ctx.lineTo(cw * 0.51, ch * 0.86);
    ctx.lineTo(cw * 0.66, ch * 0.895);
    ctx.lineTo(cw * 0.80, ch * 0.855);
    ctx.lineTo(cw * 0.92, ch * 0.885);
    ctx.lineTo(cw + 10, ch * 0.865);
    ctx.lineTo(cw + 10, ch + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(-10, ch + 10);
    ctx.lineTo(-10, ch * 0.95);
    ctx.lineTo(cw * 0.20, ch * 0.935);
    ctx.lineTo(cw * 0.34, ch * 0.90);
    ctx.lineTo(cw * 0.53, ch * 0.89);
    ctx.lineTo(cw * 0.71, ch * 0.92);
    ctx.lineTo(cw * 0.86, ch * 0.885);
    ctx.lineTo(cw + 10, ch * 0.91);
    ctx.lineTo(cw + 10, ch + 10);
    ctx.closePath();
    ctx.fill();

    var snowPeaks = [
      [0.25, 0.875, 0.055],
      [0.51, 0.86, 0.065],
      [0.80, 0.855, 0.07]
    ];
    ctx.fillStyle = '#f1f5f9';
    for (var p = 0; p < snowPeaks.length; p++) {
      var sp = snowPeaks[p];
      var sx = sp[0] * cw;
      var sy = sp[1] * ch;
      var sw = sp[2] * cw;
      var sh = ch * 0.036;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - sw, sy + sh);
      ctx.lineTo(sx - sw * 0.3, sy + sh * 0.68);
      ctx.lineTo(sx, sy + sh * 0.95);
      ctx.lineTo(sx + sw * 0.35, sy + sh * 0.68);
      ctx.lineTo(sx + sw, sy + sh);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#1e293b';
    var treeCount = 34;
    var treeH = clamp(minDim * 0.022, 6, 12);
    for (var i = 0; i < treeCount; i++) {
      var tx = (0.16 + (i + hash(i + 61) * 0.6) / treeCount * 0.82) * cw;
      var ty = ch * (0.905 + hash(i + 79) * 0.085);
      var th = treeH * (0.75 + hash(i + 97) * 0.45);
      var tw = th * 0.55;
      ctx.beginPath();
      ctx.moveTo(tx, ty - th);
      ctx.lineTo(tx - tw, ty);
      ctx.lineTo(tx + tw, ty);
      ctx.closePath();
      ctx.fill();
    }

    var zx = cw * 0.50;
    var zy = ch * 0.822;
    var zs = clamp(minDim * 0.026, 8, 13);
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(zx, zy + zs * 0.35, zs * 1.65, zs * 0.72, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2.5, zs * 0.32);
    ctx.beginPath();
    ctx.ellipse(zx, zy - zs * 0.25, zs * 0.78, zs * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(zx, zy - zs * 0.25, Math.max(1.5, zs * 0.16), 0, Math.PI * 2);
    ctx.fill();

    var ax = cw * 0.10;
    var ay = ch * 0.90;
    var as = clamp(minDim * 0.028, 8.5, 13);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(-0.22);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.88)';
    roundRectPath(ctx, -as * 1.8, -as * 0.55, as * 3.6, as * 1.1, 4);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.fillRect(-as * 1.5, -as * 0.26, as * 3.0, as * 0.52);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.moveTo(as * 0.9 + 1.5, 2);
    ctx.lineTo(-as * 0.2 + 1.5, -as * 0.85 + 2);
    ctx.lineTo(-as * 0.45 + 1.5, -as * 0.85 + 2);
    ctx.lineTo(as * 0.05 + 1.5, 2);
    ctx.lineTo(-as * 0.45 + 1.5, as * 0.85 + 2);
    ctx.lineTo(-as * 0.2 + 1.5, as * 0.85 + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(as * 0.95, 0);
    ctx.lineTo(as * 0.35, -as * 0.16);
    ctx.lineTo(-as * 0.2, -as * 0.88);
    ctx.lineTo(-as * 0.48, -as * 0.88);
    ctx.lineTo(-as * 0.12, -as * 0.16);
    ctx.lineTo(-as * 0.68, -as * 0.13);
    ctx.lineTo(-as * 0.92, -as * 0.44);
    ctx.lineTo(-as * 1.06, -as * 0.44);
    ctx.lineTo(-as * 0.9, 0);
    ctx.lineTo(-as * 1.06, as * 0.44);
    ctx.lineTo(-as * 0.92, as * 0.44);
    ctx.lineTo(-as * 0.68, as * 0.13);
    ctx.lineTo(-as * 0.12, as * 0.16);
    ctx.lineTo(-as * 0.48, as * 0.88);
    ctx.lineTo(-as * 0.2, as * 0.88);
    ctx.lineTo(as * 0.35, as * 0.16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2f7cf6';
    ctx.fillRect(-as * 0.92, -as * 0.08, as * 0.32, as * 0.16);

    ctx.restore();
    ctx.restore();
  }

  function drawMapHaze(ctx, cw, ch, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(226, 217, 204, 0.14)';
    ctx.fillRect(0, 0, cw, ch);

    for (var i = 0; i < 3; i++) {
      var bandY = ch * (0.24 + i * 0.24);
      var bandH = ch * 0.16;
      var drift = Math.sin(t * 0.00032 + i * 2.1) * cw * 0.05;
      var grad = ctx.createLinearGradient(0, bandY - bandH * 0.5, 0, bandY + bandH * 0.5);
      grad.addColorStop(0, 'rgba(222, 214, 202, 0)');
      grad.addColorStop(0.5, 'rgba(222, 214, 202, 0.18)');
      grad.addColorStop(1, 'rgba(222, 214, 202, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(drift - cw * 0.08, bandY - bandH * 0.5, cw * 1.16, bandH);
    }
    ctx.restore();
  }

  function drawTopDownCar(ctx, x, y, angle, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    var len = 18 * scale;
    var wid = 10 * scale;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    roundRectPath(ctx, -len * 0.5 + 1.5, -wid * 0.5 + 2, len, wid, 3.5 * scale);
    ctx.fill();

    roundRectPath(ctx, -len * 0.5, -wid * 0.5, len, wid, 3.2 * scale);
    ctx.fillStyle = '#2f7cf6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.2, 1.4 * scale);
    ctx.stroke();

    roundRectPath(ctx, -len * 0.26, -wid * 0.36, len * 0.52, wid * 0.72, 2 * scale);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    roundRectPath(ctx, -len * 0.14, -wid * 0.31, len * 0.28, wid * 0.62, 1.5 * scale);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(len * 0.41, -wid * 0.34, len * 0.09, wid * 0.2);
    ctx.fillRect(len * 0.41, wid * 0.14, len * 0.09, wid * 0.2);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-len * 0.5, -wid * 0.34, len * 0.07, wid * 0.2);
    ctx.fillRect(-len * 0.5, wid * 0.14, len * 0.07, wid * 0.2);

    ctx.restore();
  }

  function map(ctx, cw, ch, levels, from, to, p, lang, now) {
    if (!ctx || cw <= 0 || ch <= 0) return;
    var t = (typeof now === 'number' && isFinite(now)) ? now : 0;
    var minDim = Math.min(cw, ch);
    var activeLang = lang === 'mn' ? 'mn' : 'en';

    ctx.save();

    var bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#e8eef4');
    bg.addColorStop(0.55, '#f2f5f9');
    bg.addColorStop(1, '#e1e8f0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    drawMapGerHills(ctx, cw, ch, minDim, t);
    drawMapCityBlocks(ctx, cw, ch, minDim);
    drawMapRivers(ctx, cw, ch, minDim);
    drawMapRailway(ctx, cw, ch, minDim);
    drawMapRoads(ctx, cw, ch, minDim, activeLang);
    drawMapPowerPlant(ctx, cw, ch, minDim, t);
    drawMapBogdKhanAndLandmarks(ctx, cw, ch, minDim);
    drawMapHaze(ctx, cw, ch, t);

    if (!levels || !levels.length) {
      ctx.restore();
      return;
    }

    var safeTo = clamp(typeof to === 'number' ? to : 0, 0, levels.length - 1);
    var safeFrom = typeof from === 'number' ? from : -1;

    if (levels.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var s = 0; s < levels.length - 1; s++) {
        var a = levels[s].map;
        var b = levels[s + 1].map;
        ctx.beginPath();
        ctx.moveTo(a.x * cw, a.y * ch);
        ctx.lineTo(b.x * cw, b.y * ch);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = Math.max(4, minDim * 0.012);
        ctx.setLineDash([7, 6]);
        ctx.stroke();

        ctx.strokeStyle = s < safeFrom ? '#16a34a' : '#334155';
        ctx.lineWidth = Math.max(2.2, minDim * 0.0065);
        ctx.setLineDash([7, 6]);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    var pinR = clamp(minDim * 0.032, 10, 15);
    var pinFont = Math.round(pinR * 1.05);
    ctx.font = '700 ' + pinFont + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (var i = 0; i < levels.length; i++) {
      var lv = levels[i];
      var px = lv.map.x * cw;
      var py = lv.map.y * ch;
      var isTarget = i === safeTo;
      var isVisited = i <= safeFrom;

      if (isTarget) {
        var pulse = (t * 0.0012) % 1;
        var ringR = pinR * (1.15 + pulse * 1.05);
        ctx.strokeStyle = 'rgba(245, 158, 11, ' + ((1 - pulse) * 0.72).toFixed(3) + ')';
        ctx.lineWidth = Math.max(2, pinR * 0.25);
        ctx.beginPath();
        ctx.arc(px, py, ringR, 0, Math.PI * 2);
        ctx.stroke();

        var glow = 0.5 + 0.5 * Math.sin(t * 0.006);
        ctx.fillStyle = 'rgba(245, 158, 11, ' + (0.2 + glow * 0.16).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, pinR * 1.38, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.beginPath();
      ctx.arc(px + 1, py + 2, pinR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, isTarget ? pinR * 1.08 : pinR, 0, Math.PI * 2);
      if (isTarget) {
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
      } else if (isVisited) {
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = (isTarget || isVisited) ? '#ffffff' : '#0f172a';
      ctx.fillText(String(i + 1), px, py + 0.5);
    }

    var pc = clamp(typeof p === 'number' && isFinite(p) ? p : 0, 0, 1);
    var ease = pc < 0.5 ? 2 * pc * pc : 1 - Math.pow(-2 * pc + 2, 2) / 2;
    var tx = levels[safeTo].map.x * cw;
    var ty = levels[safeTo].map.y * ch;
    var carX = tx;
    var carY = ty;
    var carAngle = 0;

    if (safeFrom >= 0 && safeFrom < levels.length && safeFrom !== safeTo) {
      var fx = levels[safeFrom].map.x * cw;
      var fy = levels[safeFrom].map.y * ch;
      carX = fx + (tx - fx) * ease;
      carY = fy + (ty - fy) * ease;
      carAngle = Math.atan2(ty - fy, tx - fx);
    } else if (safeTo + 1 < levels.length) {
      var nx = levels[safeTo + 1].map.x * cw;
      var ny = levels[safeTo + 1].map.y * ch;
      carAngle = Math.atan2(ny - ty, nx - tx);
    }

    drawTopDownCar(ctx, carX, carY, carAngle, clamp(pinR / 13, 0.85, 1.2));

    var targetLv = levels[safeTo];
    var targetName = targetLv && targetLv.name ? (targetLv.name[activeLang] || targetLv.name.en || targetLv.name.mn || '') : '';
    if (targetName) {
      var chipFont = Math.round(clamp(minDim * 0.034, 12, 15));
      ctx.font = '700 ' + chipFont + 'px ' + FONT;
      var textW = ctx.measureText(targetName).width;
      var padX = 11;
      var padY = 6;
      var chipW = textW + padX * 2;
      var chipH = chipFont + padY * 2;
      var chipX = clamp(tx - chipW * 0.5, 8, cw - chipW - 8);
      var aboveY = ty - pinR - 12 - chipH;
      var belowY = ty + pinR + 12;
      var chipY = aboveY >= 8 ? aboveY : clamp(belowY, 8, ch - chipH - 8);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
      roundRectPath(ctx, chipX + 1, chipY + 2.5, chipW, chipH, chipH * 0.5);
      ctx.fill();

      roundRectPath(ctx, chipX, chipY, chipW, chipH, chipH * 0.5);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(targetName, chipX + chipW * 0.5, chipY + chipH * 0.5 + 0.5);
    }

    ctx.restore();
  }

  var UBArtMap = {
    backdrop: backdrop,
    map: map
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = UBArtMap;
  else root.UBArtMap = UBArtMap;
})(this);
