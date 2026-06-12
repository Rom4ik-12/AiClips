import { useState, useRef, useEffect, useCallback } from 'react';
import './Timeline.css';

const generateClipId = () => `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const Timeline = ({ clips, setClips, selectedItemId, setSelectedItemId, playheadPos, setPlayheadPos, tracks, onAddTrack, onUpdateTrack, onDeleteTrack }) => {
  const [editingTrackId, setEditingTrackId] = useState(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [draggingClipId, setDraggingClipId] = useState(null);
  const [draggingKeyframe, setDraggingKeyframe] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [resizingClip, setResizingClip] = useState(null);
  const [dragOverInfo, setDragOverInfo] = useState(null);
  
  const trackContentRef = useRef(null);

  const checkCollision = useCallback((newClipId, newTrack, newX, newWidth) => {
    return clips.some(c => 
      c.id !== newClipId && 
      c.track === newTrack && 
      newX < c.x + c.width && 
      newX + newWidth > c.x
    );
  }, [clips]);

  const updatePlayheadPos = useCallback((clientX) => {
    if (trackContentRef.current) {
      const rect = trackContentRef.current.getBoundingClientRect();
      let newX = clientX - rect.left;
      if (newX < 0) newX = 0;
      if (newX > rect.width) newX = rect.width;
      
      // Snapping к кейфреймам (магнит)
      let snappedX = newX;
      let minDiff = 10; // Радиус прилипания
      clips.forEach(c => {
        // Прилипание к границам клипа
        if (Math.abs(c.x - newX) < minDiff) {
          minDiff = Math.abs(c.x - newX);
          snappedX = c.x;
        }
        if (Math.abs(c.x + c.width - newX) < minDiff) {
          minDiff = Math.abs(c.x + c.width - newX);
          snappedX = c.x + c.width;
        }
        
        // Прилипание к ключам
        if (c.keyframes) {
          c.keyframes.forEach(kf => {
            const absoluteKfX = c.x + kf.x;
            if (Math.abs(absoluteKfX - newX) < minDiff) {
              minDiff = Math.abs(absoluteKfX - newX);
              snappedX = absoluteKfX;
            }
          });
        }
      });

      setPlayheadPos(snappedX);
    }
  }, [clips, setPlayheadPos]);

  const handleScaleMouseDown = (e) => {
    setIsDraggingPlayhead(true);
    updatePlayheadPos(e.clientX);
  };

  const handleClipMouseDown = (e, id) => {
    setSelectedItemId(id);
    setDraggingClipId(id);
    const clipRect = e.currentTarget.getBoundingClientRect();
    setDragOffset(e.clientX - clipRect.left);
    e.stopPropagation();
  };

  const handleKeyframeMouseDown = (e, clipId, keyframeId) => {
    e.stopPropagation();
    const kfRect = e.currentTarget.getBoundingClientRect();
    // Рассчитываем смещение мыши относительно центра ключа, а не левого края, чтобы он не "прыгал" вбок
    setDragOffset(e.clientX - (kfRect.left + kfRect.width / 2));
    setDraggingKeyframe({ clipId, keyframeId });
  };

  const handleResizeMouseDown = (e, id, direction) => {
    e.stopPropagation();
    const clip = clips.find(c => c.id === id);
    if (clip) {
      setResizingClip({ id, direction, initialWidth: clip.width, initialX: clip.x, initialMouseX: e.clientX });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingPlayhead) {
        updatePlayheadPos(e.clientX);
      } else if (draggingClipId && trackContentRef.current) {
        const rect = trackContentRef.current.getBoundingClientRect();
        let newX = e.clientX - rect.left - dragOffset;
        let newY = e.clientY - rect.top;
        if (newX < 0) newX = 0; // Предотвращаем уход за левый край
        
        let newTrack = Math.floor(newY / 60);
        if (newTrack < 0) newTrack = 0;
        if (newTrack > tracks.length - 1) newTrack = tracks.length - 1;

        const clip = clips.find(c => c.id === draggingClipId);
        if (clip) {
          // Магничивание перетаскиваемого клипа
          let snappedX = newX;
          let minSnapDiff = 10;
          
          // Проверяем прилипание к ползунку
          if (Math.abs(playheadPos - newX) < minSnapDiff) {
            minSnapDiff = Math.abs(playheadPos - newX);
            snappedX = playheadPos;
          }
          if (Math.abs(playheadPos - (newX + clip.width)) < minSnapDiff) {
            minSnapDiff = Math.abs(playheadPos - (newX + clip.width));
            snappedX = playheadPos - clip.width;
          }

          // Проверяем прилипание к другим клипам
          clips.forEach(c => {
            if (c.id === draggingClipId) return;
            // Прилипание левого края к краям других
            if (Math.abs(c.x - newX) < minSnapDiff) {
              minSnapDiff = Math.abs(c.x - newX);
              snappedX = c.x;
            }
            if (Math.abs(c.x + c.width - newX) < minSnapDiff) {
              minSnapDiff = Math.abs(c.x + c.width - newX);
              snappedX = c.x + c.width;
            }
            // Прилипание правого края к краям других
            if (Math.abs(c.x - (newX + clip.width)) < minSnapDiff) {
              minSnapDiff = Math.abs(c.x - (newX + clip.width));
              snappedX = c.x - clip.width;
            }
            if (Math.abs(c.x + c.width - (newX + clip.width)) < minSnapDiff) {
              minSnapDiff = Math.abs(c.x + c.width - (newX + clip.width));
              snappedX = c.x + c.width - clip.width;
            }
          });

          if (!checkCollision(clip.id, newTrack, snappedX < 0 ? 0 : snappedX, clip.width)) {
            setClips(prev => prev.map(c => c.id === draggingClipId ? { ...c, x: snappedX < 0 ? 0 : snappedX, track: newTrack } : c));
          }
        }
      } else if (draggingKeyframe && trackContentRef.current) {
        setClips(prev => prev.map(c => {
          if (c.id === draggingKeyframe.clipId) {
            const rect = trackContentRef.current.getBoundingClientRect();
            let newX = (e.clientX - rect.left) - c.x - dragOffset;
            if (newX < 0) newX = 0;
            if (newX > c.width) newX = c.width;
            return {
              ...c,
              keyframes: c.keyframes.map(kf => kf.id === draggingKeyframe.keyframeId ? { ...kf, x: newX } : kf)
            };
          }
          return c;
        }));
      } else if (resizingClip) {
        const deltaX = e.clientX - resizingClip.initialMouseX;
        setClips(prev => prev.map(c => {
          if (c.id === resizingClip.id) {
            let newWidth = c.width;
            let newX = c.x;
            
            if (resizingClip.direction === 'right') {
              newWidth = Math.max(20, resizingClip.initialWidth + deltaX);
              // Ограничение максимальной длины (заглушка 500px, пока нет реальных метаданных)
              if (newWidth > 500 && c.type !== 'text') newWidth = 500; 
            } else if (resizingClip.direction === 'left') {
              newWidth = Math.max(20, resizingClip.initialWidth - deltaX);
              if (newWidth > 500 && c.type !== 'text') {
                newWidth = 500;
                newX = c.x; // не меняем X если уперлись
              } else {
                newX = resizingClip.initialWidth - deltaX >= 20 ? resizingClip.initialX + deltaX : c.x;
              }
            }

            if (!checkCollision(c.id, c.track, newX < 0 ? 0 : newX, newWidth)) {
              return { ...c, width: newWidth, x: newX < 0 ? 0 : newX };
            }
          }
          return c;
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setDraggingClipId(null);
      setDraggingKeyframe(null);
      setResizingClip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, draggingClipId, draggingKeyframe, dragOffset, resizingClip, clips, setClips, playheadPos, updatePlayheadPos, checkCollision, tracks.length]);

  const handleTrackDragOver = (e, trackIndex) => {
    e.preventDefault();
    if (trackContentRef.current) {
      const rect = trackContentRef.current.getBoundingClientRect();
      let dropX = e.clientX - rect.left;
      if (dropX < 0) dropX = 0;
      setDragOverInfo({ x: dropX, track: trackIndex });
    }
  };

  const handleTrackDragLeave = () => {
    setDragOverInfo(null);
  };

  const handleTrackDrop = (e, trackIndex) => {
    e.preventDefault();
    setDragOverInfo(null);
    if (!trackContentRef.current) return;
    const rect = trackContentRef.current.getBoundingClientRect();
    let dropX = e.clientX - rect.left;
    if (dropX < 0) dropX = 0;

    const fileData = e.dataTransfer.getData('application/json');
    if (fileData) {
      try {
        const file = JSON.parse(fileData);
        const newClipId = generateClipId();
        
        let finalX = dropX;
        let finalTrack = trackIndex;
        if (checkCollision(newClipId, finalTrack, finalX, 200)) {
           finalX += 210; 
        }

        const newClip = {
          id: newClipId,
          type: file.type || 'video',
          shapeType: file.shapeType,
          name: file.name,
          text: file.type === 'text' ? 'Текст' : undefined,
          fillColor: file.fillColor,
          sides: file.sides,
          x: finalX,
          track: finalTrack,
          width: file.type === 'text' ? 150 : file.type === 'shape' ? 100 : 200,
          keyframes: []
        };
        setClips([...clips, newClip]);
        setSelectedItemId(newClip.id);
      } catch (err) {
        console.error("Ошибка парсинга дропа", err);
      }
    }
  };

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <div style={{ width: '250px', minWidth: '250px', borderRight: '1px solid var(--border-color)', background: 'var(--panel-bg)' }}></div>
        <div className="timeline-scale" onMouseDown={handleScaleMouseDown} style={{ cursor: 'pointer' }}>
          {Array.from({ length: 50 }).map((_, i) => {
            const timeInSeconds = i * 2; // Каждое большое деление = 2 секунды = 100px
            const formatTime = (secs) => {
              const m = Math.floor(secs / 60).toString().padStart(2, '0');
              const s = (secs % 60).toString().padStart(2, '0');
              return `${m}:${s}`;
            };
            return (
              <div key={i} className="scale-mark" style={{ left: `${i * 100}px` }}>
                <div className="scale-tick major"></div>
                <div className="scale-label">{formatTime(timeInSeconds)}</div>
                <div className="scale-tick minor" style={{ left: '50px' }}></div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="timeline-tracks">
        <div className="track-headers">
          {tracks.map((track) => (
            <div className="track-header" key={track.id}>
              {editingTrackId === track.id ? (
                <input
                  className="track-name-input"
                  autoFocus
                  defaultValue={track.name}
                  onBlur={(e) => {
                    onUpdateTrack(track.id, { name: e.target.value || track.name });
                    setEditingTrackId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onUpdateTrack(track.id, { name: e.target.value || track.name });
                      setEditingTrackId(null);
                    }
                    if (e.key === 'Escape') setEditingTrackId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="track-name"
                  onDoubleClick={() => setEditingTrackId(track.id)}
                  title="Двойной клик для переименования"
                >
                  {track.name}
                </span>
              )}
              <button
                className="track-delete-btn"
                onClick={() => onDeleteTrack(track.id)}
                title="Удалить дорожку"
              >×</button>
            </div>
          ))}
          <div className="track-header track-add-row">
            <button className="track-add-btn" onClick={() => onAddTrack()}>+ Дорожка</button>
          </div>
        </div>
        
        <div className="track-content" ref={trackContentRef}>
          <div 
            className="playhead-hitbox" 
            style={{ left: `${playheadPos}px` }}
            onMouseDown={handleScaleMouseDown}
          ></div>
          
          {tracks.map((track, trackIndex) => (
            <div 
              className="track"
              key={track.id}
              onDragOver={(e) => handleTrackDragOver(e, trackIndex)}
              onDragLeave={handleTrackDragLeave}
              onDrop={(e) => handleTrackDrop(e, trackIndex)}
            >
              {dragOverInfo && dragOverInfo.track === trackIndex && (
                <div className="ghost-clip" style={{ left: `${dragOverInfo.x}px`, width: '150px' }}></div>
              )}
              {clips.filter(c => c.track === trackIndex).map(clip => (
                <div 
                  key={clip.id}
                  className={`clip ${clip.type}-clip ${selectedItemId === clip.id ? 'selected' : ''}`} 
                  style={{ width: `${clip.width}px`, left: `${clip.x}px` }}
                  onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
                >
                  <div className="resize-handle left" onMouseDown={(e) => handleResizeMouseDown(e, clip.id, 'left')}></div>
                  <span className="clip-name">{clip.name}</span>
                  {(() => {
                    if (!clip.keyframes || clip.keyframes.length === 0) return null;
                    // Группируем по уникальным позициям (разные свойства на одной X считаем за одну точку)
                    const uniquePositions = [...new Set(clip.keyframes.map(kf => Math.round(kf.x)))];
                    const isManyKeyframes = uniquePositions.length > 8;

                    if (isManyKeyframes) {
                      // Много кейфреймов (трекинг) — показываем тонкую полоску с градиентом
                      return (
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.7), rgba(255,255,255,0.1))',
                          borderRadius: '0 0 4px 4px',
                          pointerEvents: 'none',
                        }} />
                      );
                    }

                    // Мало кейфреймов — рисуем отдельные ромбики
                    return clip.keyframes.map(kf => (
                      <div
                        key={kf.id}
                        className="keyframe"
                        style={{ left: `${kf.x}px` }}
                        onMouseDown={(e) => handleKeyframeMouseDown(e, clip.id, kf.id)}
                      />
                    ));
                  })()}
                  <div className="resize-handle right" onMouseDown={(e) => handleResizeMouseDown(e, clip.id, 'right')}></div>
                </div>
              ))}
            </div>
          ))}

          <div className="playhead-visual" style={{ left: `${playheadPos}px` }}>
            <div className="playhead-triangle" onMouseDown={handleScaleMouseDown}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
