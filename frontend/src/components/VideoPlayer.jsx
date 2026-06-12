import { useRef, useEffect, useState } from 'react';
import { getInterpolatedValue } from '../utils/animations';
import TrackingOverlay from './TrackingOverlay';
import './VideoPlayer.css';

// ─── Разрешение трансформаций с учётом системы родителей ───────────────────
function resolveTransform(clip, allClips, playheadPos, visited = new Set()) {
  if (visited.has(clip.id)) return { x: 0, y: 0, scale: 100 }; // защита от цикла
  visited.add(clip.id);

  const x = getInterpolatedValue(clip, 'canvasX', playheadPos) || 0;
  const y = getInterpolatedValue(clip, 'canvasY', playheadPos) || 0;
  const scale = getInterpolatedValue(clip, 'scale', playheadPos) || 100;

  if (clip.parentId) {
    const parent = allClips.find(c => c.id === clip.parentId);
    if (parent) {
      const pt = resolveTransform(parent, allClips, playheadPos, visited);
      return {
        x: x + pt.x,
        y: y + pt.y,
        scale: scale * (pt.scale / 100),
      };
    }
  }

  return { x, y, scale };
}

// ─── Построение SVG-points для полигона ────────────────────────────────────
function polygonPoints(sides, size = 50) {
  const n = Math.max(3, sides || 3);
  return Array.from({ length: n }).map((_, i) => {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    return `${size + size * Math.cos(angle)},${size + size * Math.sin(angle)}`;
  }).join(' ');
}

// ─── Не нужны больше — используем реальный размер DOM ────────────────────

const VideoPlayer = ({
  isPlaying, setIsPlaying, onRender, isRendering,
  clips, playheadPos,
  trackingClipId, onTrackingComplete, onTrackingCancel,
}) => {
  const allClips = clips || [];
  const activeClips = allClips.filter(c => playheadPos >= c.x && playheadPos <= c.x + c.width);
  const videoRefs = useRef({});
  const [playerSize, setPlayerSize] = useState({ width: 0, height: 0 });
  const [trackingVideoEl, setTrackingVideoEl] = useState(null);
  const playerCanvasRef = useRef(null);

  // Клип для трекинга (нужен его <video> элемент)
  const trackingClip = trackingClipId ? allClips.find(c => c.id === trackingClipId) : null;

  // Получаем DOM-элемент видео для трекинга после рендера (не во время рендера)
  useEffect(() => {
    if (trackingClipId) {
      const el = videoRefs.current[trackingClipId] || null;
      setTrackingVideoEl(el);
    } else {
      setTrackingVideoEl(null);
    }
  }, [trackingClipId, activeClips]);

  // Измеряем реальный размер canvas сразу и следим за изменениями
  useEffect(() => {
    if (!playerCanvasRef.current) return;
    
    // Немедленное измерение (до ResizeObserver)
    const measure = () => {
      const rect = playerCanvasRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPlayerSize({ width: rect.width, height: rect.height });
      }
    };
    
    measure(); // сразу
    
    const obs = new ResizeObserver(() => measure());
    obs.observe(playerCanvasRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    activeClips.forEach(clip => {
      if (clip.type === 'video' || clip.type === 'audio') {
        const el = videoRefs.current[clip.id];
        if (el) {
          const targetTime = (playheadPos - clip.x) / 50;
          if (Math.abs(el.currentTime - targetTime) > 0.2) el.currentTime = targetTime;
          if (isPlaying && el.paused) el.play().catch(() => {});
          else if (!isPlaying && !el.paused) el.pause();
        }
      }
    });
  }, [playheadPos, activeClips, isPlaying]);

  // ── Рендер масок (SVG clipPath) ──────────────────────────────────────────
  const maskDefs = activeClips
    .filter(c => c.maskClipId)
    .map(c => {
      const maskClip = allClips.find(m => m.id === c.maskClipId);
      if (!maskClip || maskClip.type !== 'shape') return null;
      const mt = resolveTransform(maskClip, allClips, playheadPos);
      const size = mt.scale || 100;
      const cx = (1280 / 2) + mt.x;
      const cy = (720 / 2) + mt.y;

      let shape = null;
      if (maskClip.shapeType === 'square') {
        shape = <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} />;
      } else if (maskClip.shapeType === 'circle') {
        shape = <circle cx={cx} cy={cy} r={size / 2} />;
      } else if (maskClip.shapeType === 'diamond') {
        const s = size * 0.7;
        shape = <polygon points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`} />;
      } else if (maskClip.shapeType === 'polygon') {
        const n = Math.max(3, maskClip.sides || 3);
        const pts = Array.from({ length: n }).map((_, i) => {
          const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
          return `${cx + (size / 2) * Math.cos(angle)},${cy + (size / 2) * Math.sin(angle)}`;
        }).join(' ');
        shape = <polygon points={pts} />;
      }

      if (!shape) return null;
      return (
        <clipPath key={`cp-${c.id}`} id={`mask-${c.id}`}>
          {shape}
        </clipPath>
      );
    })
    .filter(Boolean);

  return (
    <div className="video-player-container">
      <div className="video-header">
        <span>Предпросмотр</span>
        <div className="video-controls">
          <button className="control-btn" onClick={onRender} disabled={isRendering}>
            {isRendering ? '⏳ Рендер...' : 'Экспорт 🎥'}
          </button>
          <button className="control-btn">1080p</button>
          <button className="control-btn">24 fps</button>
        </div>
      </div>

      <div
        ref={playerCanvasRef}
        className="player-canvas glass-panel"
        style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {playerSize.width > 0 && (
          <div style={{
            position: 'relative',
            width: 1280,
            height: 720,
            transform: `scale(${Math.min(playerSize.width / 1280, playerSize.height / 720)})`,
            transformOrigin: 'center center',
          }}>
        {/* SVG-маски */}
        {maskDefs.length > 0 && (
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>{maskDefs}</defs>
          </svg>
        )}

        {activeClips.length > 0 ? (
          activeClips.map(clip => {
            const t = resolveTransform(clip, allClips, playheadPos);
            const currentOpacity = getInterpolatedValue(clip, 'opacity', playheadPos) ?? 100;
            const maskStyle = clip.maskClipId ? { clipPath: `url(#mask-${clip.id})` } : {};

            return (
              <div key={clip.id} style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: Math.max(0, 100 - clip.track),
                ...maskStyle,
              }}>
                {clip.type === 'video' ? (
                  <video
                    ref={el => videoRefs.current[clip.id] = el}
                    src={`http://localhost:8000/${clip.name}`}
                    crossOrigin="anonymous"
                    style={{
                      width: '100%', height: '100%', objectFit: 'contain',
                      transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale / 100})`,
                      opacity: currentOpacity / 100,
                    }}
                    muted
                  />
                ) : clip.type === 'text' ? (
                  <span style={{
                    fontSize: `${t.scale / 2}px`,
                    color: clip.fillColor || 'white',
                    textShadow: '2px 2px 4px black',
                    fontWeight: 'bold',
                    opacity: currentOpacity / 100,
                    transform: `translate(${t.x}px, ${t.y}px)`,
                    userSelect: 'none',
                  }}>
                    {clip.text || clip.name}
                  </span>
                ) : clip.type === 'shape' ? (
                  // Если клип является маской для кого-то — не рендерим его самого
                  allClips.some(c => c.maskClipId === clip.id) ? null : (
                    <div style={{
                      opacity: currentOpacity / 100,
                      transform: `translate(${t.x}px, ${t.y}px)`,
                      width: `${t.scale}px`,
                      height: `${t.scale}px`,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      {clip.shapeType === 'square' && <div style={{ width: '100%', height: '100%', backgroundColor: clip.fillColor }} />}
                      {clip.shapeType === 'circle' && <div style={{ width: '100%', height: '100%', backgroundColor: clip.fillColor, borderRadius: '50%' }} />}
                      {clip.shapeType === 'diamond' && <div style={{ width: '70%', height: '70%', backgroundColor: clip.fillColor, transform: 'rotate(45deg)' }} />}
                      {clip.shapeType === 'polygon' && (
                        <svg viewBox="0 0 100 100" width="100%" height="100%">
                          <polygon points={polygonPoints(clip.sides)} fill={clip.fillColor} />
                        </svg>
                      )}
                    </div>
                  )
                ) : clip.type === 'image' ? (
                  <img
                    src={`http://localhost:8000/${clip.name}`}
                    style={{
                      maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                      transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale / 100})`,
                      opacity: currentOpacity / 100,
                    }}
                  />
                ) : clip.type === 'audio' ? (
                  <audio ref={el => videoRefs.current[clip.id] = el} crossOrigin="anonymous" src={`http://localhost:8000/${clip.name}`} />
                ) : clip.type === 'tracker' ? (
                  // Трекер — светящаяся точка с крестиком, привязывается к объекту
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${t.x}px), calc(-50% + ${t.y}px))`,
                    pointerEvents: 'none',
                    zIndex: 50,
                  }}>
                    {/* Внешнее кольцо */}
                    <div style={{
                      width: '20px', height: '20px',
                      border: '2px solid rgba(0,255,136,0.8)',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '-10px', left: '-10px',
                      boxShadow: '0 0 8px rgba(0,255,136,0.6)',
                    }} />
                    {/* Центральная точка */}
                    <div style={{
                      width: '4px', height: '4px',
                      background: '#00ff88',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '-2px', left: '-2px',
                      boxShadow: '0 0 6px #00ff88',
                    }} />
                    {/* Горизонтальная линия */}
                    <div style={{
                      width: '16px', height: '1px',
                      background: 'rgba(0,255,136,0.6)',
                      position: 'absolute',
                      top: '0', left: '-8px',
                    }} />
                    {/* Вертикальная линия */}
                    <div style={{
                      width: '1px', height: '16px',
                      background: 'rgba(0,255,136,0.6)',
                      position: 'absolute',
                      top: '-8px', left: '0',
                    }} />
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="placeholder-text">
            <span className="icon">🎬</span>
            <p>Переместите ползунок на таймлайне для предпросмотра</p>
          </div>
        )}

        {/* Оверлей трекинга теперь тоже живет внутри 1280x720, так что получает правильные размеры */}
        {trackingClipId && trackingClip && trackingVideoEl && (
          <TrackingOverlay
            videoEl={trackingVideoEl}
            clip={trackingClip}
            canvasSize={{ width: 1280, height: 720 }}
            onComplete={(keyframes) => onTrackingComplete(trackingClipId, keyframes)}
            onCancel={onTrackingCancel}
          />
        )}
          </div>
        )}
      </div>

      <div className="playback-controls glass-panel">
        <button className="play-btn" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="time-display">00:00:00 / 00:00:00</div>
      </div>
    </div>
  );
};

export default VideoPlayer;
