/**
 * tracker.js — Lucas-Kanade Optical Flow на чистом JS + Canvas API.
 * Без внешних библиотек. Мгновенный запуск.
 */

// ─── Вспомогательные функции ────────────────────────────────────────────────

/** Нарисовать видео на canvas с objectFit:contain (как в DOM) */
function drawContain(ctx, video, cw, ch) {
  const vw = video.videoWidth || cw;
  const vh = video.videoHeight || ch;
  const s = Math.min(cw / vw, ch / vh);
  const dw = vw * s;
  const dh = vh * s;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(video, dx, dy, dw, dh);
}

/** Захватить кадр в grayscale Float32Array */
function captureGray(video, ctx, w, h) {
  drawContain(ctx, video, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return gray;
}

/** Получить пиксель с ограничением границ */
function px(gray, x, y, w, h) {
  return gray[Math.max(0, Math.min(h - 1, Math.round(y))) * w + Math.max(0, Math.min(w - 1, Math.round(x)))];
}

/** Вырезает квадратный патч (шаблон) из изображения */
function extractPatch(gray, cx, cy, w, h, patchSize) {
  const half = Math.floor(patchSize / 2);
  const patch = new Float32Array(patchSize * patchSize);
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      patch[(dy + half) * patchSize + (dx + half)] = px(gray, cx + dx, cy + dy, w, h);
    }
  }
  return patch;
}

/** Ищет наилучшее совпадение шаблона в радиусе (Block Matching / SAD) */
function matchTemplate(gray, cx, cy, w, h, template, patchSize, searchRadius) {
  const half = Math.floor(patchSize / 2);
  let bestX = cx;
  let bestY = cy;
  let minDiff = Infinity;

  // Ищем в сетке вокруг текущей позиции
  for (let sy = Math.floor(cy - searchRadius); sy <= Math.ceil(cy + searchRadius); sy++) {
    for (let sx = Math.floor(cx - searchRadius); sx <= Math.ceil(cx + searchRadius); sx++) {
      let diff = 0;
      for (let py = 0; py < patchSize; py++) {
        for (let pxCoord = 0; pxCoord < patchSize; pxCoord++) {
          const tVal = template[py * patchSize + pxCoord];
          const iVal = px(gray, sx + pxCoord - half, sy + py - half, w, h);
          diff += Math.abs(tVal - iVal);
        }
        // Ранний выход если уже хуже
        if (diff >= minDiff) break;
      }
      
      // Небольшой штраф за расстояние, чтобы точка не "прыгала" на похожие пиксели далеко
      const distSq = (sx - cx) * (sx - cx) + (sy - cy) * (sy - cy);
      const penalizedDiff = diff + distSq * 2; 

      if (penalizedDiff < minDiff) {
        minDiff = penalizedDiff;
        bestX = sx;
        bestY = sy;
      }
    }
  }
  return { x: bestX, y: bestY };
}

// ─── Основная функция ────────────────────────────────────────────────────────

/**
 * @param {HTMLVideoElement} videoEl
 * @param {{ x: number, y: number }} startPoint — клик в пикселях playerSize
 * @param {number} canvasWidth  — ширина player-canvas DOM элемента
 * @param {number} canvasHeight — высота player-canvas DOM элемента
 * @param {function} onProgress — (current, total, screenPoint) => void
 *   screenPoint = { x, y } — текущая позиция в пикселях playerSize для отрисовки
 */
export async function trackPoint(videoEl, startPoint, canvasWidth, canvasHeight, onProgress) {
  const duration = videoEl.duration;
  if (!duration || isNaN(duration)) throw new Error('Видео не загружено');

  // Рабочий canvas: та же пропорция что у player-canvas, уменьшенный для скорости
  const downscale = Math.min(1, 480 / canvasWidth);
  const W = Math.round(canvasWidth * downscale);
  const H = Math.round(canvasHeight * downscale);

  const FPS = 15;
  const totalFrames = Math.min(Math.floor(duration * FPS), 200);
  const dt = 1 / FPS;

  const oc = document.createElement('canvas');
  oc.width = W; oc.height = H;
  const ctx = oc.getContext('2d', { willReadFrequently: true, alpha: false });

  // Начальная точка: конвертируем из playerSize -> рабочий canvas (та же пропорция)
  let cx = startPoint.x * downscale;
  let cy = startPoint.y * downscale;

  const results = [];

  // Функция обратной конвертации: рабочий canvas -> playerSize
  const toScreen = (x, y) => ({ x: x / downscale, y: y / downscale });

  // Точка старта: время, на котором юзер поставил паузу и кликнул
  const startTime = videoEl.currentTime;

  // Извлекаем шаблон именно с этого кадра!
  let prevGray = captureGray(videoEl, ctx, W, H);
  
  const patchSize = 21;
  const searchRadius = 30;
  const template = extractPatch(prevGray, cx, cy, W, H, patchSize);

  const sp = toScreen(cx, cy);
  results.push({ timePos: startTime, screenX: sp.x, screenY: sp.y });

  // Считаем шаги (dt и totalFrames уже объявлены выше)
  let framesDone = 0;

  // 1. Трекаем ВПЕРЕД от текущей позиции до конца
  let currX = cx;
  let currY = cy;
  for (let t = startTime + dt; t <= duration; t += dt) {
    await seekTo(videoEl, t);
    const nextGray = captureGray(videoEl, ctx, W, H);
    
    const r = matchTemplate(nextGray, currX, currY, W, H, template, patchSize, searchRadius);
    currX = Math.max(0, Math.min(W - 1, r.x));
    currY = Math.max(0, Math.min(H - 1, r.y));

    const screenPt = toScreen(currX, currY);
    results.push({ timePos: t, screenX: screenPt.x, screenY: screenPt.y });
    
    framesDone++;
    if (onProgress) onProgress(framesDone, totalFrames, screenPt);

    // Уступаем управление event loop, чтобы UI не зависал
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // 2. Трекаем НАЗАД от текущей позиции до начала
  currX = cx;
  currY = cy;
  for (let t = startTime - dt; t >= 0; t -= dt) {
    await seekTo(videoEl, t);
    const nextGray = captureGray(videoEl, ctx, W, H);
    
    const r = matchTemplate(nextGray, currX, currY, W, H, template, patchSize, searchRadius);
    currX = Math.max(0, Math.min(W - 1, r.x));
    currY = Math.max(0, Math.min(H - 1, r.y));

    const screenPt = toScreen(currX, currY);
    results.push({ timePos: t, screenX: screenPt.x, screenY: screenPt.y });
    
    framesDone++;
    if (onProgress) onProgress(framesDone, totalFrames, screenPt);

    // Уступаем управление event loop, чтобы UI не зависал
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Сортируем результаты по времени, чтобы ключи шли по порядку
  results.sort((a, b) => a.timePos - b.timePos);

  // Возвращаем видео на исходную позицию
  await seekTo(videoEl, startTime);

  return results;
}

/** Seek и дождаться */
function seekTo(video, time) {
  return new Promise(resolve => {
    const done = () => { video.removeEventListener('seeked', done); resolve(); };
    video.addEventListener('seeked', done);
    video.currentTime = time;
  });
}

/**
 * Конвертирует результаты трекинга в кейфреймы.
 * screenX/screenY — позиция в пикселях playerSize.
 * canvasX/canvasY в VideoPlayer — это смещение от центра.
 */
export function trackingDataToKeyframes(trackingData, playerWidth, playerHeight) {
  const centerX = playerWidth / 2;
  const centerY = playerHeight / 2;

  const step = Math.max(1, Math.floor(trackingData.length / 40));
  const sampled = trackingData.filter((_, i) => i % step === 0);

  const xKf = sampled.map((pt, i) => ({
    id: `kf-tx-${Date.now()}-${i}`,
    x: pt.timePos * 50,  // 50px = 1 sec
    property: 'canvasX',
    value: Math.round(pt.screenX - centerX),
  }));

  const yKf = sampled.map((pt, i) => ({
    id: `kf-ty-${Date.now()}-${i}`,
    x: pt.timePos * 50,
    property: 'canvasY',
    value: Math.round(pt.screenY - centerY),
  }));

  return [...xKf, ...yKf];
}

export function loadOpenCV() { return Promise.resolve(true); }
