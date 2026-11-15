(function (root) {
  var DEFAULT_COLORS = ['#2f7cf6', '#ef4444', '#22c55e', '#f59e0b'];
  var DEFAULT_K = { GRASS: 0, RIVER: 1, RAIL: 2, BLOCK: 3, SRC: 4, DST: 5 };
  var EMPTY_DASH = [];

  function getSim() {
    if (root && root.Sim) return root.Sim;
    if (typeof window !== 'undefined' && window.Sim) return window.Sim;
    if (typeof global !== 'undefined' && global.Sim) return global.Sim;
    return null;
  }

  function getColors() {
    var u = (root && root.UBLevels) || (typeof window !== 'undefined' && window.UBLevels) || (typeof global !== 'undefined' && global.UBLevels);
    return (u && u.COLORS) ? u.COLORS : DEFAULT_COLORS;
  }

  function resolveColor(color, colors, fallback) {
    if (typeof color === 'number') return colors[color] || fallback || colors[0];
    if (typeof color === 'string' && color.length > 0) return color;
    return fallback || colors[0];
  }

  function hashTile(i) {
    var n = (i * 2654435761) >>> 0;
    n = ((n ^ (n >>> 16)) * 2246822507) >>> 0;
    return (n ^ (n >>> 13)) >>> 0;
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

  var Render = {
    create: function (canvas) {
      var ctx = canvas.getContext('2d');
      var dpr = 1;
      var cw = 390;
      var ch = 700;
      var gw = 9;
      var gh = 14;
      var ts = 38;
      var ox = 6;
      var oy = 6;
      var lastLang = 'mn';
      var effects = [];
      var dashRoad = [6, 6];
      var dashRoute = [7, 6];

      function computeFit() {
        var availW = Math.max(32, cw - 12);
        var availH = Math.max(32, ch - 12);
        ts = Math.max(8, Math.floor(Math.min(availW / gw, availH / gh)));
        ox = Math.floor((cw - ts * gw) * 0.5);
        oy = Math.floor((ch - ts * gh) * 0.5);
        dashRoad[0] = Math.max(2, ts * 0.14);
        dashRoad[1] = Math.max(2, ts * 0.14);
      }

      function resize() {
        dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1);
        var rectW = canvas.clientWidth;
        var rectH = canvas.clientHeight;
        if ((!rectW || !rectH) && canvas.getBoundingClientRect) {
          var rect = canvas.getBoundingClientRect();
          rectW = rect.width;
          rectH = rect.height;
        }
        cw = rectW || canvas.width || 390;
        ch = rectH || canvas.height || 700;
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        computeFit();
      }

      function fit(world) {
        var sim = getSim();
        gw = (world && world.w) || (sim && sim.W) || 9;
        gh = (world && world.h) || (sim && sim.H) || 14;
        if (canvas.clientWidth && canvas.clientHeight && (canvas.clientWidth !== cw || canvas.clientHeight !== ch)) {
          resize();
        } else {
          computeFit();
        }
      }

      function tileAt(clientX, clientY) {
        if (!canvas.getBoundingClientRect || ts <= 0) return -1;
        var rect = canvas.getBoundingClientRect();
        var x = clientX - rect.left - ox;
        var y = clientY - rect.top - oy;
        var tx = Math.floor(x / ts);
        var ty = Math.floor(y / ts);
        if (tx < 0 || tx >= gw || ty < 0 || ty >= gh) return -1;
        return ty * gw + tx;
      }

      function effect(type, tile, color) {
        if (effects.length >= 32) effects.shift();
        effects.push({
          type: type,
          tile: typeof tile === 'number' ? tile : -1,
          color: color,
          born: null
        });
      }

      function drawGrassTile(i, x, y) {
        var tx = i % gw;
        var ty = (i / gw) | 0;
        ctx.fillStyle = ((tx + ty) & 1) === 0 ? '#86d468' : '#7ec960';
        ctx.fillRect(x, y, ts + 0.5, ts + 0.5);
        var h = hashTile(i);
        ctx.fillStyle = '#65b349';
        var r = Math.max(1.2, ts * 0.042);
        var x1 = x + ((h & 15) / 16) * (ts * 0.65) + ts * 0.16;
        var y1 = y + (((h >>> 4) & 15) / 16) * (ts * 0.65) + ts * 0.16;
        var x2 = x + (((h >>> 8) & 15) / 16) * (ts * 0.65) + ts * 0.18;
        var y2 = y + (((h >>> 12) & 15) / 16) * (ts * 0.65) + ts * 0.18;
        ctx.beginPath();
        ctx.arc(x1, y1, r, 0, Math.PI * 2);
        ctx.arc(x2, y2, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      function drawRiverTile(world, K, i, x, y, now, waterGlow) {
        var tx = i % gw;
        var ty = (i / gw) | 0;
        ctx.fillStyle = '#2684e0';
        ctx.fillRect(x, y, ts + 0.5, ts + 0.5);

        var upRiver = ty > 0 && world.kind[i - gw] === K.RIVER;
        var dnRiver = ty < gh - 1 && world.kind[i + gw] === K.RIVER;
        var lfRiver = tx > 0 && world.kind[i - 1] === K.RIVER;
        var rtRiver = tx < gw - 1 && world.kind[i + 1] === K.RIVER;
        var bank = Math.max(2, ts * 0.08);
        ctx.fillStyle = '#5ab082';
        if (!upRiver) ctx.fillRect(x, y, ts + 0.5, bank);
        if (!dnRiver) ctx.fillRect(x, y + ts - bank, ts + 0.5, bank);
        if (!lfRiver) ctx.fillRect(x, y, bank, ts + 0.5);
        if (!rtRiver) ctx.fillRect(x + ts - bank, y, bank, ts + 0.5);

        ctx.strokeStyle = '#7ec8ff';
        ctx.lineWidth = Math.max(1.4, ts * 0.055);
        ctx.lineCap = 'round';
        var phase = now * 0.003 + tx * 0.85 + ty * 1.3;
        for (var row = 0; row < 2; row++) {
          var wy = y + ts * (0.34 + row * 0.32) + Math.sin(phase + row * 1.9) * (ts * 0.05);
          var wx = x + ts * 0.18 + Math.cos(phase * 0.8 + row * 2.1) * (ts * 0.06);
          var wlen = ts * 0.48;
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.quadraticCurveTo(wx + wlen * 0.5, wy - ts * 0.07, wx + wlen, wy);
          ctx.stroke();
        }

        if (waterGlow > 0) {
          var alpha = Math.max(0, Math.min(1, waterGlow));
          ctx.save();
          ctx.globalAlpha = alpha * (0.55 + 0.25 * Math.sin(now * 0.012));
          ctx.fillStyle = '#9be7ff';
          ctx.fillRect(x, y, ts, ts);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1.5, ts * 0.06);
          ctx.strokeRect(x + ts * 0.06, y + ts * 0.06, ts * 0.88, ts * 0.88);
          ctx.restore();
        }
      }

      function drawRailTile(world, K, i, x, y) {
        var tx = i % gw;
        var ty = (i / gw) | 0;
        var vert = (ty > 0 && world.kind[i - gw] === K.RAIL) || (ty < gh - 1 && world.kind[i + gw] === K.RAIL);
        var horiz = (tx > 0 && world.kind[i - 1] === K.RAIL) || (tx < gw - 1 && world.kind[i + 1] === K.RAIL);
        var isVert = vert && !horiz;

        ctx.fillStyle = '#8b949e';
        if (isVert) {
          ctx.fillRect(x + ts * 0.2, y, ts * 0.6, ts + 0.5);
        } else {
          ctx.fillRect(x, y + ts * 0.2, ts + 0.5, ts * 0.6);
        }

        ctx.fillStyle = '#633d24';
        var tieCount = 4;
        for (var t = 0; t < tieCount; t++) {
          var offset = (t + 0.5) * (ts / tieCount);
          if (isVert) {
            ctx.fillRect(x + ts * 0.24, y + offset - ts * 0.04, ts * 0.52, ts * 0.08);
          } else {
            ctx.fillRect(x + offset - ts * 0.04, y + ts * 0.24, ts * 0.08, ts * 0.52);
          }
        }

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = Math.max(1.5, ts * 0.055);
        ctx.beginPath();
        if (isVert) {
          ctx.moveTo(x + ts * 0.35, y);
          ctx.lineTo(x + ts * 0.35, y + ts);
          ctx.moveTo(x + ts * 0.65, y);
          ctx.lineTo(x + ts * 0.65, y + ts);
        } else {
          ctx.moveTo(x, y + ts * 0.35);
          ctx.lineTo(x + ts, y + ts * 0.35);
          ctx.moveTo(x, y + ts * 0.65);
          ctx.lineTo(x + ts, y + ts * 0.65);
        }
        ctx.stroke();
      }

      function drawBlockTile(i, x, y) {
        var h = hashTile(i);
        var variant = h % 3;
        var cx = x + ts * 0.5;
        var cy = y + ts * 0.5;
        if (variant === 0) {
          ctx.fillStyle = 'rgba(20, 40, 15, 0.16)';
          ctx.beginPath();
          ctx.ellipse(cx + ts * 0.04, cy + ts * 0.06, ts * 0.42, ts * 0.36, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#53963f';
          ctx.beginPath();
          ctx.ellipse(cx, cy + ts * 0.02, ts * 0.41, ts * 0.35, -0.15, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#6cb054';
          ctx.beginPath();
          ctx.ellipse(cx - ts * 0.04, cy - ts * 0.03, ts * 0.29, ts * 0.24, -0.15, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#968772';
          ctx.beginPath();
          ctx.ellipse(cx - ts * 0.06, cy - ts * 0.07, ts * 0.14, ts * 0.1, 0.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          var pad = ts * 0.14;
          var bw = ts - pad * 2;
          var bh = ts - pad * 2;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
          roundRectPath(ctx, x + pad + ts * 0.05, y + pad + ts * 0.06, bw, bh, ts * 0.1);
          ctx.fill();

          ctx.fillStyle = '#dfd8cc';
          roundRectPath(ctx, x + pad, y + pad, bw, bh, ts * 0.1);
          ctx.fill();

          var roofs = ['#c85a3c', '#547aa5', '#7c6d61', '#b56c49'];
          ctx.fillStyle = roofs[(h >>> 4) & 3];
          roundRectPath(ctx, x + pad + ts * 0.05, y + pad + ts * 0.05, bw - ts * 0.1, bh - ts * 0.1, ts * 0.07);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(x + pad + ts * 0.12, y + pad + ts * 0.12, bw * 0.28, bh * 0.18);
        }
      }

      function drawGroundRoads(world, sim) {
        var total = gw * gh;
        var hasIsRoad = sim && typeof sim.isRoad === 'function';
        var hasIsJunction = sim && typeof sim.isJunction === 'function';
        var curbW = ts * 0.68;
        var roadW = ts * 0.62;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.strokeStyle = '#252b36';
        ctx.lineWidth = curbW;
        ctx.beginPath();
        if (world.edges && world.edges.forEach) {
          world.edges.forEach(function (e) {
            var ax = ox + ((e.a % gw) + 0.5) * ts;
            var ay = oy + (((e.a / gw) | 0) + 0.5) * ts;
            var bx = ox + ((e.b % gw) + 0.5) * ts;
            var by = oy + (((e.b / gw) | 0) + 0.5) * ts;
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
          });
        }
        ctx.stroke();

        for (var i = 0; i < total; i++) {
          var isR = hasIsRoad ? sim.isRoad(world, i) : (world.prebuilt && world.prebuilt[i] === 1);
          if (isR) {
            var rx = ox + ((i % gw) + 0.5) * ts;
            var ry = oy + (((i / gw) | 0) + 0.5) * ts;
            ctx.fillStyle = (world.prebuilt && world.prebuilt[i]) ? '#556070' : '#3d4452';
            ctx.beginPath();
            ctx.arc(rx, ry, roadW * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (world.edges && world.edges.forEach) {
          ctx.lineWidth = roadW;
          ctx.strokeStyle = '#3d4452';
          ctx.beginPath();
          world.edges.forEach(function (e) {
            if (e.prebuilt) return;
            var ax = ox + ((e.a % gw) + 0.5) * ts;
            var ay = oy + (((e.a / gw) | 0) + 0.5) * ts;
            var bx = ox + ((e.b % gw) + 0.5) * ts;
            var by = oy + (((e.b / gw) | 0) + 0.5) * ts;
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
          });
          ctx.stroke();

          ctx.strokeStyle = '#556070';
          ctx.beginPath();
          world.edges.forEach(function (e) {
            if (!e.prebuilt) return;
            var ax = ox + ((e.a % gw) + 0.5) * ts;
            var ay = oy + (((e.a / gw) | 0) + 0.5) * ts;
            var bx = ox + ((e.b % gw) + 0.5) * ts;
            var by = oy + (((e.b / gw) | 0) + 0.5) * ts;
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
          });
          ctx.stroke();

          ctx.save();
          ctx.strokeStyle = 'rgba(241, 245, 249, 0.55)';
          ctx.lineWidth = Math.max(1.2, ts * 0.05);
          ctx.setLineDash(dashRoad);
          ctx.beginPath();
          world.edges.forEach(function (e) {
            var ax = ox + ((e.a % gw) + 0.5) * ts;
            var ay = oy + (((e.a / gw) | 0) + 0.5) * ts;
            var bx = ox + ((e.b % gw) + 0.5) * ts;
            var by = oy + (((e.b / gw) | 0) + 0.5) * ts;
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
          });
          ctx.stroke();
          ctx.setLineDash(EMPTY_DASH);
          ctx.restore();
        }

        if (hasIsJunction) {
          for (var j = 0; j < total; j++) {
            if (sim.isJunction(world, j)) {
              var jx = ox + ((j % gw) + 0.5) * ts;
              var jy = oy + (((j / gw) | 0) + 0.5) * ts;
              var box = ts * 0.38;
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
              ctx.lineWidth = Math.max(1, ts * 0.04);
              ctx.strokeRect(jx - box * 0.5, jy - box * 0.5, box, box);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
              var stripeL = ts * 0.09;
              var stripeW = ts * 0.038;
              for (var s = -1; s <= 1; s++) {
                var off = s * ts * 0.09;
                ctx.fillRect(jx + off - stripeW * 0.5, jy - box * 0.5 - stripeL, stripeW, stripeL * 0.8);
                ctx.fillRect(jx + off - stripeW * 0.5, jy + box * 0.5 + stripeL * 0.2, stripeW, stripeL * 0.8);
                ctx.fillRect(jx - box * 0.5 - stripeL, jy + off - stripeW * 0.5, stripeL * 0.8, stripeW);
                ctx.fillRect(jx + box * 0.5 + stripeL * 0.2, jy + off - stripeW * 0.5, stripeL * 0.8, stripeW);
              }
            }
          }
        }
      }

      function drawEndpoints(world, K, colors, now) {
        var sourceByTile = {};
        if (world.sources) {
          for (var s = 0; s < world.sources.length; s++) {
            var srcObj = world.sources[s];
            sourceByTile[srcObj.tile] = srcObj;
          }
        }

        var total = gw * gh;
        for (var i = 0; i < total; i++) {
          var kind = world.kind[i];
          if (kind !== K.SRC && kind !== K.DST) continue;
          var tx = i % gw;
          var ty = (i / gw) | 0;
          var x = ox + tx * ts;
          var y = oy + ty * ts;
          var cx = x + ts * 0.5;
          var cy = y + ts * 0.5;
          var cIdx = world.color ? world.color[i] : 0;
          var col = resolveColor(cIdx, colors, '#2f7cf6');

          if (kind === K.SRC) {
            var src = sourceByTile[i];
            var queue = src ? (src.queue || 0) : 0;
            var fullFor = src ? (src.fullFor || 0) : 0;

            if (fullFor > 0) {
              var pulse = 0.5 + 0.5 * Math.sin(now * 0.018);
              ctx.save();
              ctx.fillStyle = 'rgba(239, 68, 68, ' + (0.28 + pulse * 0.38) + ')';
              roundRectPath(ctx, x - ts * 0.06, y - ts * 0.06, ts * 1.12, ts * 1.12, ts * 0.2);
              ctx.fill();
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = Math.max(2, ts * 0.07);
              ctx.stroke();
              ctx.restore();
            }

            var isGer = ((i + Math.max(0, cIdx)) & 1) === 1;
            if (isGer) {
              ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
              ctx.beginPath();
              ctx.arc(cx + ts * 0.04, cy + ts * 0.08, ts * 0.36, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#f8fafc';
              ctx.strokeStyle = col;
              ctx.lineWidth = Math.max(2, ts * 0.07);
              ctx.beginPath();
              ctx.arc(cx, cy + ts * 0.04, ts * 0.35, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = col;
              ctx.beginPath();
              ctx.arc(cx, cy + ts * 0.04, ts * 0.14, 0, Math.PI * 2);
              ctx.fill();
            } else {
              var bx = x + ts * 0.12;
              var by = y + ts * 0.18;
              var bw = ts * 0.76;
              var bh = ts * 0.7;
              ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
              roundRectPath(ctx, bx + ts * 0.04, by + ts * 0.05, bw, bh, ts * 0.14);
              ctx.fill();

              ctx.fillStyle = col;
              roundRectPath(ctx, bx, by, bw, bh, ts * 0.14);
              ctx.fill();

              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = Math.max(1.5, ts * 0.05);
              ctx.stroke();

              ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
              var ww = bw * 0.22;
              var wh = bh * 0.22;
              ctx.fillRect(bx + bw * 0.2, by + bh * 0.22, ww, wh);
              ctx.fillRect(bx + bw * 0.58, by + bh * 0.22, ww, wh);
              ctx.fillRect(bx + bw * 0.2, by + bh * 0.56, ww, wh);
              ctx.fillRect(bx + bw * 0.58, by + bh * 0.56, ww, wh);
            }

            var barW = ts * 0.84;
            var barH = ts * 0.18;
            var barX = cx - barW * 0.5;
            var barY = y + ts * 0.01;
            ctx.fillStyle = fullFor > 0 ? '#991b1b' : 'rgba(15, 23, 42, 0.78)';
            roundRectPath(ctx, barX, barY, barW, barH, barH * 0.5);
            ctx.fill();

            var dotR = Math.max(1.6, ts * 0.048);
            var stepX = barW / 5;
            for (var q = 0; q < 5; q++) {
              var dx = barX + stepX * (q + 0.5);
              var dy = barY + barH * 0.5;
              ctx.fillStyle = q < queue ? (fullFor > 0 ? '#fecaca' : col) : 'rgba(255, 255, 255, 0.25)';
              ctx.beginPath();
              ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
              ctx.fill();
              if (q < queue) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
              }
            }
          } else {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
            roundRectPath(ctx, x + ts * 0.16, y + ts * 0.18, ts * 0.72, ts * 0.72, ts * 0.18);
            ctx.fill();

            ctx.fillStyle = col;
            roundRectPath(ctx, x + ts * 0.12, y + ts * 0.12, ts * 0.76, ts * 0.76, ts * 0.18);
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1.6, ts * 0.055);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.beginPath();
            ctx.arc(cx, cy + ts * 0.04, ts * 0.22, 0, Math.PI * 2);
            ctx.fill();

            var poleX = cx - ts * 0.1;
            var poleBot = cy + ts * 0.22;
            var poleTop = cy - ts * 0.24;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1.5, ts * 0.055);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(poleX, poleBot);
            ctx.lineTo(poleX, poleTop);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(poleX, poleTop);
            ctx.lineTo(poleX + ts * 0.28, poleTop + ts * 0.1);
            ctx.lineTo(poleX, poleTop + ts * 0.2);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      function drawSingleCar(pos, col, isBridge) {
        var cx = ox + pos.x * ts;
        var cy = oy + pos.y * ts;
        var dir = pos.dir || 0;
        var ang = dir * Math.PI * 0.5;
        var scale = isBridge ? 1.12 : 1;
        var len = ts * 0.42 * scale;
        var wid = ts * 0.26 * scale;
        var lane = ts * (isBridge ? 0.055 : 0.075);

        ctx.save();
        ctx.translate(cx, cy);
        if (isBridge) {
          ctx.save();
          ctx.translate(ts * 0.08, ts * 0.1);
          ctx.rotate(ang);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
          roundRectPath(ctx, -len * 0.5, lane - wid * 0.5, len, wid, wid * 0.32);
          ctx.fill();
          ctx.restore();
        }
        ctx.rotate(ang);

        if (!isBridge) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
          roundRectPath(ctx, -len * 0.5 + 1.2, lane - wid * 0.5 + 1.5, len, wid, wid * 0.32);
          ctx.fill();
        }

        ctx.fillStyle = col;
        roundRectPath(ctx, -len * 0.5, lane - wid * 0.5, len, wid, wid * 0.32);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = Math.max(0.9, ts * 0.025);
        ctx.stroke();

        ctx.fillStyle = '#1e293b';
        roundRectPath(ctx, len * 0.02, lane - wid * 0.36, len * 0.3, wid * 0.72, wid * 0.16);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        roundRectPath(ctx, -len * 0.34, lane - wid * 0.32, len * 0.28, wid * 0.64, wid * 0.14);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.fillRect(len * 0.42, lane - wid * 0.36, len * 0.08, wid * 0.18);
        ctx.fillRect(len * 0.42, lane + wid * 0.18, len * 0.08, wid * 0.18);

        ctx.restore();
      }

      function drawCarsLayer(world, sim, colors, targetLayer) {
        if (!world.cars || !sim || typeof sim.carPos !== 'function') return;
        for (var i = 0; i < world.cars.length; i++) {
          var car = world.cars[i];
          var pos = sim.carPos(world, car);
          if (!pos || pos.layer !== targetLayer) continue;
          var col = resolveColor(car.color, colors, '#2f7cf6');
          drawSingleCar(pos, col, targetLayer === 1);
        }
      }

      function drawBridges(world) {
        if (!world.bridges || !world.bridges.length) return;
        var deckW = ts * 0.56;
        var railOff = deckW * 0.5;

        for (var i = 0; i < world.bridges.length; i++) {
          var b = world.bridges[i];
          if (!b || !b.tiles || b.tiles.length < 2) continue;
          var s = b.tiles[0];
          var e = b.tiles[b.tiles.length - 1];
          var sx = ox + ((s % gw) + 0.5) * ts;
          var sy = oy + (((s / gw) | 0) + 0.5) * ts;
          var ex = ox + ((e % gw) + 0.5) * ts;
          var ey = oy + (((e / gw) | 0) + 0.5) * ts;
          var dx = ex - sx;
          var dy = ey - sy;
          var len = Math.hypot(dx, dy);
          if (len < 1) continue;
          var ux = dx / len;
          var uy = dy / len;
          var px = -uy;
          var py = ux;

          var shadowDx = ts * 0.12;
          var shadowDy = ts * 0.15;
          var mStartX = sx + ux * ts * 0.32;
          var mStartY = sy + uy * ts * 0.32;
          var mEndX = ex - ux * ts * 0.32;
          var mEndY = ey - uy * ts * 0.32;

          ctx.save();
          ctx.lineCap = 'butt';
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.3)';
          ctx.lineWidth = deckW * 1.05;
          ctx.beginPath();
          ctx.moveTo(mStartX + shadowDx, mStartY + shadowDy);
          ctx.lineTo(mEndX + shadowDx, mEndY + shadowDy);
          ctx.stroke();

          ctx.lineCap = 'round';
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = deckW + ts * 0.08;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.strokeStyle = '#7b8798';
          ctx.lineWidth = deckW;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.lineCap = 'butt';
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = deckW * 0.92;
          ctx.beginPath();
          ctx.moveTo(mStartX, mStartY);
          ctx.lineTo(mEndX, mEndY);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = Math.max(1.2, ts * 0.045);
          ctx.beginPath();
          for (var r = 1; r <= 2; r++) {
            var d1 = ts * (0.12 * r);
            ctx.moveTo(sx + ux * d1 - px * deckW * 0.36, sy + uy * d1 - py * deckW * 0.36);
            ctx.lineTo(sx + ux * d1 + px * deckW * 0.36, sy + uy * d1 + py * deckW * 0.36);
            ctx.moveTo(ex - ux * d1 - px * deckW * 0.36, ey - uy * d1 - py * deckW * 0.36);
            ctx.lineTo(ex - ux * d1 + px * deckW * 0.36, ey - uy * d1 + py * deckW * 0.36);
          }
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = Math.max(1.2, ts * 0.048);
          ctx.setLineDash(dashRoad);
          ctx.beginPath();
          ctx.moveTo(sx + ux * ts * 0.25, sy + uy * ts * 0.25);
          ctx.lineTo(ex - ux * ts * 0.25, ey - uy * ts * 0.25);
          ctx.stroke();
          ctx.setLineDash(EMPTY_DASH);

          var rStartX = sx + ux * ts * 0.2;
          var rStartY = sy + uy * ts * 0.2;
          var rEndX = ex - ux * ts * 0.2;
          var rEndY = ey - uy * ts * 0.2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(2, ts * 0.075);
          ctx.beginPath();
          ctx.moveTo(rStartX + px * railOff, rStartY + py * railOff);
          ctx.lineTo(rEndX + px * railOff, rEndY + py * railOff);
          ctx.moveTo(rStartX - px * railOff, rStartY - py * railOff);
          ctx.lineTo(rEndX - px * railOff, rEndY - py * railOff);
          ctx.stroke();

          ctx.fillStyle = '#cbd5e1';
          var postCount = b.tiles.length;
          for (var k = 0; k < postCount; k++) {
            var tk = b.tiles[k];
            var kx = ox + ((tk % gw) + 0.5) * ts;
            var ky = oy + (((tk / gw) | 0) + 0.5) * ts;
            ctx.beginPath();
            ctx.arc(kx + px * railOff, ky + py * railOff, Math.max(1.8, ts * 0.055), 0, Math.PI * 2);
            ctx.arc(kx - px * railOff, ky - py * railOff, Math.max(1.8, ts * 0.055), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      function drawPreview(preview) {
        if (!preview || typeof preview.s !== 'number' || typeof preview.e !== 'number') return;
        if (preview.s < 0 || preview.e < 0) return;
        var sx = ox + ((preview.s % gw) + 0.5) * ts;
        var sy = oy + (((preview.s / gw) | 0) + 0.5) * ts;
        var ex = ox + ((preview.e % gw) + 0.5) * ts;
        var ey = oy + (((preview.e / gw) | 0) + 0.5) * ts;
        var ok = !!preview.ok;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = ok ? 'rgba(34, 197, 94, 0.52)' : 'rgba(239, 68, 68, 0.52)';
        ctx.lineWidth = ts * 0.54;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.strokeStyle = ok ? '#dcfce7' : '#fee2e2';
        ctx.lineWidth = Math.max(2, ts * 0.08);
        ctx.setLineDash(dashRoad);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash(EMPTY_DASH);

        ctx.fillStyle = ok ? '#22c55e' : '#ef4444';
        ctx.beginPath();
        ctx.arc(sx, sy, ts * 0.16, 0, Math.PI * 2);
        ctx.arc(ex, ey, ts * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawEffects(now, colors) {
        for (var i = effects.length - 1; i >= 0; i--) {
          var fx = effects[i];
          if (fx.born === null || now < fx.born) fx.born = now;
          var age = now - fx.born;
          if (age > 700) {
            effects.splice(i, 1);
            continue;
          }
          var p = age / 700;
          var tx = (fx.tile >= 0 && fx.tile < gw * gh) ? (fx.tile % gw) : (gw * 0.5 - 0.5);
          var ty = (fx.tile >= 0 && fx.tile < gw * gh) ? ((fx.tile / gw) | 0) : (gh * 0.5 - 0.5);
          var cx = ox + (tx + 0.5) * ts;
          var cy = oy + (ty + 0.5) * ts;

          ctx.save();
          if (fx.type === 'deliver') {
            var col = resolveColor(fx.color, colors, '#22c55e');
            var alpha = 1 - p;
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(2, ts * 0.08 * (1 - p * 0.5));
            ctx.beginPath();
            ctx.arc(cx, cy, ts * (0.28 + p * 0.65), 0, Math.PI * 2);
            ctx.stroke();

            for (var r = 0; r < 6; r++) {
              var ang = (r / 6) * Math.PI * 2 + p * 0.8;
              var r1 = ts * (0.22 + p * 0.35);
              var r2 = ts * (0.38 + p * 0.55);
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
              ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
              ctx.stroke();
            }

            var fy = cy - ts * 0.25 - p * ts * 0.75;
            ctx.font = '800 ' + Math.round(ts * 0.48) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = Math.max(3, ts * 0.12);
            ctx.strokeStyle = '#ffffff';
            ctx.strokeText('+1', cx, fy);
            ctx.fillStyle = col;
            ctx.fillText('+1', cx, fy);
          } else if (fx.type === 'penalty') {
            if (age < 320) {
              ctx.fillStyle = 'rgba(239, 68, 68, ' + ((1 - age / 320) * 0.22) + ')';
              ctx.fillRect(ox, oy, ts * gw, ts * gh);
            }
            var pAlpha = 1 - p;
            ctx.globalAlpha = pAlpha;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = Math.max(2.2, ts * 0.08);
            ctx.beginPath();
            ctx.arc(cx, cy, ts * (0.3 + p * 0.7), 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = Math.max(2, ts * 0.065);
            ctx.lineCap = 'round';
            for (var h = 0; h < 8; h++) {
              var hang = (h / 8) * Math.PI * 2 + 0.35;
              var hr1 = ts * (0.35 + p * 0.25);
              var hr2 = ts * (0.62 + p * 0.45);
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(hang) * hr1, cy + Math.sin(hang) * hr1);
              ctx.lineTo(cx + Math.cos(hang) * hr2, cy + Math.sin(hang) * hr2);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }

      function draw(world, view) {
        if (!world) return;
        view = view || {};
        if (view.lang === 'mn' || view.lang === 'en') lastLang = view.lang;
        var now = typeof view.now === 'number' ? view.now : (typeof performance !== 'undefined' ? performance.now() : Date.now());
        var waterGlow = view.waterGlow || 0;

        if (world.w && world.h && (world.w !== gw || world.h !== gh)) {
          fit(world);
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = '#dce8d4';
        ctx.fillRect(0, 0, cw, ch);

        var shakeX = 0;
        var shakeY = 0;
        for (var eIdx = 0; eIdx < effects.length; eIdx++) {
          var fx = effects[eIdx];
          if (fx.type === 'penalty') {
            var age = fx.born === null ? 0 : (now - fx.born);
            if (age >= 0 && age < 360) {
              var mag = (1 - age / 360) * Math.max(2, ts * 0.11);
              shakeX = Math.sin(age * 0.085) * mag;
              shakeY = Math.cos(age * 0.11) * mag * 0.6;
              break;
            }
          }
        }

        var baseOx = ox;
        var baseOy = oy;
        ox = baseOx + shakeX;
        oy = baseOy + shakeY;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
        roundRectPath(ctx, ox - 3, oy - 2, ts * gw + 6, ts * gh + 7, 10);
        ctx.fill();

        var sim = getSim();
        var K = (sim && sim.K) ? sim.K : DEFAULT_K;
        var colors = getColors();

        ctx.save();
        roundRectPath(ctx, ox, oy, ts * gw, ts * gh, 8);
        ctx.clip();

        var total = gw * gh;
        for (var i = 0; i < total; i++) {
          var tx = i % gw;
          var ty = (i / gw) | 0;
          var x = ox + tx * ts;
          var y = oy + ty * ts;
          var kind = world.kind[i];
          if (kind === K.RIVER) {
            drawRiverTile(world, K, i, x, y, now, waterGlow);
          } else {
            drawGrassTile(i, x, y);
            if (kind === K.RAIL) {
              drawRailTile(world, K, i, x, y);
            } else if (kind === K.BLOCK) {
              drawBlockTile(i, x, y);
            }
          }
        }

        drawGroundRoads(world, sim);
        drawEndpoints(world, K, colors, now);
        drawCarsLayer(world, sim, colors, 0);
        drawBridges(world);
        drawCarsLayer(world, sim, colors, 1);
        drawPreview(view.preview);

        ctx.restore();
        drawEffects(now, colors);

        ox = baseOx;
        oy = baseOy;
      }

      function drawTransition(levels, from, to, p) {
        if (!cw || !ch) resize();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);

        var grad = ctx.createLinearGradient(0, 0, 0, ch);
        grad.addColorStop(0, '#bae6fd');
        grad.addColorStop(0.24, '#d9f2d0');
        grad.addColorStop(0.68, '#b8e09e');
        grad.addColorStop(1, '#84b870');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);

        ctx.fillStyle = '#99c993';
        ctx.beginPath();
        ctx.moveTo(0, ch * 0.22);
        ctx.quadraticCurveTo(cw * 0.2, ch * 0.11, cw * 0.42, ch * 0.19);
        ctx.quadraticCurveTo(cw * 0.7, ch * 0.09, cw, ch * 0.18);
        ctx.lineTo(cw, ch * 0.28);
        ctx.lineTo(0, ch * 0.28);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
        var blocks = [
          [0.14, 0.32, 0.14, 0.08],
          [0.32, 0.30, 0.16, 0.09],
          [0.52, 0.31, 0.18, 0.08],
          [0.74, 0.34, 0.13, 0.08],
          [0.18, 0.45, 0.16, 0.09],
          [0.38, 0.44, 0.20, 0.10],
          [0.62, 0.45, 0.18, 0.09],
          [0.24, 0.57, 0.15, 0.06],
          [0.45, 0.57, 0.18, 0.06]
        ];
        for (var b = 0; b < blocks.length; b++) {
          var bl = blocks[b];
          roundRectPath(ctx, bl[0] * cw, bl[1] * ch, bl[2] * cw, bl[3] * ch, 6);
          ctx.fill();
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = Math.max(3, cw * 0.014);
        ctx.beginPath();
        ctx.moveTo(cw * 0.06, ch * 0.42);
        ctx.lineTo(cw * 0.94, ch * 0.42);
        ctx.moveTo(cw * 0.48, ch * 0.24);
        ctx.lineTo(cw * 0.48, ch * 0.64);
        ctx.stroke();

        var ry = ch * 0.69;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = Math.max(18, ch * 0.055);
        ctx.beginPath();
        ctx.moveTo(-20, ry + ch * 0.03);
        ctx.bezierCurveTo(cw * 0.28, ry - ch * 0.04, cw * 0.68, ry + ch * 0.06, cw + 20, ry - ch * 0.02);
        ctx.stroke();

        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = Math.max(12, ch * 0.038);
        ctx.beginPath();
        ctx.moveTo(-20, ry + ch * 0.03);
        ctx.bezierCurveTo(cw * 0.28, ry - ch * 0.04, cw * 0.68, ry + ch * 0.06, cw + 20, ry - ch * 0.02);
        ctx.stroke();

        ctx.fillStyle = '#6b8e4e';
        ctx.beginPath();
        ctx.moveTo(0, ch);
        ctx.lineTo(0, ch * 0.85);
        ctx.quadraticCurveTo(cw * 0.18, ch * 0.74, cw * 0.36, ch * 0.84);
        ctx.quadraticCurveTo(cw * 0.55, ch * 0.71, cw * 0.76, ch * 0.83);
        ctx.quadraticCurveTo(cw * 0.9, ch * 0.75, cw, ch * 0.84);
        ctx.lineTo(cw, ch);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#55753e';
        ctx.beginPath();
        ctx.moveTo(0, ch);
        ctx.lineTo(cw * 0.1, ch * 0.88);
        ctx.quadraticCurveTo(cw * 0.32, ch * 0.77, cw * 0.52, ch * 0.89);
        ctx.quadraticCurveTo(cw * 0.72, ch * 0.76, cw * 0.95, ch * 0.89);
        ctx.lineTo(cw, ch);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#7c6850';
        ctx.beginPath();
        ctx.moveTo(cw * 0.36, ch * 0.84);
        ctx.quadraticCurveTo(cw * 0.55, ch * 0.72, cw * 0.66, ch * 0.82);
        ctx.lineTo(cw * 0.45, ch * 0.86);
        ctx.closePath();
        ctx.fill();

        if (!levels || !levels.length) return;
        var toIdx = (typeof to === 'number' && to >= 0 && to < levels.length) ? to : 0;
        var fromIdx = (typeof from === 'number' && from >= 0 && from < levels.length) ? from : -1;
        var clampedP = typeof p === 'number' ? (p < 0 ? 0 : (p > 1 ? 1 : p)) : 1;
        var ease = clampedP < 0.5 ? 2 * clampedP * clampedP : 1 - Math.pow(-2 * clampedP + 2, 2) * 0.5;

        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (var i = 0; i < levels.length; i++) {
          var mp = levels[i].map || { x: 0.5, y: 0.5 };
          var px = mp.x * cw;
          var py = mp.y * ch;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.setLineDash(dashRoute);
        ctx.stroke();
        ctx.setLineDash(EMPTY_DASH);
        ctx.restore();

        var pinR = Math.max(9, Math.min(cw, ch) * 0.028);
        for (var k = 0; k < levels.length; k++) {
          var lmap = levels[k].map || { x: 0.5, y: 0.5 };
          var kx = lmap.x * cw;
          var ky = lmap.y * ch;
          var visited = (fromIdx >= 0 && k <= fromIdx) || (fromIdx < 0 && k <= toIdx) || (k === toIdx && clampedP >= 0.98);
          var isTarget = k === toIdx;

          if (isTarget) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
            ctx.beginPath();
            ctx.arc(kx, ky, pinR * 1.75, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = visited ? '#22c55e' : (isTarget ? '#ef4444' : '#ffffff');
          ctx.strokeStyle = isTarget ? '#b91c1c' : (visited ? '#15803d' : '#475569');
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(kx, ky, pinR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = (visited || isTarget) ? '#ffffff' : '#334155';
          ctx.font = '700 ' + Math.round(pinR * 1.1) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(k + 1), kx, ky + 0.5);
        }

        var dstMap = levels[toIdx].map || { x: 0.5, y: 0.5 };
        var dstX = dstMap.x * cw;
        var dstY = dstMap.y * ch;
        var carX = dstX;
        var carY = dstY;
        var carAng = 0;

        if (fromIdx >= 0 && levels[fromIdx] && levels[fromIdx].map) {
          var srcMap = levels[fromIdx].map;
          var srcX = srcMap.x * cw;
          var srcY = srcMap.y * ch;
          carX = srcX + (dstX - srcX) * ease;
          carY = srcY + (dstY - srcY) * ease;
          if (Math.hypot(dstX - srcX, dstY - srcY) > 1) {
            carAng = Math.atan2(dstY - srcY, dstX - srcX);
          }
        }

        var clen = Math.max(18, pinR * 2.1);
        var cwid = clen * 0.62;
        ctx.save();
        ctx.translate(carX, carY);
        ctx.rotate(carAng);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
        roundRectPath(ctx, -clen * 0.5 + 2, -cwid * 0.5 + 3, clen, cwid, cwid * 0.35);
        ctx.fill();
        ctx.fillStyle = '#2f7cf6';
        roundRectPath(ctx, -clen * 0.5, -cwid * 0.5, clen, cwid, cwid * 0.35);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.fillStyle = '#1e293b';
        roundRectPath(ctx, clen * 0.04, -cwid * 0.35, clen * 0.28, cwid * 0.7, cwid * 0.16);
        ctx.fill();
        ctx.restore();

        var nameObj = levels[toIdx].name || {};
        var title = typeof nameObj === 'string' ? nameObj : (nameObj[lastLang] || nameObj.mn || nameObj.en || '');
        if (title) {
          ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          var textW = ctx.measureText(title).width;
          var pillW = textW + 24;
          var pillH = 30;
          var pillX = Math.max(10, Math.min(cw - pillW - 10, dstX - pillW * 0.5));
          var pillY = dstY - pinR - pillH - 10;
          if (pillY < 12) pillY = dstY + pinR + 10;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
          roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH * 0.5);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(title, pillX + pillW * 0.5, pillY + pillH * 0.5 + 0.5);
        }
      }

      resize();

      return {
        resize: resize,
        fit: fit,
        tileAt: tileAt,
        draw: draw,
        effect: effect,
        clearEffects: function () { effects.length = 0; },
        drawTransition: drawTransition
      };
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Render;
  else root.Render = Render;
})(this);
