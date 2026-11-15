(function (root) {
  var DEFAULT_COLORS = ['#2f7cf6', '#ef4444', '#22c55e', '#f59e0b', '#facc15'];
  var DEFAULT_K = { GRASS: 0, RIVER: 1, RAIL: 2, BLOCK: 3, SRC: 4, DST: 5 };
  var EMPTY_DASH = [];
  var DIR_ANGLES = [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5];
  var DEST_KINDS = {
    work: 'work',
    office: 'office',
    school: 'school',
    market: 'market',
    hospital: 'hospital',
    palace: 'palace',
    store: 'store'
  };
  var PENALTY_PHRASES = {
    mn: ['Дүүт дүүт!', 'Хөдөл л дөө!', 'Яасан түгжрэл вэ!', 'Ажилдаа хоцорлоо!', 'Пийп пийп!'],
    en: ['Honk honk!', 'Move it!', 'What a jam!', "I'm late!", 'Beep beep!']
  };
  var FONT_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  function getGlobal(name) {
    if (root && root[name]) return root[name];
    if (typeof window !== 'undefined' && window[name]) return window[name];
    if (typeof global !== 'undefined' && global[name]) return global[name];
    return null;
  }

  function getSim() {
    return getGlobal('Sim');
  }

  function getLevels() {
    return getGlobal('UBLevels');
  }

  function getArtPlaces() {
    return getGlobal('UBArtPlaces');
  }

  function getArtThings() {
    return getGlobal('UBArtThings');
  }

  function getArtMap() {
    return getGlobal('UBArtMap');
  }

  function getColors() {
    var u = getLevels();
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
      var penaltySeq = 0;
      var dashRoad = [6, 6];
      var dashRoute = [7, 6];
      var lastWorld = null;
      var titlePending = false;
      var titleStart = null;
      var cacheCanvas = null;
      var cacheCtx = null;
      var cacheWorld = null;
      var cacheTs = -1;
      var cacheCw = -1;
      var cacheCh = -1;
      var cacheDpr = -1;
      var regionsWorld = null;
      var cachedRegions = [];

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

      function markWorldChange(world) {
        if (world && world !== lastWorld) {
          lastWorld = world;
          titlePending = true;
          titleStart = null;
        }
      }

      function fit(world) {
        var sim = getSim();
        gw = (world && world.w) || (sim && sim.W) || 9;
        gh = (world && world.h) || (sim && sim.H) || 14;
        markWorldChange(world);
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
        var seq = type === 'penalty' ? penaltySeq++ : 0;
        effects.push({
          type: type,
          tile: typeof tile === 'number' ? tile : -1,
          color: color,
          seq: seq,
          born: null
        });
      }

      function drawSnowTile(c, i, x, y) {
        var tx = i % gw;
        var ty = (i / gw) | 0;
        c.fillStyle = ((tx + ty) & 1) === 0 ? '#eef2f6' : '#eaeff4';
        c.fillRect(x, y, ts + 0.5, ts + 0.5);
        var h = hashTile(i);
        var sx1 = x + ((h & 15) / 16) * (ts * 0.5) + ts * 0.25;
        var sy1 = y + (((h >>> 4) & 15) / 16) * (ts * 0.5) + ts * 0.25;
        c.fillStyle = 'rgba(130, 152, 178, 0.16)';
        c.beginPath();
        c.ellipse(sx1, sy1, ts * 0.24, ts * 0.11, ((h >>> 8) & 7) * 0.2 - 0.7, 0, Math.PI * 2);
        c.fill();
        if ((h & 3) === 0) {
          var sx2 = x + (((h >>> 12) & 15) / 16) * (ts * 0.52) + ts * 0.24;
          var sy2 = y + (((h >>> 16) & 15) / 16) * (ts * 0.52) + ts * 0.24;
          c.fillStyle = 'rgba(255, 255, 255, 0.55)';
          c.beginPath();
          c.ellipse(sx2, sy2, ts * 0.16, ts * 0.08, 0.2, 0, Math.PI * 2);
          c.fill();
        }
      }

      function drawRiverBaseTile(c, world, K, i, x, y) {
        var tx = i % gw;
        var ty = (i / gw) | 0;
        var grad = c.createLinearGradient(x, y, x, y + ts);
        grad.addColorStop(0, '#cfe6f5');
        grad.addColorStop(1, '#b9d9ef');
        c.fillStyle = grad;
        c.fillRect(x, y, ts + 0.5, ts + 0.5);

        var h = hashTile(i);
        c.fillStyle = 'rgba(255, 255, 255, 0.22)';
        c.beginPath();
        c.ellipse(x + ts * (0.3 + ((h & 7) / 16)), y + ts * (0.35 + (((h >>> 3) & 7) / 16)), ts * 0.26, ts * 0.1, -0.2, 0, Math.PI * 2);
        c.fill();

        var cx = x + ts * (0.25 + ((h >>> 6) & 7) * 0.06);
        var cy = y + ts * (0.28 + ((h >>> 9) & 7) * 0.06);
        c.strokeStyle = 'rgba(110, 158, 194, 0.35)';
        c.lineWidth = Math.max(1, ts * 0.032);
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();
        c.moveTo(cx + 0.5, cy + 0.8);
        c.lineTo(cx + ts * 0.22 + 0.5, cy + ts * 0.12 + 0.8);
        c.lineTo(cx + ts * 0.38 + 0.5, cy + ts * 0.05 + 0.8);
        c.moveTo(cx + ts * 0.22 + 0.5, cy + ts * 0.12 + 0.8);
        c.lineTo(cx + ts * 0.3 + 0.5, cy + ts * 0.28 + 0.8);
        c.stroke();

        c.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        c.lineWidth = Math.max(1, ts * 0.028);
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + ts * 0.22, cy + ts * 0.12);
        c.lineTo(cx + ts * 0.38, cy + ts * 0.05);
        c.moveTo(cx + ts * 0.22, cy + ts * 0.12);
        c.lineTo(cx + ts * 0.3, cy + ts * 0.28);
        c.stroke();

        var upRiver = ty > 0 && world.kind[i - gw] === K.RIVER;
        var dnRiver = ty < gh - 1 && world.kind[i + gw] === K.RIVER;
        var lfRiver = tx > 0 && world.kind[i - 1] === K.RIVER;
        var rtRiver = tx < gw - 1 && world.kind[i + 1] === K.RIVER;
        var bank = Math.max(2, ts * 0.1);
        if (!upRiver) {
          c.fillStyle = '#dde7f0';
          c.fillRect(x, y, ts + 0.5, bank);
          c.fillStyle = '#f8fafc';
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + ts, y);
          c.lineTo(x + ts, y + bank * 0.55);
          c.quadraticCurveTo(x + ts * 0.68, y + bank * 1.15, x + ts * 0.45, y + bank * 0.65);
          c.quadraticCurveTo(x + ts * 0.22, y + bank * 0.35, x, y + bank * 0.8);
          c.closePath();
          c.fill();
        }
        if (!dnRiver) {
          c.fillStyle = '#d3e0ec';
          c.fillRect(x, y + ts - bank, ts + 0.5, bank);
          c.fillStyle = '#f8fafc';
          c.beginPath();
          c.moveTo(x, y + ts);
          c.lineTo(x + ts, y + ts);
          c.lineTo(x + ts, y + ts - bank * 0.65);
          c.quadraticCurveTo(x + ts * 0.72, y + ts - bank * 1.1, x + ts * 0.48, y + ts - bank * 0.6);
          c.quadraticCurveTo(x + ts * 0.2, y + ts - bank * 0.35, x, y + ts - bank * 0.85);
          c.closePath();
          c.fill();
        }
        if (!lfRiver) {
          c.fillStyle = '#dde7f0';
          c.fillRect(x, y, bank, ts + 0.5);
          c.fillStyle = '#f8fafc';
          c.fillRect(x, y, bank * 0.65, ts + 0.5);
        }
        if (!rtRiver) {
          c.fillStyle = '#dde7f0';
          c.fillRect(x + ts - bank, y, bank, ts + 0.5);
          c.fillStyle = '#f8fafc';
          c.fillRect(x + ts - bank * 0.65, y, bank * 0.65, ts + 0.5);
        }
      }

      function drawRailTile(c, world, K, i, x, y) {
        var tx = i % gw;
        var ty = (i / gw) | 0;
        var vert = (ty > 0 && world.kind[i - gw] === K.RAIL) || (ty < gh - 1 && world.kind[i + gw] === K.RAIL);
        var horiz = (tx > 0 && world.kind[i - 1] === K.RAIL) || (tx < gw - 1 && world.kind[i + 1] === K.RAIL);
        var isVert = vert && !horiz;
        var h = hashTile(i);

        c.fillStyle = '#8b95a3';
        if (isVert) {
          c.fillRect(x + ts * 0.18, y, ts * 0.64, ts + 0.5);
        } else {
          c.fillRect(x, y + ts * 0.18, ts + 0.5, ts * 0.64);
        }

        c.fillStyle = 'rgba(238, 242, 246, 0.65)';
        for (var p = 0; p < 3; p++) {
          var sOff = ((h >>> (p * 4)) & 7) / 8;
          if (isVert) {
            c.beginPath();
            c.ellipse(x + ts * (0.25 + sOff * 0.5), y + ts * (0.2 + p * 0.3), ts * 0.12, ts * 0.08, 0, 0, Math.PI * 2);
            c.fill();
          } else {
            c.beginPath();
            c.ellipse(x + ts * (0.2 + p * 0.3), y + ts * (0.25 + sOff * 0.5), ts * 0.12, ts * 0.08, 0, 0, Math.PI * 2);
            c.fill();
          }
        }

        var tieCount = 4;
        for (var t = 0; t < tieCount; t++) {
          var offset = (t + 0.5) * (ts / tieCount);
          c.fillStyle = '#6b442a';
          if (isVert) {
            c.fillRect(x + ts * 0.24, y + offset - ts * 0.045, ts * 0.52, ts * 0.09);
            c.fillStyle = 'rgba(255, 255, 255, 0.25)';
            c.fillRect(x + ts * 0.26, y + offset - ts * 0.045, ts * 0.48, ts * 0.025);
          } else {
            c.fillRect(x + offset - ts * 0.045, y + ts * 0.24, ts * 0.09, ts * 0.52);
            c.fillStyle = 'rgba(255, 255, 255, 0.25)';
            c.fillRect(x + offset - ts * 0.045, y + ts * 0.26, ts * 0.025, ts * 0.48);
          }
        }

        c.strokeStyle = '#94a3b8';
        c.lineWidth = Math.max(1.8, ts * 0.065);
        c.beginPath();
        if (isVert) {
          c.moveTo(x + ts * 0.35, y);
          c.lineTo(x + ts * 0.35, y + ts);
          c.moveTo(x + ts * 0.65, y);
          c.lineTo(x + ts * 0.65, y + ts);
        } else {
          c.moveTo(x, y + ts * 0.35);
          c.lineTo(x + ts, y + ts * 0.35);
          c.moveTo(x, y + ts * 0.65);
          c.lineTo(x + ts, y + ts * 0.65);
        }
        c.stroke();

        c.strokeStyle = '#f8fafc';
        c.lineWidth = Math.max(1, ts * 0.025);
        c.beginPath();
        if (isVert) {
          c.moveTo(x + ts * 0.34, y);
          c.lineTo(x + ts * 0.34, y + ts);
          c.moveTo(x + ts * 0.64, y);
          c.lineTo(x + ts * 0.64, y + ts);
        } else {
          c.moveTo(x, y + ts * 0.34);
          c.lineTo(x + ts, y + ts * 0.34);
          c.moveTo(x, y + ts * 0.64);
          c.lineTo(x + ts, y + ts * 0.64);
        }
        c.stroke();
      }

      function renderTerrainInto(targetCtx, world, K) {
        var total = gw * gh;
        var i;
        for (i = 0; i < total; i++) {
          if (world.kind[i] !== K.RIVER) {
            drawSnowTile(targetCtx, i, (i % gw) * ts, ((i / gw) | 0) * ts);
          }
        }
        targetCtx.strokeStyle = 'rgba(90, 110, 130, 0.08)';
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        for (var gx = 1; gx < gw; gx++) {
          var lx = gx * ts + 0.5;
          targetCtx.moveTo(lx, 0);
          targetCtx.lineTo(lx, gh * ts);
        }
        for (var gy = 1; gy < gh; gy++) {
          var ly = gy * ts + 0.5;
          targetCtx.moveTo(0, ly);
          targetCtx.lineTo(gw * ts, ly);
        }
        targetCtx.stroke();
        for (i = 0; i < total; i++) {
          var x = (i % gw) * ts;
          var y = ((i / gw) | 0) * ts;
          if (world.kind[i] === K.RIVER) {
            drawRiverBaseTile(targetCtx, world, K, i, x, y);
          } else if (world.kind[i] === K.RAIL) {
            drawRailTile(targetCtx, world, K, i, x, y);
          }
        }
      }

      function ensureTerrainCache(world, K) {
        if (typeof document === 'undefined') return false;
        if (!cacheCanvas) {
          cacheCanvas = document.createElement('canvas');
          cacheCtx = cacheCanvas.getContext('2d');
        }
        if (!cacheCtx) return false;
        if (cacheWorld === world && cacheTs === ts && cacheCw === cw && cacheCh === ch && cacheDpr === dpr) {
          return true;
        }
        var bw = Math.max(1, ts * gw);
        var bh = Math.max(1, ts * gh);
        cacheCanvas.width = Math.max(1, Math.round(bw * dpr));
        cacheCanvas.height = Math.max(1, Math.round(bh * dpr));
        cacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cacheCtx.clearRect(0, 0, bw, bh);
        renderTerrainInto(cacheCtx, world, K);
        cacheWorld = world;
        cacheTs = ts;
        cacheCw = cw;
        cacheCh = ch;
        cacheDpr = dpr;
        return true;
      }

      function drawWaterGlow(world, K, now, waterGlow) {
        if (waterGlow <= 0) return;
        var alpha = Math.max(0, Math.min(1, waterGlow));
        var total = gw * gh;
        ctx.save();
        for (var i = 0; i < total; i++) {
          if (world.kind[i] !== K.RIVER) continue;
          var x = ox + (i % gw) * ts;
          var y = oy + ((i / gw) | 0) * ts;
          ctx.globalAlpha = alpha * (0.55 + 0.25 * Math.sin(now * 0.012));
          ctx.fillStyle = '#9be7ff';
          ctx.fillRect(x, y, ts, ts);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1.5, ts * 0.06);
          ctx.strokeRect(x + ts * 0.06, y + ts * 0.06, ts * 0.88, ts * 0.88);
        }
        ctx.restore();
      }

      function drawBlockTileFallback(i, x, y) {
        var h = hashTile(i);
        var pad = ts * 0.14;
        var bw = ts - pad * 2;
        var bh = ts - pad * 2;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        roundRectPath(ctx, x + pad + ts * 0.05, y + pad + ts * 0.06, bw, bh, ts * 0.1);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        roundRectPath(ctx, x + pad, y + pad, bw, bh, ts * 0.1);
        ctx.fill();
        var roofs = ['#c85a3c', '#547aa5', '#7c6d61', '#b56c49'];
        ctx.fillStyle = roofs[(h >>> 4) & 3];
        roundRectPath(ctx, x + pad + ts * 0.05, y + pad + ts * 0.05, bw - ts * 0.1, bh - ts * 0.1, ts * 0.07);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        roundRectPath(ctx, x + pad + ts * 0.08, y + pad + ts * 0.08, bw - ts * 0.16, bh * 0.36, ts * 0.04);
        ctx.fill();
      }

      function getRegions(world) {
        if (regionsWorld === world) return cachedRegions;
        regionsWorld = world;
        cachedRegions = [];
        var rows = world.level && world.level.rows;
        if (!rows || !rows.length) return cachedRegions;
        var visited = new Uint8Array(gw * gh);
        var isLandmarkChar = function (ch) {
          return ch === '#' || (ch >= 'F' && ch <= 'Z');
        };
        for (var y = 0; y < gh; y++) {
          var rowStr = rows[y] || '';
          for (var x = 0; x < gw; x++) {
            var idx = y * gw + x;
            if (visited[idx]) continue;
            var ch = rowStr.charAt(x);
            if (!isLandmarkChar(ch)) continue;
            var queue = [idx];
            visited[idx] = 1;
            var tiles = [];
            var minX = x;
            var maxX = x;
            var minY = y;
            var maxY = y;
            var minTile = idx;
            for (var q = 0; q < queue.length; q++) {
              var cur = queue[q];
              tiles.push(cur);
              if (cur < minTile) minTile = cur;
              var cx = cur % gw;
              var cy = (cur / gw) | 0;
              if (cx < minX) minX = cx;
              if (cx > maxX) maxX = cx;
              if (cy < minY) minY = cy;
              if (cy > maxY) maxY = cy;
              var neighbors = [
                cx > 0 ? cur - 1 : -1,
                cx < gw - 1 ? cur + 1 : -1,
                cy > 0 ? cur - gw : -1,
                cy < gh - 1 ? cur + gw : -1
              ];
              for (var n = 0; n < 4; n++) {
                var nb = neighbors[n];
                if (nb < 0 || visited[nb]) continue;
                var nx = nb % gw;
                var ny = (nb / gw) | 0;
                var nch = (rows[ny] || '').charAt(nx);
                if (nch === ch) {
                  visited[nb] = 1;
                  queue.push(nb);
                }
              }
            }
            cachedRegions.push({
              ch: ch,
              minX: minX,
              maxX: maxX,
              minY: minY,
              maxY: maxY,
              minTile: minTile,
              tiles: tiles
            });
          }
        }
        cachedRegions.sort(function (a, b) {
          return (a.maxY - b.maxY) || (a.minY - b.minY) || (a.minX - b.minX);
        });
        return cachedRegions;
      }

      function drawLandmarks(world, K, now) {
        var artPlaces = getArtPlaces();
        var hasArt = artPlaces && typeof artPlaces.draw === 'function';
        var ubLevels = getLevels();
        var lmMap = (ubLevels && ubLevels.LANDMARKS) || null;
        var regions = getRegions(world);
        if (regions.length) {
          for (var r = 0; r < regions.length; r++) {
            var reg = regions[r];
            if (hasArt) {
              var kind = reg.ch === '#' ? 'generic' : ((lmMap && lmMap[reg.ch]) || 'generic');
              var rx = ox + reg.minX * ts;
              var ry = oy + reg.minY * ts;
              var rw = (reg.maxX - reg.minX + 1) * ts;
              var rh = (reg.maxY - reg.minY + 1) * ts;
              artPlaces.draw(ctx, kind, rx, ry, rw, rh, ts, now, reg.minTile);
            } else {
              for (var t = 0; t < reg.tiles.length; t++) {
                var ti = reg.tiles[t];
                drawBlockTileFallback(ti, ox + (ti % gw) * ts, oy + ((ti / gw) | 0) * ts);
              }
            }
          }
          return;
        }
        var total = gw * gh;
        for (var i = 0; i < total; i++) {
          if (world.kind[i] === K.BLOCK) {
            drawBlockTileFallback(i, ox + (i % gw) * ts, oy + ((i / gw) | 0) * ts);
          }
        }
      }

      function drawThroughArrow(cx, cy, ang, col) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.fillStyle = col;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1, ts * 0.035);
        ctx.beginPath();
        ctx.moveTo(ts * 0.16, 0);
        ctx.lineTo(-ts * 0.08, -ts * 0.13);
        ctx.lineTo(-ts * 0.02, 0);
        ctx.lineTo(-ts * 0.08, ts * 0.13);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      function drawGroundRoads(world, sim) {
        var total = gw * gh;
        var hasIsRoad = sim && typeof sim.isRoad === 'function';
        var hasIsJunction = sim && typeof sim.isJunction === 'function';
        var snowW = ts * 0.72;
        var roadW = ts * 0.58;
        var aveSnowW = ts * 0.88;
        var aveRoadW = ts * 0.74;
        var hasPlayerEdges = false;
        var hasPrebuiltEdges = false;

        if (world.edges && world.edges.forEach) {
          world.edges.forEach(function (e) {
            if (e.prebuilt) hasPrebuiltEdges = true;
            else hasPlayerEdges = true;
          });
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (hasPlayerEdges) {
          ctx.strokeStyle = 'rgba(130, 152, 178, 0.28)';
          ctx.lineWidth = snowW + ts * 0.05;
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

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = snowW;
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
        }

        if (hasPrebuiltEdges) {
          ctx.strokeStyle = 'rgba(130, 152, 178, 0.28)';
          ctx.lineWidth = aveSnowW + ts * 0.05;
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

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = aveSnowW;
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
        }

        var rows = world.level && world.level.rows;
        var throughTiles = [];
        for (var i = 0; i < total; i++) {
          var tx = i % gw;
          var ty = (i / gw) | 0;
          var ch = rows && rows[ty] ? rows[ty].charAt(tx) : '';
          var isThroughTile = (world.quota && world.color && world.color[i] >= world.quota.length) || ch === 'E' || ch === 'e';
          if (isThroughTile) {
            throughTiles.push({ i: i, tx: tx, ty: ty, ch: ch });
            continue;
          }
          var isR = hasIsRoad ? sim.isRoad(world, i) : (world.prebuilt && world.prebuilt[i] === 1);
          if (isR) {
            var rx = ox + (tx + 0.5) * ts;
            var ry = oy + (ty + 0.5) * ts;
            var isPre = world.prebuilt && world.prebuilt[i];
            ctx.fillStyle = isPre ? '#525b6b' : '#3b3f4a';
            ctx.beginPath();
            ctx.arc(rx, ry, (isPre ? aveRoadW : roadW) * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        for (var t = 0; t < throughTiles.length; t++) {
          var th = throughTiles[t];
          var x = ox + th.tx * ts;
          var y = oy + th.ty * ts;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y + (ts - aveSnowW) * 0.5, ts + 0.5, aveSnowW);
          ctx.fillStyle = '#525b6b';
          ctx.fillRect(x, y + (ts - aveRoadW) * 0.5, ts + 0.5, aveRoadW);
        }

        if (hasPlayerEdges) {
          ctx.strokeStyle = '#3b3f4a';
          ctx.lineWidth = roadW;
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

          ctx.save();
          ctx.strokeStyle = 'rgba(248, 250, 252, 0.78)';
          ctx.lineWidth = Math.max(1.2, ts * 0.045);
          ctx.setLineDash(dashRoad);
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
          ctx.setLineDash(EMPTY_DASH);
          ctx.restore();
        }

        if (hasPrebuiltEdges) {
          ctx.strokeStyle = '#525b6b';
          ctx.lineWidth = aveRoadW;
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

          var yOff = ts * 0.042;
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = Math.max(1.1, ts * 0.032);
          ctx.lineCap = 'butt';
          ctx.beginPath();
          world.edges.forEach(function (e) {
            if (!e.prebuilt) return;
            var ax = ox + ((e.a % gw) + 0.5) * ts;
            var ay = oy + (((e.a / gw) | 0) + 0.5) * ts;
            var bx = ox + ((e.b % gw) + 0.5) * ts;
            var by = oy + (((e.b / gw) | 0) + 0.5) * ts;
            var dx = bx - ax;
            var dy = by - ay;
            var len = Math.hypot(dx, dy);
            if (len < 1) return;
            var px = (-dy / len) * yOff;
            var py = (dx / len) * yOff;
            ctx.moveTo(ax + px, ay + py);
            ctx.lineTo(bx + px, by + py);
            ctx.moveTo(ax - px, ay - py);
            ctx.lineTo(bx - px, by - py);
          });
          for (var u = 0; u < throughTiles.length; u++) {
            var ut = throughTiles[u];
            var ucy = oy + (ut.ty + 0.5) * ts;
            var ux1 = ut.tx === 0 ? ox : ox + ut.tx * ts + ts * 0.5;
            var ux2 = ut.tx === gw - 1 ? ox + gw * ts : ox + (ut.tx + 0.5) * ts;
            if (ut.tx === 0) {
              ctx.moveTo(ux1, ucy - yOff);
              ctx.lineTo(ux2, ucy - yOff);
              ctx.moveTo(ux1, ucy + yOff);
              ctx.lineTo(ux2, ucy + yOff);
            } else if (ut.tx === gw - 1) {
              ctx.moveTo(ox + ut.tx * ts + ts * 0.5, ucy - yOff);
              ctx.lineTo(ox + gw * ts, ucy - yOff);
              ctx.moveTo(ox + ut.tx * ts + ts * 0.5, ucy + yOff);
              ctx.lineTo(ox + gw * ts, ucy + yOff);
            }
          }
          ctx.stroke();
          ctx.lineCap = 'round';
        }

        for (var a = 0; a < throughTiles.length; a++) {
          var at = throughTiles[a];
          var acx = ox + (at.tx + 0.5) * ts;
          var acy = oy + (at.ty + 0.5) * ts;
          var ang = 0;
          if (at.ch === 'E') {
            ang = at.tx === gw - 1 ? Math.PI : 0;
          } else {
            ang = at.tx === 0 ? Math.PI : 0;
          }
          drawThroughArrow(acx, acy, ang, '#facc15');
        }

        if (rows && world.level && world.level.roadName) {
          var rName = world.level.roadName[lastLang] || world.level.roadName.mn || world.level.roadName.en || '';
          if (rName) {
            var bestStart = -1;
            var bestEnd = -1;
            var bestRow = -1;
            var bestLen = 0;
            for (var py = 0; py < gh; py++) {
              var pStr = rows[py] || '';
              var runStart = -1;
              for (var px = 0; px <= gw; px++) {
                var pc = px < gw ? pStr.charAt(px) : '';
                if (pc === '+') {
                  if (runStart < 0) runStart = px;
                } else if (runStart >= 0) {
                  var runLen = px - runStart;
                  if (runLen > bestLen) {
                    bestLen = runLen;
                    bestStart = runStart;
                    bestEnd = px - 1;
                    bestRow = py;
                  }
                  runStart = -1;
                }
              }
            }
            if (bestLen > 0) {
              var sx1 = ox + bestStart * ts;
              var sx2 = ox + (bestEnd + 1) * ts;
              var scy = oy + (bestRow + 0.5) * ts;
              var artThings = getArtThings();
              if (artThings && typeof artThings.streetName === 'function') {
                artThings.streetName(ctx, rName, sx1, sx2, scy, ts);
              } else {
                ctx.save();
                ctx.font = '700 ' + Math.max(9, Math.round(ts * 0.24)) + 'px ' + FONT_STACK;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.fillText(rName, (sx1 + sx2) * 0.5, scy);
                ctx.restore();
              }
            }
          }
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

      function drawSourceFallback(x, y, cx, cy, col, queue, fullFor, now, isGer) {
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
      }

      function drawDestinationFallback(x, cx, cy, col) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
        roundRectPath(ctx, x + ts * 0.16, cy - ts * 0.32, ts * 0.72, ts * 0.72, ts * 0.18);
        ctx.fill();
        ctx.fillStyle = col;
        roundRectPath(ctx, x + ts * 0.12, cy - ts * 0.38, ts * 0.76, ts * 0.76, ts * 0.18);
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

      function drawEndpoints(world, K, colors, now) {
        var sourceByTile = {};
        if (world.sources) {
          for (var s = 0; s < world.sources.length; s++) {
            var srcObj = world.sources[s];
            sourceByTile[srcObj.tile] = srcObj;
          }
        }
        var artThings = getArtThings();
        var hasSourceArt = artThings && typeof artThings.source === 'function';
        var hasDestArt = artThings && typeof artThings.destination === 'function';
        var rows = world.level && world.level.rows;
        var labels = world.level && world.level.labels;

        var total = gw * gh;
        for (var i = 0; i < total; i++) {
          var kind = world.kind[i];
          if (kind !== K.SRC && kind !== K.DST) continue;
          var tx = i % gw;
          var ty = (i / gw) | 0;
          var letter = rows && rows[ty] ? rows[ty].charAt(tx) : '';
          var cIdx = world.color ? world.color[i] : 0;
          if ((world.quota && cIdx >= world.quota.length) || letter === 'E' || letter === 'e') {
            continue;
          }
          var x = ox + tx * ts;
          var y = oy + ty * ts;
          var cx = x + ts * 0.5;
          var cy = y + ts * 0.5;
          var col = resolveColor(cIdx, colors, '#2f7cf6');
          var lbl = labels && letter ? labels[letter] : null;

          if (kind === K.SRC) {
            var src = sourceByTile[i];
            var queue = src ? (src.queue || 0) : 0;
            var fullFor = src ? (src.fullFor || 0) : 0;
            var danger = Math.max(0, Math.min(1, fullFor / 4));
            var artKind = (lbl && lbl.art) || 'flats';
            if (hasSourceArt) {
              artThings.source(ctx, artKind, col, x, y, ts, now, queue, danger);
            } else {
              drawSourceFallback(x, y, cx, cy, col, queue, fullFor, now, artKind === 'ger');
            }
          } else {
            var rawEn = lbl && lbl.en ? String(lbl.en).toLowerCase() : '';
            var dstKind = DEST_KINDS[rawEn] || 'flag';
            if (hasDestArt) {
              artThings.destination(ctx, dstKind, col, x, y, ts, now);
            } else {
              drawDestinationFallback(x, cx, cy, col);
            }
          }
        }
      }

      function drawEndpointLabels(world, K, colors) {
        var rows = world.level && world.level.rows;
        var labels = world.level && world.level.labels;
        if (!rows || !labels) return;
        var artThings = getArtThings();
        var hasLabelArt = artThings && typeof artThings.label === 'function';
        var total = gw * gh;

        for (var i = 0; i < total; i++) {
          var kind = world.kind[i];
          if (kind !== K.SRC && kind !== K.DST) continue;
          var tx = i % gw;
          var ty = (i / gw) | 0;
          var letter = rows[ty] ? rows[ty].charAt(tx) : '';
          var cIdx = world.color ? world.color[i] : 0;
          if ((world.quota && cIdx >= world.quota.length) || letter === 'E' || letter === 'e') {
            continue;
          }
          var lbl = labels[letter];
          if (!lbl) continue;
          var text = lbl[lastLang] || lbl.mn || lbl.en || '';
          if (!text) continue;
          var col = resolveColor(cIdx, colors, '#2f7cf6');
          var cx = ox + (tx + 0.5) * ts;
          var cy = oy + (ty + 1) * ts + 0.12 * ts;
          if (hasLabelArt) {
            artThings.label(ctx, text, cx, cy, ts, col);
          } else {
            ctx.save();
            ctx.font = '700 ' + Math.max(9, Math.round(ts * 0.24)) + 'px ' + FONT_STACK;
            var tw = ctx.measureText(text).width + ts * 0.28;
            var th = Math.max(13, ts * 0.34);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            roundRectPath(ctx, cx - tw * 0.5, cy - th * 0.5, tw, th, th * 0.45);
            ctx.fill();
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, cx, cy + 0.5);
            ctx.restore();
          }
        }
      }

      function drawSingleCarFallback(lx, ly, ang, col, isBridge) {
        var scale = isBridge ? 1.12 : 1;
        var len = ts * 0.42 * scale;
        var wid = ts * 0.26 * scale;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(ang);
        ctx.fillStyle = isBridge ? 'rgba(15, 23, 42, 0.34)' : 'rgba(15, 23, 42, 0.22)';
        roundRectPath(ctx, -len * 0.5 + 1.2, -wid * 0.5 + 1.5, len, wid, wid * 0.32);
        ctx.fill();
        ctx.fillStyle = col;
        roundRectPath(ctx, -len * 0.5, -wid * 0.5, len, wid, wid * 0.32);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = Math.max(0.9, ts * 0.025);
        ctx.stroke();
        ctx.fillStyle = '#1e293b';
        roundRectPath(ctx, len * 0.02, -wid * 0.36, len * 0.3, wid * 0.72, wid * 0.16);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        roundRectPath(ctx, -len * 0.34, -wid * 0.32, len * 0.28, wid * 0.64, wid * 0.14);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(len * 0.42, -wid * 0.36, len * 0.08, wid * 0.18);
        ctx.fillRect(len * 0.42, wid * 0.18, len * 0.08, wid * 0.18);
        ctx.restore();
      }

      function drawCarsLayer(world, sim, colors, targetLayer) {
        if (!world.cars || !sim || typeof sim.carPos !== 'function') return;
        var artThings = getArtThings();
        var hasBusArt = artThings && typeof artThings.bus === 'function';
        var hasCarArt = artThings && typeof artThings.car === 'function';
        var ubLevels = getLevels();
        var levelColors = (ubLevels && ubLevels.COLORS) ? ubLevels.COLORS : colors;
        var isBridge = targetLayer === 1;
        var lane = ts * (isBridge ? 0.055 : 0.075);

        for (var i = 0; i < world.cars.length; i++) {
          var car = world.cars[i];
          var pos = sim.carPos(world, car);
          if (!pos || pos.layer !== targetLayer) continue;
          var ang = DIR_ANGLES[(pos.dir || 0) & 3] || 0;
          var cx = ox + pos.x * ts - Math.sin(ang) * lane;
          var cy = oy + pos.y * ts + Math.cos(ang) * lane;
          var isThroughCar = world.quota && car.color >= world.quota.length;
          if (isThroughCar) {
            if (hasBusArt) {
              artThings.bus(ctx, cx, cy, ang, ts, car.id);
            } else {
              drawSingleCarFallback(cx, cy, ang, resolveColor(car.color, levelColors, '#facc15'), isBridge);
            }
          } else {
            var carCol = resolveColor(car.color, levelColors, '#2f7cf6');
            if (hasCarArt) {
              artThings.car(ctx, cx, cy, ang, ts, carCol, car.id);
            } else {
              drawSingleCarFallback(cx, cy, ang, carCol, isBridge);
            }
          }
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

          var shadowDx = ts * 0.14;
          var shadowDy = ts * 0.17;
          var mStartX = sx + ux * ts * 0.28;
          var mStartY = sy + uy * ts * 0.28;
          var mEndX = ex - ux * ts * 0.28;
          var mEndY = ey - uy * ts * 0.28;

          ctx.save();
          ctx.lineCap = 'butt';
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
          ctx.lineWidth = deckW * 1.08;
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

          ctx.strokeStyle = '#7c8798';
          ctx.lineWidth = deckW;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.lineCap = 'butt';
          ctx.strokeStyle = '#9aa5b4';
          ctx.lineWidth = deckW * 0.92;
          ctx.beginPath();
          ctx.moveTo(mStartX, mStartY);
          ctx.lineTo(mEndX, mEndY);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
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

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
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
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = Math.max(2, ts * 0.075);
          ctx.beginPath();
          ctx.moveTo(rStartX + px * railOff, rStartY + py * railOff);
          ctx.lineTo(rEndX + px * railOff, rEndY + py * railOff);
          ctx.moveTo(rStartX - px * railOff, rStartY - py * railOff);
          ctx.lineTo(rEndX - px * railOff, rEndY - py * railOff);
          ctx.stroke();

          var postCount = b.tiles.length;
          var postH = ts * 0.14;
          var glowR = Math.max(3.5, ts * 0.12);
          var dotR = Math.max(1.7, ts * 0.052);
          for (var k = 0; k < postCount; k++) {
            var tk = b.tiles[k];
            var kx = ox + ((tk % gw) + 0.5) * ts;
            var ky = oy + (((tk / gw) | 0) + 0.5) * ts;
            for (var side = -1; side <= 1; side += 2) {
              var lx = kx + px * railOff * side;
              var ly = ky + py * railOff * side;
              var topX = lx;
              var topY = ly - postH;
              ctx.strokeStyle = '#334155';
              ctx.lineWidth = Math.max(1.4, ts * 0.042);
              ctx.beginPath();
              ctx.moveTo(lx, ly);
              ctx.lineTo(topX, topY);
              ctx.stroke();

              ctx.fillStyle = 'rgba(253, 224, 71, 0.34)';
              ctx.beginPath();
              ctx.arc(topX, topY, glowR, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#fde047';
              ctx.beginPath();
              ctx.arc(topX, topY, dotR, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#fffbeb';
              ctx.beginPath();
              ctx.arc(topX, topY, dotR * 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
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

      function drawPlaceTitle(world, now) {
        if (titlePending) {
          titleStart = now;
          titlePending = false;
        }
        if (titleStart === null) return;
        var age = now - titleStart;
        if (age < 0) {
          titleStart = now;
          age = 0;
        }
        if (age >= 3000) {
          titleStart = null;
          return;
        }
        var nameObj = world.level && world.level.name;
        var title = typeof nameObj === 'string' ? nameObj : (nameObj && (nameObj[lastLang] || nameObj.mn || nameObj.en)) || '';
        if (!title) return;

        var alpha = age > 2400 ? Math.max(0, (3000 - age) / 600) : 1;
        var fontSize = Math.max(12, Math.round(ts * 0.34));
        var padX = Math.max(10, ts * 0.28);
        var padY = Math.max(6, ts * 0.16);
        var pinSize = Math.max(10, ts * 0.28);
        var gap = Math.max(6, ts * 0.16);
        var chipX = ox + Math.max(8, ts * 0.22);
        var chipY = oy + Math.max(8, ts * 0.22);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '800 ' + fontSize + 'px ' + FONT_STACK;
        var textW = ctx.measureText(title).width;
        var chipW = padX * 2 + pinSize + gap + textW;
        var chipH = Math.max(26, fontSize + padY * 2);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
        roundRectPath(ctx, chipX + 1, chipY + 2, chipW, chipH, chipH * 0.5);
        ctx.fill();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
        roundRectPath(ctx, chipX, chipY, chipW, chipH, chipH * 0.5);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        var pinCx = chipX + padX + pinSize * 0.5;
        var pinCy = chipY + chipH * 0.44;
        var pinR = pinSize * 0.38;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(pinCx, pinCy, pinR, Math.PI * 0.85, Math.PI * 0.15, false);
        ctx.lineTo(pinCx, pinCy + pinR * 1.65);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pinCx, pinCy, pinR * 0.42, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, chipX + padX + pinSize + gap, chipY + chipH * 0.5 + 0.5);
        ctx.restore();
      }

      function drawEffects(now, colors) {
        var artThings = getArtThings();
        var hasBubble = artThings && typeof artThings.bubble === 'function';
        var phrases = PENALTY_PHRASES[lastLang] || PENALTY_PHRASES.mn;

        for (var i = effects.length - 1; i >= 0; i--) {
          var fx = effects[i];
          if (fx.born === null || now < fx.born) fx.born = now;
          var age = now - fx.born;
          var maxAge = fx.type === 'penalty' ? 1200 : 700;
          if (age > maxAge) {
            effects.splice(i, 1);
            continue;
          }
          var tx = (fx.tile >= 0 && fx.tile < gw * gh) ? (fx.tile % gw) : (gw * 0.5 - 0.5);
          var ty = (fx.tile >= 0 && fx.tile < gw * gh) ? ((fx.tile / gw) | 0) : (gh * 0.5 - 0.5);
          var cx = ox + (tx + 0.5) * ts;
          var cy = oy + (ty + 0.5) * ts;

          ctx.save();
          if (fx.type === 'deliver') {
            var p = age / 700;
            var col = resolveColor(fx.color, colors, '#22c55e');
            ctx.globalAlpha = 1 - p;
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
            ctx.font = '800 ' + Math.round(ts * 0.48) + 'px ' + FONT_STACK;
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
            if (age <= 700) {
              var pp = age / 700;
              ctx.save();
              ctx.globalAlpha = 1 - pp;
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = Math.max(2.2, ts * 0.08);
              ctx.beginPath();
              ctx.arc(cx, cy, ts * (0.3 + pp * 0.7), 0, Math.PI * 2);
              ctx.stroke();

              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = Math.max(2, ts * 0.065);
              ctx.lineCap = 'round';
              for (var h = 0; h < 8; h++) {
                var hang = (h / 8) * Math.PI * 2 + 0.35;
                var hr1 = ts * (0.35 + pp * 0.25);
                var hr2 = ts * (0.62 + pp * 0.45);
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(hang) * hr1, cy + Math.sin(hang) * hr1);
                ctx.lineTo(cx + Math.cos(hang) * hr2, cy + Math.sin(hang) * hr2);
                ctx.stroke();
              }
              ctx.restore();
            }
            if (hasBubble) {
              var bAlpha = age > 850 ? Math.max(0, (1200 - age) / 350) : 1;
              var phrase = phrases[fx.seq % phrases.length];
              artThings.bubble(ctx, phrase, cx, cy - ts * 0.2, ts, bAlpha);
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

        markWorldChange(world);
        if (world.w && world.h && (world.w !== gw || world.h !== gh)) {
          fit(world);
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);

        var artMap = getArtMap();
        if (artMap && typeof artMap.backdrop === 'function') {
          artMap.backdrop(ctx, cw, ch, { x: ox, y: oy, w: ts * gw, h: ts * gh }, now);
        } else {
          ctx.fillStyle = '#d7e2ed';
          ctx.fillRect(0, 0, cw, ch);
        }

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

        ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
        roundRectPath(ctx, ox - 3, oy - 2, ts * gw + 6, ts * gh + 7, 10);
        ctx.fill();

        var sim = getSim();
        var K = (sim && sim.K) ? sim.K : DEFAULT_K;
        var colors = getColors();

        ctx.save();
        roundRectPath(ctx, ox, oy, ts * gw, ts * gh, 8);
        ctx.clip();

        if (ensureTerrainCache(world, K)) {
          ctx.drawImage(cacheCanvas, 0, 0, cacheCanvas.width, cacheCanvas.height, ox, oy, ts * gw, ts * gh);
        } else {
          ctx.save();
          ctx.translate(ox, oy);
          renderTerrainInto(ctx, world, K);
          ctx.restore();
        }

        drawWaterGlow(world, K, now, waterGlow);
        drawGroundRoads(world, sim);
        drawEndpoints(world, K, colors, now);
        drawCarsLayer(world, sim, colors, 0);
        ctx.restore();

        drawLandmarks(world, K, now);
        drawBridges(world);
        drawCarsLayer(world, sim, colors, 1);
        drawPreview(view.preview);
        drawEndpointLabels(world, K, colors);
        drawPlaceTitle(world, now);
        drawEffects(now, colors);

        ox = baseOx;
        oy = baseOy;
      }

      function drawTransition(levels, from, to, p) {
        if (!cw || !ch) resize();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);

        var now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        var artMap = getArtMap();
        if (artMap && typeof artMap.map === 'function') {
          artMap.map(ctx, cw, ch, levels, from, to, p, lastLang, now);
          return;
        }

        var grad = ctx.createLinearGradient(0, 0, 0, ch);
        grad.addColorStop(0, '#bae6fd');
        grad.addColorStop(0.24, '#e2ebf4');
        grad.addColorStop(0.68, '#d4e0ec');
        grad.addColorStop(1, '#bcccd9');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);

        ctx.fillStyle = '#cad8e6';
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
        ctx.strokeStyle = '#cfe6f5';
        ctx.lineWidth = Math.max(18, ch * 0.055);
        ctx.beginPath();
        ctx.moveTo(-20, ry + ch * 0.03);
        ctx.bezierCurveTo(cw * 0.28, ry - ch * 0.04, cw * 0.68, ry + ch * 0.06, cw + 20, ry - ch * 0.02);
        ctx.stroke();

        ctx.strokeStyle = '#b9d9ef';
        ctx.lineWidth = Math.max(12, ch * 0.038);
        ctx.beginPath();
        ctx.moveTo(-20, ry + ch * 0.03);
        ctx.bezierCurveTo(cw * 0.28, ry - ch * 0.04, cw * 0.68, ry + ch * 0.06, cw + 20, ry - ch * 0.02);
        ctx.stroke();

        ctx.fillStyle = '#dde7f0';
        ctx.beginPath();
        ctx.moveTo(0, ch);
        ctx.lineTo(0, ch * 0.85);
        ctx.quadraticCurveTo(cw * 0.18, ch * 0.74, cw * 0.36, ch * 0.84);
        ctx.quadraticCurveTo(cw * 0.55, ch * 0.71, cw * 0.76, ch * 0.83);
        ctx.quadraticCurveTo(cw * 0.9, ch * 0.75, cw, ch * 0.84);
        ctx.lineTo(cw, ch);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#c8d6e3';
        ctx.beginPath();
        ctx.moveTo(0, ch);
        ctx.lineTo(cw * 0.1, ch * 0.88);
        ctx.quadraticCurveTo(cw * 0.32, ch * 0.77, cw * 0.52, ch * 0.89);
        ctx.quadraticCurveTo(cw * 0.72, ch * 0.76, cw * 0.95, ch * 0.89);
        ctx.lineTo(cw, ch);
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
          ctx.font = '700 ' + Math.round(pinR * 1.1) + 'px ' + FONT_STACK;
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
          ctx.font = '800 15px ' + FONT_STACK;
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
