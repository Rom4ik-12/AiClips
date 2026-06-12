import { useState, useEffect, useRef, useCallback } from 'react';
import VideoPlayer from './components/VideoPlayer';
import Timeline from './components/Timeline';
import PropertiesPanel from './components/PropertiesPanel';
import MediaBin from './components/MediaBin';
import McpHelp from './components/McpHelp';
import { renderVideo } from './api';
import './index.css';

const initialClips = [];
const initialTracks = [
  { id: 'track-0', name: 'V1', type: 'video' },
  { id: 'track-1', name: 'T1', type: 'text' },
  { id: 'track-2', name: 'A1', type: 'audio' },
];

function App() {
  const [clips, setClipsRaw] = useState(initialClips);
  const [wsStatus, setWsStatus] = useState("Подключение...");
  const historyRef = useRef([initialClips]);
  const historyIndexRef = useRef(0);
  const debounceTimerRef = useRef(null);

  const saveHistory = useCallback((newClips) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (historyRef.current[historyIndexRef.current] === newClips) return;
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(newClips);
      if (newHistory.length > 50) newHistory.shift();
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
    }, 400); // Сохраняем состояние если не было изменений 400мс
  }, []);

  const setClips = useCallback((action) => {
    setClipsRaw(prev => {
      const newClips = typeof action === 'function' ? action(prev) : action;
      saveHistory(newClips);
      return newClips;
    });
  }, [saveHistory]);

  const undo = () => {
    if (historyIndexRef.current > 0) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      historyIndexRef.current -= 1;
      setClipsRaw(historyRef.current[historyIndexRef.current]);
    }
  };

  const redo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      historyIndexRef.current += 1;
      setClipsRaw(historyRef.current[historyIndexRef.current]);
    }
  };

  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [outputVideoUrl, setOutputVideoUrl] = useState(null);
  const [playheadPos, setPlayheadPos] = useState(200);
  const [trackingClipId, setTrackingClipId] = useState(null);
  const [tracks, setTracks] = useState(initialTracks);

  const addTrack = (type = 'video') => {
    const index = tracks.length;
    const typePrefix = type === 'audio' ? 'A' : type === 'text' ? 'T' : 'V';
    setTracks(prev => [...prev, { id: `track-${Date.now()}`, name: `${typePrefix}${index + 1}`, type }]);
  };

  const updateTrack = (id, updates) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTrack = (id) => {
    const index = tracks.findIndex(t => t.id === id);
    if (index < 0) return;
    if (clips.some(c => c.track === index)) {
      alert('Нельзя удалить дорожку с клипами');
      return;
    }
    setTracks(prev => prev.filter(t => t.id !== id));
  };

  // Глобальные горячие клавиши (Delete, Space, Undo, Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Игнорируем если фокус в инпуте
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault(); // чтобы страница не скроллилась
        setIsPlaying(prev => !prev);
        return;
      }

      if (e.key === 'Delete' && selectedItemId) {
        setClips(prev => prev.filter(c => c.id !== selectedItemId));
        setSelectedItemId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, setClips]);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlayheadPos(p => p + 1.5); // Скорость проигрывания (approx 50px/sec при 33ms)
      }, 33);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const selectedClip = clips.find(c => c.id === selectedItemId);

  const handleRenderRef = useRef(null);

  const handleRender = useCallback(async () => {
    setIsRendering(true);
    try {
      const currentClips = historyRef.current[historyIndexRef.current];
      const res = await renderVideo(currentClips);
      setOutputVideoUrl(`http://localhost:8000/static/${res.file}?t=${Date.now()}`);
    } catch (e) {
      alert('Ошибка рендера: ' + e.message);
    } finally {
      setIsRendering(false);
    }
  }, []);

  useEffect(() => {
    handleRenderRef.current = handleRender;
  }, [handleRender]);

  const wsRef = useRef(null);
  
  useEffect(() => {
    let isUnmounted = false;

    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus("Подключено");
      };

      ws.onmessage = (event) => {
        try {
          const action = JSON.parse(event.data);
          if (action.type === 'ADD_CLIP') {
            setClipsRaw(prev => {
              const newClips = [...prev, action.payload];
              saveHistory(newClips);
              return newClips;
            });
          } else if (action.type === 'UPDATE_CLIP') {
            setClipsRaw(prev => {
              const newClips = prev.map(c => c.id === action.payload.id ? { ...c, ...action.payload.updates } : c);
              saveHistory(newClips);
              return newClips;
            });
          } else if (action.type === 'DELETE_CLIP') {
            setClipsRaw(prev => {
              const newClips = prev.filter(c => c.id !== action.payload.id);
              saveHistory(newClips);
              return newClips;
            });
          } else if (action.type === 'RENDER_VIDEO') {
            if (handleRenderRef.current) handleRenderRef.current();
          }
        } catch (e) {
          console.error("WS parse error", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WS Error:", e);
        setWsStatus("Ошибка сети");
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          setWsStatus("Переподключение...");
          setTimeout(connectWebSocket, 2000); // Авто-реконнект
        }
      };
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (wsRef.current) wsRef.current.close();
    };
  }, [saveHistory]);

  // Синхронизация состояния с MCP (Backend)
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SYNC_STATE', payload: clips }));
    } else if (wsRef.current) {
      // Если сокет еще не открыт, отправляем при открытии
      wsRef.current.addEventListener('open', () => {
        wsRef.current.send(JSON.stringify({ type: 'SYNC_STATE', payload: clips }));
      }, { once: true });
    }
  }, [clips]);

  const updateClip = (id, newProps) => {
    setClips(prev => prev.map(c => {
      if (c.id !== id) return c;
      
      const updatedClip = { ...c };
      let keyframesUpdated = false;
      const relativeX = playheadPos - c.x;
      const overClip = relativeX >= 0 && relativeX <= c.width;

      Object.keys(newProps).forEach(prop => {
        // Игнорируем авто-кейфрейм для неанимируемых свойств (например, текст)
        if (prop === 'text' || prop === 'name') {
          updatedClip[prop] = newProps[prop];
          return;
        }

        const hasKeys = c.keyframes && c.keyframes.some(kf => kf.property === prop);
        
        if (hasKeys && overClip) {
          // Auto-keyframe: обновляем текущий ключ или создаем новый
          if (!updatedClip.keyframes) updatedClip.keyframes = [];
          const existingIndex = updatedClip.keyframes.findIndex(kf => kf.property === prop && Math.abs(kf.x - relativeX) < 5);
          
          if (existingIndex >= 0) {
            updatedClip.keyframes[existingIndex] = { ...updatedClip.keyframes[existingIndex], value: newProps[prop] };
          } else {
            updatedClip.keyframes.push({
              id: `kf-${Date.now()}-${prop}`,
              x: relativeX,
              property: prop,
              value: newProps[prop]
            });
          }
          keyframesUpdated = true;
        } else {
          updatedClip[prop] = newProps[prop];
        }
      });
      
      if (keyframesUpdated) {
        updatedClip.keyframes = [...updatedClip.keyframes];
      }
      return updatedClip;
    }));
  };

  const handleToggleKeyframe = (clipId, property) => {
    setClips(prev => prev.map(c => {
      if (c.id === clipId) {
        const relativeX = playheadPos - c.x;
        // Разрешаем ставить ключи только если ползунок над клипом
        if (relativeX < 0 || relativeX > c.width) return c; 
        
        const keyframes = c.keyframes || [];
        const existingIndex = keyframes.findIndex(kf => kf.property === property && Math.abs(kf.x - relativeX) < 5);
        
        let newKeyframes = [...keyframes];
        if (existingIndex >= 0) {
          newKeyframes.splice(existingIndex, 1); // Удаляем
        } else {
          newKeyframes.push({
            id: `kf-${Date.now()}`,
            x: relativeX,
            property: property,
            value: c[property]
          }); // Добавляем
        }
        return { ...c, keyframes: newKeyframes };
      }
      return c;
    }));
  };

  const getDefaultTrack = (type) => {
    const preferred = type === 'audio' ? 'audio' : type === 'text' || type === 'shape' || type === 'tracker' ? 'text' : 'video';
    const index = tracks.findIndex(t => t.type === preferred);
    return index >= 0 ? index : 0;
  };

  const handleAddClip = (file) => {
    const newClip = {
      id: `video-${Date.now()}`,
      type: 'video',
      name: `uploads/${file.name}`,
      x: 0,
      track: getDefaultTrack('video'),
      width: 200,
      keyframes: []
    };
    setClips([...clips, newClip]);
  };

  // Трекинг: создаём отдельный клип-трекер (null object) с кейфреймами движения
  const handleTrackingResult = (clipId, keyframes) => {
    const sourceClip = clips.find(c => c.id === clipId);
    if (!sourceClip) { setTrackingClipId(null); return; }

    // Создаём новый клип типа "tracker" — видимая точка на экране
    const trackerClip = {
      id: `tracker-${Date.now()}`,
      type: 'tracker',
      name: `Трекер`,
      x: sourceClip.x,
      track: getDefaultTrack('tracker'),
      width: sourceClip.width,
      keyframes,
      canvasX: 0,
      canvasY: 0,
    };

    setClips(prev => [...prev, trackerClip]);
    setTrackingClipId(null);
  };

  return (
    <div className="app-container">
      <div className="top-section">
        <MediaBin onAddClip={handleAddClip} />
        <div className="player-section">
          <div className="header-right">
            <span style={{color: wsStatus === "Подключено" ? '#4ade80' : '#f87171', marginRight: '15px', fontSize: '12px', display: 'inline-flex', alignItems: 'center'}}>
              ● MCP: {wsStatus}
              <McpHelp />
            </span>
            <button className="export-btn" onClick={handleRender}>Экспорт</button>
            <div className="settings-badge">1080p</div>
          </div>
          <VideoPlayer 
            isPlaying={isPlaying} 
            setIsPlaying={setIsPlaying} 
            onRender={handleRender} 
            isRendering={isRendering}
            outputVideoUrl={outputVideoUrl} 
            clips={clips}
            playheadPos={playheadPos}
            trackingClipId={trackingClipId}
            onTrackingComplete={handleTrackingResult}
            onTrackingCancel={() => setTrackingClipId(null)}
          />
        </div>
        <div className="properties-section">
          <PropertiesPanel 
            selectedClip={selectedClip}
            allClips={clips}
            onUpdate={updateClip} 
            playheadPos={playheadPos}
            onToggleKeyframe={handleToggleKeyframe}
            onStartTracking={(clipId) => setTrackingClipId(clipId)}
          />
        </div>
      </div>
      <div className="timeline-section">
        <Timeline 
          clips={clips} 
          setClips={setClips} 
          selectedItemId={selectedItemId} 
          setSelectedItemId={setSelectedItemId}
          playheadPos={playheadPos}
          setPlayheadPos={setPlayheadPos}
          tracks={tracks}
          onAddTrack={addTrack}
          onUpdateTrack={updateTrack}
          onDeleteTrack={deleteTrack}
        />
      </div>

      {/* Модальное окно рендера */}
      {(isRendering || outputVideoUrl) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#1a1b23', padding: '30px', borderRadius: '12px',
            width: '600px', maxWidth: '90%', border: '1px solid #333',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)', textAlign: 'center'
          }}>
            {isRendering ? (
              <>
                <h2 style={{ color: 'white', marginBottom: '20px', fontSize: '24px' }}>⏳ Рендеринг видео...</h2>
                <div style={{ width: '100%', height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: '30%', height: '100%', background: '#6366f1', 
                    borderRadius: '3px', animation: 'progress 1.5s infinite ease-in-out' 
                  }} />
                </div>
                <style>{`
                  @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(350%); }
                  }
                `}</style>
                <p style={{ color: '#aaa', marginTop: '20px' }}>Бэкенд генерирует финальное видео. Пожалуйста, подождите.</p>
              </>
            ) : (
              <>
                <h2 style={{ color: '#00ff88', marginBottom: '20px', fontSize: '24px' }}>✅ Видео готово!</h2>
                <video src={outputVideoUrl} controls style={{ width: '100%', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#000' }} />
                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <a 
                    href={outputVideoUrl} 
                    download="rendered_video.mp4"
                    target="_blank"
                    style={{
                      padding: '12px 24px', background: '#6366f1', color: 'white', 
                      textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold',
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      transition: 'background 0.2s'
                    }}
                  >
                    ⬇ Скачать видео
                  </a>
                  <button 
                    onClick={() => setOutputVideoUrl(null)}
                    style={{
                      padding: '12px 24px', background: '#333', color: 'white', 
                      border: 'none', borderRadius: '6px', cursor: 'pointer',
                      fontWeight: 'bold', transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#444'}
                    onMouseOut={(e) => e.target.style.background = '#333'}
                  >
                    Закрыть
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
