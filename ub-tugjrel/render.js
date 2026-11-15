(function (root) {
  var FONT_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  var CAR_PALETTE = ['#f8fafc', '#e2e8f0', '#cbd5e1', '#f8fafc', '#94a3b8', '#1f2937', '#2f7cf6', '#ef4444'];
  var MAX_SCALE = 0.6;
  var WIDTH_BUCKETS = 17;
  var COLOR_BUCKETS = 8;
  var EFFECT_DURATION = 800;

  var LOAD_STOPS = [
    [0.00, 34, 197, 94],
    [0.35, 163, 230, 53],
    [0.55, 245, 158, 11],
    [0.75, 239, 68, 68],
    [0.92, 127, 29, 29]
  ];

  var WIDTH_TABLE = (function () {
    var arr = new Float32Array(WIDTH_BUCKETS);
    for (var i = 0; i < WIDTH_BUCKETS; i++) {
      arr[i] = 1.2 * Math.pow(1.22, i);
    }
    return arr;
  })();

  function lerpColor(t) {
    if (t <= 0) return '#22c55e';
    if (t >= 0.92) return '#7f1d1d';
    var i = 0;
    while (i < LOAD_STOPS.length - 2 && t > LOAD_STOPS[i + 1][0]) i++;
    var a = LOAD_STOPS[i];
    var b = LOAD_STOPS[i + 1];
    var u = (t - a[0]) / (b[0] - a[0]);
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    var r = Math.round(a[1] + (b[1] - a[1]) * u);
    var g = Math.round(a[2] + (b[2] - a[2]) * u);
    var bl = Math.round(a[3] + (b[3] - a[3]) * u);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  var LOAD_COLORS = (function () {
    var arr = [];
    for (var i = 0; i < COLOR_BUCKETS; i++) {
      arr.push(lerpColor(i / (COLOR_BUCKETS - 1)));
    }
    return arr;
  })();

  function getSim() {
    if (root && typeof root.Sim !== 'undefined') return root.Sim;
    if (typeof Sim !== 'undefined') return Sim;
    return null;
  }

  function getMap() {
    if (root && typeof root.UBMap !== 'undefined') return root.UBMap;
    if (typeof UBMap !== 'undefined') return UBMap;
    return null;
  }

  function getScenario() {
    if (root && typeof root.UBScenario !== 'undefined') return root.UBScenario;
    if (typeof UBScenario !== 'undefined') return UBScenario;
    return null;
  }

  function getArtPlaces() {
    if (root && typeof root.UBArtPlaces !== 'undefined') return root.UBArtPlaces;
    if (typeof UBArtPlaces !== 'undefined') return UBArtPlaces;
    return null;
  }

  function getArtThings() {
    if (root && typeof root.UBArtThings !== 'undefined') return root.UBArtThings;
    if (typeof UBArtThings !== 'undefined') return UBArtThings;
    return null;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function hashInt(n) {
    var x = (n | 0) ^ 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  }

  function computePolyBBox(pts) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < pts.length; i += 2) {
      var x = pts[i];
      var y = pts[i + 1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return [minX, minY, maxX, maxY];
  }

  function buildGerCache(gerAreas) {
    var areas = [];
    for (var a = 0; a < gerAreas.length; a++) {
      var ga = gerAreas[a];
      var r = ga.r || 600;
      var step = Math.max(85, r / 8.5);
      var gx = [];
      var gy = [];
      var gdir = [];
      var gsmoke = [];
      var gseed = [];
      var r2 = r * r * 0.88;
      var count = 0;
      for (var dy = -r; dy <= r && count < 96; dy += step) {
        for (var dx = -r; dx <= r && count < 96; dx += step) {
          var seed = hashInt(a * 9973 + Math.round(dx + 5000) * 131 + Math.round(dy + 5000) * 17);
          var jx = dx + (((seed & 255) / 255) - 0.5) * step * 0.65;
          var jy = dy + ((((seed >>> 8) & 255) / 255) - 0.5) * step * 0.65;
          if (jx * jx + jy * jy <= r2) {
            gx.push(ga.x + jx);
            gy.push(ga.y + jy);
            gdir.push((seed >>> 16) & 3);
            gsmoke.push(((seed >>> 18) & 1023) / 1023);
            gseed.push(seed);
            count++;
          }
        }
      }
      areas.push({
        x: ga.x,
        y: ga.y,
        r: r,
        gx: new Float64Array(gx),
        gy: new Float64Array(gy),
        gdir: new Uint8Array(gdir),
        gsmoke: new Float32Array(gsmoke),
        gseed: new Uint32Array(gseed),
        count: count
      });
    }
    return areas;
  }

  function tracePolyline(ctx, pts) {
    var len = pts.length;
    if (len < 4) return;
    ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < len; i += 2) {
      ctx.lineTo(pts[i], pts[i + 1]);
    }
  }

  function tracePolylineScreen(ctx, pts, camX, camY, scale, halfW, halfH) {
    var len = pts.length;
    if (len < 4) return;
    ctx.moveTo((pts[0] - camX) * scale + halfW, (pts[1] - camY) * scale + halfH);
    for (var i = 2; i < len; i += 2) {
      ctx.lineTo((pts[i] - camX) * scale + halfW, (pts[i + 1] - camY) * scale + halfH);
    }
  }

  function drawHouseIcon(ctx, cx, cy, r) {
    var s = r * 0.56;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.95);
    ctx.lineTo(cx + s * 0.95, cy - s * 0.05);
    ctx.lineTo(cx + s * 0.68, cy - s * 0.05);
    ctx.lineTo(cx + s * 0.68, cy + s * 0.82);
    ctx.lineTo(cx - s * 0.68, cy + s * 0.82);
    ctx.lineTo(cx - s * 0.68, cy - s * 0.05);
    ctx.lineTo(cx - s * 0.95, cy - s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2f7cf6';
    ctx.fillRect(cx - s * 0.22, cy + s * 0.2, s * 0.44, s * 0.62);
  }

  function drawBriefcaseIcon(ctx, cx, cy, r) {
    var w = r * 1.04;
    var h = r * 0.72;
    var hw = w * 0.5;
    var hh = h * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.4, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.4, cy - hh);
    ctx.lineTo(cx - hw * 0.4, cy - hh - r * 0.22);
    ctx.lineTo(cx + hw * 0.4, cy - hh - r * 0.22);
    ctx.lineTo(cx + hw * 0.4, cy - hh);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - hw, cy - hh + r * 0.06, w, h);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx - hw, cy - r * 0.02, w, Math.max(1.2, r * 0.11));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - r * 0.12, cy - r * 0.06, r * 0.24, r * 0.20);
  }

  function drawOverpassIcon(ctx, sx, sy, scale) {
    var r = clamp(24 * scale, 6.5, 16);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.arc(sx + 1, sy + 1.5, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.4, r * 0.22);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.fillRect(sx - r * 0.82, sy - r * 0.28, r * 1.64, r * 0.56);
    ctx.strokeRect(sx - r * 0.82, sy - r * 0.28, r * 1.64, r * 0.56);

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(0.8, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(sx - r * 0.55, sy);
    ctx.lineTo(sx + r * 0.55, sy);
    ctx.stroke();
  }

  function drawTrafficLightIcon(ctx, sx, sy, scale, hasOverpass) {
    var h = clamp(22 * scale, 9, 17);
    var w = h * 0.46;
    var ox = hasOverpass ? sx + h * 0.65 : sx;
    var oy = hasOverpass ? sy - h * 0.55 : sy;
    var rx = ox - w * 0.5;
    var ry = oy - h * 0.5;
    var rad = w * 0.4;

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + rad, ry);
    ctx.arcTo(rx + w, ry, rx + w, ry + h, rad);
    ctx.arcTo(rx + w, ry + h, rx, ry + h, rad);
    ctx.arcTo(rx, ry + h, rx, ry, rad);
    ctx.arcTo(rx, ry, rx + w, ry, rad);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    var dotR = Math.max(1.1, w * 0.24);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(ox, ry + h * 0.22, dotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(ox, oy, dotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(ox, ry + h * 0.78, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var cssW = 390;
    var cssH = 600;
    var dpr = 1;
    var cam = { x: 12310, y: 7463.5, scale: 0.015 };
    var fitScale = 0.015;
    var hasCamera = false;

    var effects = [];
    var lastNow = 0;

    var cachedMapRef = null;
    var riverBBoxes = null;
    var railBBoxes = null;

    var cachedGerRef = null;
    var gerCache = null;

    var cachedCity = null;
    var cachedEdgeCount = 0;
    var edgeCap = 0;
    var edgeMinX = null;
    var edgeMinY = null;
    var edgeMaxX = null;
    var edgeMaxY = null;
    var casingNext = null;
    var fillNext = null;
    var addedEdges = null;

    var casingHead = new Int32Array(WIDTH_BUCKETS);
    var fillHead = new Int32Array(WIDTH_BUCKETS * COLOR_BUCKETS);

    function getMapDims() {
      var m = getMap();
      return {
        w: (m && m.w > 0) ? m.w : 24620,
        h: (m && m.h > 0) ? m.h : 14927
      };
    }

    function computeFitScale() {
      var dims = getMapDims();
      var sx = (cssW * 0.96) / dims.w;
      var sy = (cssH * 0.96) / dims.h;
      var s = Math.min(sx, sy);
      if (!(s > 0)) s = 0.015;
      if (s > MAX_SCALE) s = MAX_SCALE;
      fitScale = s;
      return s;
    }

    function resize() {
      dpr = Math.min(2, (root && root.devicePixelRatio) ? root.devicePixelRatio : 1);
      var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
      var w = (rect && rect.width > 0) ? rect.width : (canvas.clientWidth > 0 ? canvas.clientWidth : (canvas.width > 0 ? canvas.width / dpr : 390));
      var h = (rect && rect.height > 0) ? rect.height : (canvas.clientHeight > 0 ? canvas.clientHeight : (canvas.height > 0 ? canvas.height / dpr : 600));
      cssW = w;
      cssH = h;
      var pw = Math.max(1, Math.round(w * dpr));
      var ph = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== pw) canvas.width = pw;
      if (canvas.height !== ph) canvas.height = ph;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      computeFitScale();
    }

    function setCamera(x, y, scale) {
      var dims = getMapDims();
      var minS = computeFitScale() * 0.9;
      var s = clamp(scale, minS, MAX_SCALE);
      var cx = clamp(x, 0, dims.w);
      var cy = clamp(y, 0, dims.h);
      cam.x = cx;
      cam.y = cy;
      cam.scale = s;
      hasCamera = true;
    }

    function fitCity(city) {
      resize();
      var dims = getMapDims();
      var s = computeFitScale();
      var core = Math.min((cssW * 0.96) / 16000, (cssH * 0.96) / 11500);
      cam.x = s < core ? 12000 : dims.w * 0.5;
      cam.y = s < core ? 7750 : dims.h * 0.5;
      cam.scale = Math.min(MAX_SCALE, Math.max(s, core));
      hasCamera = true;
      if (city) ensureCityCache(city);
    }

    function getCamera() {
      return { x: cam.x, y: cam.y, scale: cam.scale };
    }

    function screenToWorld(clientX, clientY) {
      var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      var sx = clientX - rect.left;
      var sy = clientY - rect.top;
      return {
        x: (sx - cssW * 0.5) / cam.scale + cam.x,
        y: (sy - cssH * 0.5) / cam.scale + cam.y
      };
    }

    function worldToScreen(x, y) {
      var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      var sx = (x - cam.x) * cam.scale + cssW * 0.5;
      var sy = (y - cam.y) * cam.scale + cssH * 0.5;
      return {
        x: sx + rect.left,
        y: sy + rect.top
      };
    }

    function ensureMapCache(map) {
      if (!map || cachedMapRef === map) return;
      cachedMapRef = map;
      riverBBoxes = [];
      if (map.rivers) {
        for (var i = 0; i < map.rivers.length; i++) {
          riverBBoxes.push(computePolyBBox(map.rivers[i].pts));
        }
      }
      railBBoxes = [];
      if (map.rails) {
        for (var j = 0; j < map.rails.length; j++) {
          railBBoxes.push(computePolyBBox(map.rails[j]));
        }
      }
    }

    function ensureCityCache(city) {
      if (!city) return;
      var ec = city.edgeCount | 0;
      if (cachedCity !== city) {
        cachedCity = city;
        cachedEdgeCount = 0;
      }
      if (ec > edgeCap) {
        var newCap = ec + 128;
        var nMinX = new Float32Array(newCap);
        var nMinY = new Float32Array(newCap);
        var nMaxX = new Float32Array(newCap);
        var nMaxY = new Float32Array(newCap);
        if (cachedEdgeCount > 0 && edgeMinX) {
          nMinX.set(edgeMinX.subarray(0, cachedEdgeCount));
          nMinY.set(edgeMinY.subarray(0, cachedEdgeCount));
          nMaxX.set(edgeMaxX.subarray(0, cachedEdgeCount));
          nMaxY.set(edgeMaxY.subarray(0, cachedEdgeCount));
        }
        edgeMinX = nMinX;
        edgeMinY = nMinY;
        edgeMaxX = nMaxX;
        edgeMaxY = nMaxY;
        casingNext = new Int32Array(newCap);
        fillNext = new Int32Array(newCap);
        addedEdges = new Int32Array(newCap);
        edgeCap = newCap;
      }
      if (cachedEdgeCount < ec) {
        var epts = city.epts;
        for (var e = cachedEdgeCount; e < ec; e++) {
          var pts = epts[e];
          var minX = Infinity;
          var minY = Infinity;
          var maxX = -Infinity;
          var maxY = -Infinity;
          if (pts) {
            for (var k = 0; k < pts.length; k += 2) {
              var px = pts[k];
              var py = pts[k + 1];
              if (px < minX) minX = px;
              if (py < minY) minY = py;
              if (px > maxX) maxX = px;
              if (py > maxY) maxY = py;
            }
          }
          edgeMinX[e] = minX;
          edgeMinY[e] = minY;
          edgeMaxX[e] = maxX;
          edgeMaxY[e] = maxY;
        }
        cachedEdgeCount = ec;
      }
    }

    function drawGround(camX, camY, scale, halfW, halfH) {
      ctx.fillStyle = '#eef1f4';
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.fillStyle = 'rgba(216, 226, 236, 0.36)';
      ctx.beginPath();
      ctx.ellipse((12500 - camX) * scale + halfW, (13200 - camY) * scale + halfH, 9000 * scale, 3400 * scale, -0.08, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(222, 230, 238, 0.32)';
      ctx.beginPath();
      ctx.ellipse((11000 - camX) * scale + halfW, (1800 - camY) * scale + halfH, 8200 * scale, 2600 * scale, 0.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.ellipse((12000 - camX) * scale + halfW, (7800 - camY) * scale + halfH, 7200 * scale, 2200 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawGerDistricts(scen, artPlaces, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY, now) {
      var gerAreas = scen && scen.gerAreas;
      if (!gerAreas || !gerAreas.length) return;
      if (cachedGerRef !== gerAreas) {
        cachedGerRef = gerAreas;
        gerCache = buildGerCache(gerAreas);
      }

      var detailed = scale > 0.12 && artPlaces && typeof artPlaces.draw === 'function';
      var a, i, ga, sx, sy, sr;

      for (a = 0; a < gerCache.length; a++) {
        ga = gerCache[a];
        if (ga.x + ga.r < viewMinX || ga.x - ga.r > viewMaxX || ga.y + ga.r < viewMinY || ga.y - ga.r > viewMaxY) continue;
        sx = (ga.x - camX) * scale + halfW;
        sy = (ga.y - camY) * scale + halfH;
        sr = ga.r * scale;
        ctx.fillStyle = 'rgba(208, 200, 189, 0.28)';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      if (detailed) {
        var pw = 42 * scale;
        var ph = 36 * scale;
        var pts = Math.min(pw, ph) * 0.5;
        for (a = 0; a < gerCache.length; a++) {
          ga = gerCache[a];
          if (ga.x + ga.r < viewMinX || ga.x - ga.r > viewMaxX || ga.y + ga.r < viewMinY || ga.y - ga.r > viewMaxY) continue;
          for (i = 0; i < ga.count; i++) {
            sx = (ga.gx[i] - camX) * scale + halfW;
            sy = (ga.gy[i] - camY) * scale + halfH;
            if (sx + pw < 0 || sx - pw > cssW || sy + ph < 0 || sy - ph > cssH) continue;
            artPlaces.draw(ctx, 'ger', sx - pw * 0.5, sy - ph * 0.5, pw, ph, pts, now, ga.gseed[i]);
          }
        }
        return;
      }

      var fenceHalf = Math.max(2.2, 16 * scale);
      ctx.strokeStyle = 'rgba(138, 126, 112, 0.42)';
      ctx.lineWidth = Math.max(0.7, 1.3 * scale);
      ctx.beginPath();
      for (a = 0; a < gerCache.length; a++) {
        ga = gerCache[a];
        if (ga.x + ga.r < viewMinX || ga.x - ga.r > viewMaxX || ga.y + ga.r < viewMinY || ga.y - ga.r > viewMaxY) continue;
        for (i = 0; i < ga.count; i++) {
          var wx = ga.gx[i];
          var wy = ga.gy[i];
          if (wx < viewMinX - 40 || wx > viewMaxX + 40 || wy < viewMinY - 40 || wy > viewMaxY + 40) continue;
          sx = (wx - camX) * scale + halfW;
          sy = (wy - camY) * scale + halfH;
          var d = ga.gdir[i];
          ctx.moveTo(sx - fenceHalf, sy - fenceHalf);
          if (d === 0) {
            ctx.lineTo(sx + fenceHalf, sy - fenceHalf);
            ctx.lineTo(sx + fenceHalf, sy + fenceHalf);
          } else if (d === 1) {
            ctx.lineTo(sx - fenceHalf, sy + fenceHalf);
            ctx.lineTo(sx + fenceHalf, sy + fenceHalf);
          } else if (d === 2) {
            ctx.lineTo(sx + fenceHalf, sy - fenceHalf);
            ctx.moveTo(sx - fenceHalf, sy + fenceHalf);
            ctx.lineTo(sx + fenceHalf, sy + fenceHalf);
          } else {
            ctx.lineTo(sx - fenceHalf, sy + fenceHalf);
          }
        }
      }
      ctx.stroke();

      var gerR = Math.max(1.7, 5.5 * scale);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (a = 0; a < gerCache.length; a++) {
        ga = gerCache[a];
        if (ga.x + ga.r < viewMinX || ga.x - ga.r > viewMaxX || ga.y + ga.r < viewMinY || ga.y - ga.r > viewMaxY) continue;
        for (i = 0; i < ga.count; i++) {
          if (ga.gx[i] < viewMinX - 30 || ga.gx[i] > viewMaxX + 30 || ga.gy[i] < viewMinY - 30 || ga.gy[i] > viewMaxY + 30) continue;
          sx = (ga.gx[i] - camX) * scale + halfW;
          sy = (ga.gy[i] - camY) * scale + halfH;
          ctx.moveTo(sx + gerR, sy);
          ctx.arc(sx, sy, gerR, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      var dotR = Math.max(0.65, gerR * 0.36);
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      for (a = 0; a < gerCache.length; a++) {
        ga = gerCache[a];
        if (ga.x + ga.r < viewMinX || ga.x - ga.r > viewMaxX || ga.y + ga.r < viewMinY || ga.y - ga.r > viewMaxY) continue;
        for (i = 0; i < ga.count; i++) {
          if (ga.gx[i] < viewMinX - 30 || ga.gx[i] > viewMaxX + 30 || ga.gy[i] < viewMinY - 30 || ga.gy[i] > viewMaxY + 30) continue;
          sx = (ga.gx[i] - camX) * scale + halfW;
          sy = (ga.gy[i] - camY) * scale + halfH;
          ctx.moveTo(sx + dotR, sy);
          ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      var tBase = now * 0.00018;
      var wispBase = Math.max(2.2, 8 * scale);
      ctx.fillStyle = 'rgba(120, 130, 142, 0.16)';
      ctx.beginPath();
      for (a = 0; a < gerCache.length; a++) {
        ga = gerCache[a];
        if (ga.x + ga.r < viewMinX || ga.x - ga.r > viewMaxX || ga.y + ga.r < viewMinY || ga.y - ga.r > viewMaxY) continue;
        for (i = 0; i < ga.count; i += 3) {
          if (ga.gx[i] < viewMinX - 80 || ga.gx[i] > viewMaxX + 80 || ga.gy[i] < viewMinY - 80 || ga.gy[i] > viewMaxY + 80) continue;
          var u = (tBase + ga.gsmoke[i]) % 1;
          sx = (ga.gx[i] - camX) * scale + halfW + u * (8 + 45 * scale);
          sy = (ga.gy[i] - camY) * scale + halfH - u * (10 + 55 * scale);
          var wr = wispBase * (0.45 + u * 0.9);
          ctx.moveTo(sx + wr, sy);
          ctx.arc(sx, sy, wr, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }

    function drawRivers(map, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY) {
      if (!map || !map.rivers) return;
      var rivers = map.rivers;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var i = 0; i < rivers.length; i++) {
        var bb = riverBBoxes[i];
        if (bb[2] < viewMinX - 80 || bb[0] > viewMaxX + 80 || bb[3] < viewMinY - 80 || bb[1] > viewMaxY + 80) continue;
        var riv = rivers[i];
        var isTuul = riv.name && riv.name.indexOf('\u0422\u0443\u0443\u043b') !== -1;
        var rw = isTuul ? Math.max(2.5, 60 * scale) : Math.max(1.2, 25 * scale);

        ctx.beginPath();
        tracePolylineScreen(ctx, riv.pts, camX, camY, scale, halfW, halfH);
        ctx.strokeStyle = '#bfe0f5';
        ctx.lineWidth = rw;
        ctx.stroke();

        ctx.strokeStyle = '#e2f4fd';
        ctx.lineWidth = Math.max(0.7, rw * 0.42);
        ctx.stroke();
      }
    }

    function drawRails(map, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY) {
      if (!map || !map.rails) return;
      var rails = map.rails;
      var drawSleepers = scale > 0.08;
      ctx.lineJoin = 'round';
      for (var i = 0; i < rails.length; i++) {
        var bb = railBBoxes[i];
        if (bb[2] < viewMinX - 30 || bb[0] > viewMaxX + 30 || bb[3] < viewMinY - 30 || bb[1] > viewMaxY + 30) continue;
        ctx.beginPath();
        tracePolylineScreen(ctx, rails[i], camX, camY, scale, halfW, halfH);

        if (drawSleepers) {
          ctx.lineCap = 'butt';
          ctx.setLineDash([Math.max(1.5, 2.2 * scale), Math.max(4, 5.5 * scale)]);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(5, 7.5 * scale);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.lineCap = 'round';
        ctx.strokeStyle = '#3f4756';
        ctx.lineWidth = Math.max(1.3, 2.8 * scale);
        ctx.stroke();

        if (scale > 0.14) {
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(0.7, 1.0 * scale);
          ctx.stroke();
        }
      }
    }

    function drawRoads(city, sim, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY) {
      if (!city || !city.edgeCount) return;
      ensureCityCache(city);
      var ec = city.edgeCount;
      var lanesArr = city.lanes;
      var onewayArr = city.oneway;
      var clsArr = city.cls;
      var addedArr = city.added;
      var epts = city.epts;
      var hasLoadFn = sim && typeof sim.edgeLoad === 'function';
      var pad = 50 / scale;
      var vMinX = viewMinX - pad;
      var vMaxX = viewMaxX + pad;
      var vMinY = viewMinY - pad;
      var vMaxY = viewMaxY + pad;

      var i;
      for (i = 0; i < WIDTH_BUCKETS; i++) casingHead[i] = -1;
      for (i = 0; i < WIDTH_BUCKETS * COLOR_BUCKETS; i++) fillHead[i] = -1;
      var addedCount = 0;

      for (var e = 0; e < ec; e++) {
        if (edgeMaxX[e] < vMinX || edgeMinX[e] > vMaxX || edgeMaxY[e] < vMinY || edgeMinY[e] > vMaxY) continue;
        var cls = clsArr[e];
        var minPx = cls === 0 ? 3.2 : (cls === 1 ? 2.6 : (cls === 2 ? 1.8 : 1.2));
        var worldW = lanesArr[e] * (onewayArr[e] ? 1 : 2) * 3.5;
        var fillW = Math.max(minPx, worldW * scale);
        var wb = Math.round(Math.log(fillW / 1.2) / Math.log(1.22));
        if (wb < 0) wb = 0;
        if (wb >= WIDTH_BUCKETS) wb = WIDTH_BUCKETS - 1;

        var load = hasLoadFn ? sim.edgeLoad(city, e) : 0;
        var cb = Math.round(load * (COLOR_BUCKETS - 1));
        if (cb < 0) cb = 0;
        if (cb >= COLOR_BUCKETS) cb = COLOR_BUCKETS - 1;

        casingNext[e] = casingHead[wb];
        casingHead[wb] = e;

        var fbIdx = wb * COLOR_BUCKETS + cb;
        fillNext[e] = fillHead[fbIdx];
        fillHead[fbIdx] = e;

        if (addedArr && addedArr[e]) {
          addedEdges[addedCount++] = e;
        }
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2b2f38';
      for (var wbIdx = 0; wbIdx < WIDTH_BUCKETS; wbIdx++) {
        var head = casingHead[wbIdx];
        if (head === -1) continue;
        ctx.lineWidth = WIDTH_TABLE[wbIdx] + 1.2;
        ctx.beginPath();
        for (var ce = head; ce !== -1; ce = casingNext[ce]) {
          tracePolylineScreen(ctx, epts[ce], camX, camY, scale, halfW, halfH);
        }
        ctx.stroke();
      }

      if (addedCount > 0) {
        ctx.save();
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([6, 4]);
        for (var ai = 0; ai < addedCount; ai++) {
          var ae = addedEdges[ai];
          var acls = clsArr[ae];
          var aminPx = acls === 0 ? 3.2 : (acls === 1 ? 2.6 : (acls === 2 ? 1.8 : 1.2));
          var aworldW = lanesArr[ae] * (onewayArr[ae] ? 1 : 2) * 3.5;
          var afillW = Math.max(aminPx, aworldW * scale);
          ctx.lineWidth = afillW + 3.0;
          ctx.beginPath();
          tracePolylineScreen(ctx, epts[ae], camX, camY, scale, halfW, halfH);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var wIdx = 0; wIdx < WIDTH_BUCKETS; wIdx++) {
        ctx.lineWidth = WIDTH_TABLE[wIdx];
        var base = wIdx * COLOR_BUCKETS;
        for (var cIdx = 0; cIdx < COLOR_BUCKETS; cIdx++) {
          var fHead = fillHead[base + cIdx];
          if (fHead === -1) continue;
          ctx.strokeStyle = LOAD_COLORS[cIdx];
          ctx.beginPath();
          for (var fe = fHead; fe !== -1; fe = fillNext[fe]) {
            tracePolylineScreen(ctx, epts[fe], camX, camY, scale, halfW, halfH);
          }
          ctx.stroke();
        }
      }
    }

    function drawLandmarks(scen, artPlaces, camX, camY, scale, halfW, halfH, now) {
      var landmarks = scen && scen.landmarks;
      if (!landmarks || !landmarks.length || !artPlaces || typeof artPlaces.draw !== 'function') return;
      for (var i = 0; i < landmarks.length; i++) {
        var lm = landmarks[i];
        var cx = (lm.x - camX) * scale + halfW;
        var cy = (lm.y - camY) * scale + halfH;
        var bw = (lm.w > 0 ? lm.w : 120) * scale;
        var bh = (lm.h > 0 ? lm.h : 120) * scale;
        var shortest = Math.min(bw, bh);
        if (shortest < 26) {
          var k = 26 / shortest;
          bw *= k;
          bh *= k;
        }
        var ts = Math.min(bw, bh) * 0.5;
        var bx = cx - bw * 0.5;
        var by = cy - bh * 0.5;
        if (bx + bw < -8 || bx > cssW + 8 || by + bh < -8 || by - ts > cssH + 8) continue;
        artPlaces.draw(ctx, lm.kind, bx, by, bw, bh, ts, now, i);
      }
    }

    function drawJunctionUpgrades(city, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY) {
      if (!city || !city.nodeCount) return;
      var over = city.overpass;
      var lights = city.lights;
      if (!over && !lights) return;
      var showLights = scale > 0.03 && lights;
      var nx = city.nx;
      var ny = city.ny;
      var pad = 60 / scale;
      var vMinX = viewMinX - pad;
      var vMaxX = viewMaxX + pad;
      var vMinY = viewMinY - pad;
      var vMaxY = viewMaxY + pad;

      for (var n = 0; n < city.nodeCount; n++) {
        var hasOver = over && over[n];
        var hasLight = showLights && lights[n];
        if (!hasOver && !hasLight) continue;
        var wx = nx[n];
        var wy = ny[n];
        if (wx < vMinX || wx > vMaxX || wy < vMinY || wy > vMaxY) continue;
        var sx = (wx - camX) * scale + halfW;
        var sy = (wy - camY) * scale + halfH;
        if (hasOver) drawOverpassIcon(ctx, sx, sy, scale);
        if (hasLight) drawTrafficLightIcon(ctx, sx, sy, scale, hasOver);
      }
    }

    function drawCars(city, sim, artThings, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY) {
      if (!city || !city.cars || !city.cars.length || !sim || typeof sim.carPose !== 'function') return;
      var cars = city.cars;
      var len = cars.length;
      var i, pose, sx, sy;

      if (scale < 0.09) {
        if (scale < 0.03) return;
        var mPad = 20 / scale;
        var vMinX = viewMinX - mPad;
        var vMaxX = viewMaxX + mPad;
        var vMinY = viewMinY - mPad;
        var vMaxY = viewMaxY + mPad;
        ctx.beginPath();
        for (i = 0; i < len; i++) {
          pose = sim.carPose(city, cars[i]);
          if (!pose) continue;
          if (pose.x < vMinX || pose.x > vMaxX || pose.y < vMinY || pose.y > vMaxY) continue;
          sx = (pose.x - camX) * scale + halfW;
          sy = (pose.y - camY) * scale + halfH;
          ctx.rect(sx - 0.9, sy - 0.9, 1.8, 1.8);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
        return;
      }

      var ts = clamp(64 * scale, 10, 48);
      var hasArtCar = artThings && typeof artThings.car === 'function';
      for (i = 0; i < len; i++) {
        var car = cars[i];
        pose = sim.carPose(city, car);
        if (!pose) continue;
        sx = (pose.x - camX) * scale + halfW;
        sy = (pose.y - camY) * scale + halfH;
        if (sx < -ts || sx > cssW + ts || sy < -ts || sy > cssH + ts) continue;
        var seed = typeof car.id === 'number' ? car.id : i;
        var color = CAR_PALETTE[(seed >>> 0) % CAR_PALETTE.length];
        if (hasArtCar) {
          artThings.car(ctx, sx, sy, pose.angle, ts, color, seed);
        } else {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(pose.angle);
          ctx.fillStyle = color;
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          ctx.fillRect(-ts * 0.22, -ts * 0.12, ts * 0.44, ts * 0.24);
          ctx.strokeRect(-ts * 0.22, -ts * 0.12, ts * 0.44, ts * 0.24);
          ctx.restore();
        }
      }
    }

    function drawZones(scen, artThings, camX, camY, scale, halfW, halfH, lang) {
      var zones = scen && scen.zones;
      if (!zones || !zones.length) return;
      var pinR = clamp(12 + scale * 32, 11, 18);
      var labelTs = clamp(34 + scale * 30, 34, 44);
      var hasLabelFn = artThings && typeof artThings.label === 'function';

      for (var i = 0; i < zones.length; i++) {
        var z = zones[i];
        var sx = (z.x - camX) * scale + halfW;
        var sy = (z.y - camY) * scale + halfH;
        if (sx < -120 || sx > cssW + 120 || sy < -80 || sy > cssH + 80) continue;

        var isWork = z.kind === 'work';
        var col = isWork ? '#f59e0b' : '#2f7cf6';

        ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
        ctx.beginPath();
        ctx.arc(sx + 1, sy + 2, pinR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = col;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, pinR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (isWork) drawBriefcaseIcon(ctx, sx, sy, pinR);
        else drawHouseIcon(ctx, sx, sy, pinR);

        if (isWork || scale > 0.02) {
          var txt = z.name ? (z.name[lang] || z.name.mn || z.name.en || '') : '';
          if (txt && hasLabelFn) {
            artThings.label(ctx, txt, sx, sy + pinR + 11, labelTs, col);
          }
        }
      }
    }

    function drawPlaces(map, camX, camY, scale, halfW, halfH, lang) {
      if (scale <= 0.025 || !map || !map.places) return;
      var places = map.places;
      var fontSize = Math.round(clamp(10 + scale * 24, 11, 13));
      ctx.save();
      ctx.font = '700 ' + fontSize + 'px ' + FONT_STACK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(238, 241, 244, 0.85)';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#64748b';
      for (var i = 0; i < places.length; i++) {
        var p = places[i];
        var sx = (p.x - camX) * scale + halfW;
        var sy = (p.y - camY) * scale + halfH;
        if (sx < -90 || sx > cssW + 90 || sy < -25 || sy > cssH + 25) continue;
        var txt = p[lang] || p.mn || p.en || '';
        if (!txt) continue;
        ctx.strokeText(txt, sx, sy);
        ctx.fillText(txt, sx, sy);
      }
      ctx.restore();
    }

    function drawHotspots(city, hot, camX, camY, scale, halfW, halfH, now) {
      if (!hot || !hot.length || !city || !city.nx) return;
      ctx.save();
      ctx.font = '800 12px ' + FONT_STACK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var i = 0; i < hot.length; i++) {
        var n = hot[i];
        if (n < 0 || n >= city.nodeCount) continue;
        var sx = (city.nx[n] - camX) * scale + halfW;
        var sy = (city.ny[n] - camY) * scale + halfH;
        if (sx < -30 || sx > cssW + 30 || sy < -30 || sy > cssH + 30) continue;
        var pulse = 0.5 + 0.5 * Math.sin(now * 0.006 + i * 1.1);
        var r = 14 + pulse * 8;

        ctx.fillStyle = 'rgba(239, 68, 68, ' + (0.34 - pulse * 0.16).toFixed(3) + ')';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(sx, sy, 9.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText('!', sx, sy + 0.5);
      }
      ctx.restore();
    }

    function drawSelectionAndPending(city, view, sim, camX, camY, scale, halfW, halfH, now) {
      if (!city) return;
      var sel = view.selection;
      if (sel) {
        if (sel.type === 'node' && sel.id >= 0 && sel.id < city.nodeCount) {
          var sx = (city.nx[sel.id] - camX) * scale + halfW;
          var sy = (city.ny[sel.id] - camY) * scale + halfH;
          ctx.beginPath();
          ctx.arc(sx, sy, 13, 0, Math.PI * 2);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.6;
          ctx.stroke();
        } else if (sel.type === 'edge' && sel.id >= 0 && sel.id < city.edgeCount) {
          var e = sel.id;
          var pts = city.epts[e];
          if (pts && pts.length >= 4) {
            var cls = city.cls[e];
            var minPx = cls === 0 ? 3.2 : (cls === 1 ? 2.6 : (cls === 2 ? 1.8 : 1.2));
            var worldW = city.lanes[e] * (city.oneway[e] ? 1 : 2) * 3.5;
            var fillW = Math.max(minPx, worldW * scale);
            var load = sim && typeof sim.edgeLoad === 'function' ? sim.edgeLoad(city, e) : 0;

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            tracePolylineScreen(ctx, pts, camX, camY, scale, halfW, halfH);

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
            ctx.lineWidth = fillW + 10;
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = fillW + 4.5;
            ctx.stroke();

            ctx.strokeStyle = lerpColor(load);
            ctx.lineWidth = fillW;
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      var pend = view.pending;
      if (pend && pend.type === 'road') {
        var a = pend.a;
        var b = pend.b;
        if (a >= 0 && a < city.nodeCount && b >= 0 && b < city.nodeCount) {
          var ax = (city.nx[a] - camX) * scale + halfW;
          var ay = (city.ny[a] - camY) * scale + halfH;
          var bx = (city.nx[b] - camX) * scale + halfW;
          var by = (city.ny[b] - camY) * scale + halfH;
          var col = pend.ok ? '#22c55e' : '#ef4444';

          ctx.save();
          ctx.lineCap = 'round';
          ctx.setLineDash([8, 6]);
          ctx.lineDashOffset = -(now * 0.03) % 14;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
          ctx.lineWidth = 6;
          ctx.stroke();
          ctx.strokeStyle = col;
          ctx.lineWidth = 3.5;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;

          ctx.fillStyle = col;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ax, ay, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(bx, by, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    function drawEffects(camX, camY, scale, halfW, halfH, now) {
      if (!effects.length) return;
      for (var i = effects.length - 1; i >= 0; i--) {
        var eff = effects[i];
        if (eff.t0 < 0) eff.t0 = now;
        var age = now - eff.t0;
        if (age >= EFFECT_DURATION) {
          effects[i] = effects[effects.length - 1];
          effects.pop();
          continue;
        }
        var u = age < 0 ? 0 : age / EFFECT_DURATION;
        var inv = 1 - u;
        var sx = (eff.x - camX) * scale + halfW;
        var sy = (eff.y - camY) * scale + halfH;

        if (eff.type === 'built') {
          ctx.save();
          ctx.globalAlpha = inv;
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 1.5 + 3 * inv;
          ctx.beginPath();
          ctx.arc(sx, sy, 8 + u * 36, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, 4 + u * 22, 0, Math.PI * 2);
          ctx.stroke();

          var spDist = 10 + u * 30;
          var spSize = 2 + inv * 3.5;
          for (var s = 0; s < 6; s++) {
            var ang = (s * Math.PI) / 3 + u * 0.7;
            var px = sx + Math.cos(ang) * spDist;
            var py = sy + Math.sin(ang) * spDist;
            ctx.fillStyle = (s & 1) ? '#ffffff' : '#fde047';
            ctx.beginPath();
            ctx.moveTo(px, py - spSize);
            ctx.lineTo(px + spSize * 0.45, py);
            ctx.lineTo(px, py + spSize);
            ctx.lineTo(px - spSize * 0.45, py);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = inv;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
          ctx.beginPath();
          ctx.arc(sx, sy, 6 + u * 26, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5 + 2.5 * inv;
          ctx.beginPath();
          ctx.arc(sx, sy, 8 + u * 32, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    function drawRoundabouts(city, camX, camY, scale, halfW, halfH) {
      var ra = city && city.roundabout;
      if (!ra || !city.nx) return;
      var rad = Math.max(6, 28 * scale);
      ctx.save();
      for (var n = 0; n < city.nodeCount; n++) {
        if (!ra[n]) continue;
        var sx = (city.nx[n] - camX) * scale + halfW;
        var sy = (city.ny[n] - camY) * scale + halfH;
        if (sx < -30 || sx > cssW + 30 || sy < -30 || sy > cssH + 30) continue;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(3, rad * 0.55);
        ctx.strokeStyle = '#475569';
        ctx.stroke();
        ctx.fillStyle = '#4ade80';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawTargets(city, targets, camX, camY, scale, halfW, halfH, now) {
      if (!targets || !targets.length || !city || !city.nx) return;
      var pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
      var rad = 8 + pulse * 3;
      ctx.save();
      for (var i = 0; i < targets.length; i++) {
        var n = targets[i];
        if (n < 0 || n >= city.nodeCount) continue;
        var sx = (city.nx[n] - camX) * scale + halfW;
        var sy = (city.ny[n] - camY) * scale + halfH;
        if (sx < -20 || sx > cssW + 20 || sy < -20 || sy > cssH + 20) continue;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.stroke();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#facc15';
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawArea(area, lang, camX, camY, scale, halfW, halfH, now) {
      if (!area || !(area.r > 0)) return;
      var sx = (area.x - camX) * scale + halfW;
      var sy = (area.y - camY) * scale + halfH;
      var sr = area.r * scale;
      if (!isFinite(sx) || !isFinite(sy) || !isFinite(sr)) return;
      ctx.save();
      var g = ctx.createRadialGradient(sx, sy, sr, sx, sy, sr + 40);
      g.addColorStop(0, 'rgba(15, 23, 42, 0)');
      g.addColorStop(1, 'rgba(15, 23, 42, 0.42)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -now * 0.012;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      var name = area.name ? (area.name[lang] || area.name.mn || '') : '';
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx - 3, sy - 7, sx - 8, sy - 10, sx - 8, sy - 16);
      ctx.arc(sx, sy - 16, 8, Math.PI, 0);
      ctx.bezierCurveTo(sx + 8, sy - 10, sx + 3, sy - 7, sx, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(sx, sy - 16, 3, 0, Math.PI * 2);
      ctx.fill();
      if (name) {
        ctx.font = '800 12px ' + FONT_STACK;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var tw = ctx.measureText(name).width + 16;
        var ty = sy - 38;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(sx - tw / 2 + 10, ty, 10, Math.PI / 2, Math.PI * 1.5);
        ctx.arc(sx + tw / 2 - 10, ty, 10, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.fillText(name, sx, ty + 0.5);
      }
      ctx.restore();
    }

    function drawAttribution() {
      ctx.save();
      ctx.font = '500 9px ' + FONT_STACK;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.fillText('\u00a9 OpenStreetMap', cssW - 6, cssH - 4);
      ctx.restore();
    }

    function draw(city, view) {
      if (!hasCamera) fitCity(city);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var v = view || {};
      var now = typeof v.now === 'number' ? v.now : 0;
      lastNow = now;
      var lang = v.lang === 'en' ? 'en' : 'mn';

      var map = getMap();
      var scen = getScenario();
      var sim = getSim();
      var artPlaces = getArtPlaces();
      var artThings = getArtThings();

      ensureMapCache(map);

      var camX = cam.x;
      var camY = cam.y;
      var scale = cam.scale;
      var halfW = cssW * 0.5;
      var halfH = cssH * 0.5;
      var viewMinX = camX - halfW / scale;
      var viewMaxX = camX + halfW / scale;
      var viewMinY = camY - halfH / scale;
      var viewMaxY = camY + halfH / scale;

      drawGround(camX, camY, scale, halfW, halfH);
      drawGerDistricts(scen, artPlaces, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY, now);
      drawRivers(map, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY);
      drawRails(map, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY);
      drawRoads(city, sim, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY);
      drawLandmarks(scen, artPlaces, camX, camY, scale, halfW, halfH, now);
      drawJunctionUpgrades(city, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY);
      drawRoundabouts(city, camX, camY, scale, halfW, halfH);
      drawCars(city, sim, artThings, camX, camY, scale, halfW, halfH, viewMinX, viewMaxX, viewMinY, viewMaxY);
      drawZones(scen, artThings, camX, camY, scale, halfW, halfH, lang);
      drawPlaces(map, camX, camY, scale, halfW, halfH, lang);
      drawArea(v.area, lang, camX, camY, scale, halfW, halfH, now);
      drawTargets(city, v.targets, camX, camY, scale, halfW, halfH, now);
      drawHotspots(city, v.hot, camX, camY, scale, halfW, halfH, now);
      drawSelectionAndPending(city, v, sim, camX, camY, scale, halfW, halfH, now);
      drawEffects(camX, camY, scale, halfW, halfH, now);
      drawAttribution();
    }

    function effect(type, x, y) {
      effects.push({
        type: type === 'jam' ? 'jam' : 'built',
        x: x,
        y: y,
        t0: -1
      });
    }

    function clearEffects() {
      effects.length = 0;
    }

    resize();

    return {
      resize: resize,
      fitCity: fitCity,
      getCamera: getCamera,
      setCamera: setCamera,
      screenToWorld: screenToWorld,
      worldToScreen: worldToScreen,
      draw: draw,
      effect: effect,
      clearEffects: clearEffects
    };
  }

  var Render = {
    create: create
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Render;
  else root.Render = Render;
})(this);
