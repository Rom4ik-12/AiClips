import { useRef, useState, useEffect } from 'react';
import { loadOpenCV, trackPoint, trackingDataToKeyframes } from '../utils/tracker';
import './TrackingOverlay.css';

/**
 * Оверлей поверх VideoPlayer для выбора точки трекинга.
 *
 * Props:
 *   videoEl      — HTMLVideoElement для трекинга
 *   clip         — объект клипа (нужен clip.x для смещения кейфреймов)
 *   canvasSize   — { width, height } размер canvas предпросмотра
 *   onComplete   — callback(keyframes[]) — вызывается с готовыми кейфреймами
 *   onCancel     — callback() — закрыть оверлей
 */
const TrackingOverlay = ({ videoEl, canvasSize, onComplete, onCancel }) => {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('pick');   // 'pick' | 'loading' | 'tracking' | 'done'
  const [cvLoaded, setCvLoaded] = useState(false);
  const [cvError, setCvError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pickedPoint, setPickedPoint] = useState(null);
  const abortRef = useRef(false);

  // loadOpenCV теперь возвращает мгновенно (чистый JS, без зависимостей)
  useEffect(() => {
    loadOpenCV()
      .then(() => {
        setCvLoaded(true);
        setPhase('pick');
      })
      .catch((e) => {
        setCvError(e.message);
        setPhase('pick');
      });
  }, []);

  // Рисуем кружок на canvas поверх видео при выборе точки
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (pickedPoint) {
      // Прицел
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pickedPoint.x, pickedPoint.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      // Крестик
      ctx.beginPath();
      ctx.moveTo(pickedPoint.x - 18, pickedPoint.y);
      ctx.lineTo(pickedPoint.x + 18, pickedPoint.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pickedPoint.x, pickedPoint.y - 18);
      ctx.lineTo(pickedPoint.x, pickedPoint.y + 18);
      ctx.stroke();
    }
  }, [pickedPoint]);

  const handleCanvasClick = (e) => {
    if (phase !== 'pick') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasSize.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasSize.height / rect.height);
    setPickedPoint({ x, y });
  };

  const handleStart = async () => {
    if (!pickedPoint || !cvLoaded || !videoEl) return;
    abortRef.current = false;
    setPhase('tracking');
    setProgress({ current: 0, total: 0 });

    try {
      const data = await trackPoint(
        videoEl,
        pickedPoint,
        canvasSize.width,
        canvasSize.height,
        (current, total, screenPoint) => {
          if (abortRef.current) return;
          setProgress({ current, total });
          if (screenPoint) {
            setPickedPoint(screenPoint); // Обновляем точку на экране в реальном времени
          }
        }
      );

      if (!abortRef.current) {
        // Передаём размеры playerCanvas чтобы перевести в локальные координаты от центра
        const keyframes = trackingDataToKeyframes(data, canvasSize.width, canvasSize.height);
        setPhase('done');
        onComplete(keyframes);
      }
    } catch (err) {
      setCvError(err.message);
      setPhase('pick');
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
    onCancel();
  };

  const progressPercent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="tracking-overlay">
      {/* Canvas поверх видео для клика */}
      <canvas
        ref={canvasRef}
        className="tracking-canvas"
        width={canvasSize.width}
        height={canvasSize.height}
        onClick={handleCanvasClick}
        style={{ cursor: phase === 'pick' ? 'crosshair' : 'default' }}
      />

      {/* Панель управления */}
      <div className="tracking-panel">
        {phase === 'loading' && (
          <div className="tracking-status">
            <div className="tracking-spinner" />
            <span>Загрузка OpenCV.js...</span>
          </div>
        )}

        {phase === 'pick' && (
          <>
            <div className="tracking-instructions">
              {cvError ? (
                <span className="tracking-error">⚠ {cvError}</span>
              ) : (
                <span>
                  {pickedPoint
                    ? '✅ Точка выбрана. Нажмите «Начать трекинг»'
                    : '🎯 Кликните на объект в видео который нужно отследить'}
                </span>
              )}
            </div>
            <div className="tracking-buttons">
              <button
                className="track-btn track-btn-start"
                onClick={handleStart}
                disabled={!pickedPoint || !cvLoaded || !!cvError}
              >
                ▶ Начать трекинг
              </button>
              <button className="track-btn track-btn-cancel" onClick={handleCancel}>
                ✕ Отмена
              </button>
            </div>
          </>
        )}

        {phase === 'tracking' && (
          <div className="tracking-status">
            <div className="tracking-progress-bar">
              <div
                className="tracking-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span>Анализ кадра {progress.current} / {progress.total} ({progressPercent}%)</span>
            <button className="track-btn track-btn-cancel" onClick={handleCancel}>
              Отмена
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="tracking-status">
            <span>✅ Трекинг завершён! Кейфреймы добавлены.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackingOverlay;
