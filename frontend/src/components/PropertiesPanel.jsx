import { getInterpolatedValue } from '../utils/animations';
import './PropertiesPanel.css';

const PropertiesPanel = ({ selectedClip, allClips, onUpdate, playheadPos, onToggleKeyframe, onStartTracking }) => {
  if (!selectedClip) {
    return (
      <div className="properties-container">
        <div className="panel-header"><span>Свойства</span></div>
        <div className="properties-content">
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Выберите клип на таймлайне</p>
        </div>
      </div>
    );
  }

  const handleChange = (field, value) => {
    onUpdate(selectedClip.id, { [field]: value });
  };

  const handleLabelMouseDown = (e, field, currentValue) => {
    // Блокируем нативное выделение текста и фокус
    e.preventDefault();
    
    const startX = e.clientX;
    const startValue = Number(currentValue) || 0;
    let isDragging = false;
    const target = e.target;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (Math.abs(deltaX) > 2) {
        isDragging = true;
        handleChange(field, startValue + deltaX);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Если мы просто кликнули (без перетаскивания) по инпуту — ставим фокус вручную
      if (!isDragging && target.tagName === 'INPUT') {
        target.focus();
        target.select(); // Сразу выделяем всё число для удобства
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const hasKeyframe = (propName) => {
    if (!selectedClip.keyframes) return false;
    const relativeX = playheadPos - selectedClip.x;
    return selectedClip.keyframes.some(kf => kf.property === propName && Math.abs(kf.x - relativeX) < 5);
  };

  const getDisplayValue = (propName) => {
    return Math.round(getInterpolatedValue(selectedClip, propName, playheadPos));
  };

  return (
    <div className="properties-container">
      <div className="panel-header">
        <span>Свойства ({selectedClip.type === 'video' ? 'Видео' : selectedClip.type === 'text' ? 'Текст' : selectedClip.type === 'shape' ? 'Фигура' : 'Аудио'})</span>
      </div>
      
      <div className="properties-content">
        {selectedClip.type === 'text' && (
          <>
            <div className="property-group">
              <label>Текст</label>
              <input 
                type="text" 
                className="prop-input" 
                value={selectedClip.text || selectedClip.name || ''} 
                onChange={(e) => handleChange('text', e.target.value)}
              />
            </div>
            <div className="property-group">
              <label>Шрифт</label>
              <select className="prop-input">
                <option>Inter</option>
                <option>Roboto</option>
              </select>
            </div>
            <div className="property-row">
              <div className="property-group">
                <label 
                  style={{ cursor: 'ew-resize' }} 
                  onMouseDown={(e) => handleLabelMouseDown(e, 'scale', selectedClip.scale || 100)}
                >Размер</label>
                <div className="input-with-keyframe">
                  <input 
                    type="number" 
                    className="prop-input" 
                    style={{ cursor: 'ew-resize' }}
                    value={getDisplayValue('scale')}
                    onChange={(e) => handleChange('scale', Number(e.target.value))}
                    onMouseDown={(e) => handleLabelMouseDown(e, 'scale', selectedClip.scale || 100)}
                  />
                  <button 
                    className={`keyframe-btn ${hasKeyframe('scale') ? 'active' : ''}`}
                    onClick={() => onToggleKeyframe(selectedClip.id, 'scale')}
                    title="Toggle Keyframe"
                  >♦</button>
                </div>
              </div>
              <div className="property-group">
                <label>Цвет</label>
                <input type="color" className="color-picker-input" defaultValue="#ffffff" />
              </div>
            </div>
          </>
        )}

        {selectedClip.type === 'shape' && (
          <>
            <div className="property-group">
              <label>Цвет заливки</label>
              <input 
                type="color" 
                className="color-picker-input" 
                value={selectedClip.fillColor || '#ffffff'}
                onChange={(e) => handleChange('fillColor', e.target.value)}
              />
            </div>
            {selectedClip.shapeType === 'polygon' && (
              <div className="property-group">
                <label 
                  style={{ cursor: 'ew-resize' }} 
                  onMouseDown={(e) => handleLabelMouseDown(e, 'sides', selectedClip.sides || 3)}
                >Количество углов</label>
                <input
                  type="number"
                  className="prop-input"
                  min="3"
                  max="12"
                  style={{ cursor: 'ew-resize' }}
                  value={selectedClip.sides || 3}
                  onChange={(e) => handleChange('sides', Number(e.target.value))}
                  onMouseDown={(e) => handleLabelMouseDown(e, 'sides', selectedClip.sides || 3)}
                />
              </div>
            )}
            <div className="property-group">
              <label 
                style={{ cursor: 'ew-resize' }} 
                onMouseDown={(e) => handleLabelMouseDown(e, 'scale', selectedClip.scale || 100)}
              >Масштаб (%)</label>
              <div className="input-with-keyframe">
                <input
                  type="number"
                  className="prop-input"
                  style={{ cursor: 'ew-resize' }}
                  value={getDisplayValue('scale')}
                  onChange={(e) => handleChange('scale', Number(e.target.value))}
                  onMouseDown={(e) => handleLabelMouseDown(e, 'scale', selectedClip.scale || 100)}
                />
                <button 
                  className={`keyframe-btn ${hasKeyframe('scale') ? 'active' : ''}`}
                  onClick={() => onToggleKeyframe(selectedClip.id, 'scale')}
                  title="Toggle Keyframe"
                >♦</button>
              </div>
            </div>
            <div className="property-group">
              <label 
                style={{ cursor: 'ew-resize' }} 
                onMouseDown={(e) => handleLabelMouseDown(e, 'opacity', selectedClip.opacity !== undefined ? selectedClip.opacity : 100)}
              >Непрозрачность (%)</label>
              <div className="input-with-keyframe">
                <input
                  type="number"
                  className="prop-input"
                  style={{ cursor: 'ew-resize' }}
                  value={getDisplayValue('opacity')}
                  onChange={(e) => handleChange('opacity', Number(e.target.value))}
                  onMouseDown={(e) => handleLabelMouseDown(e, 'opacity', selectedClip.opacity !== undefined ? selectedClip.opacity : 100)}
                />
                <button 
                  className={`keyframe-btn ${hasKeyframe('opacity') ? 'active' : ''}`}
                  onClick={() => onToggleKeyframe(selectedClip.id, 'opacity')}
                  title="Toggle Keyframe"
                >♦</button>
              </div>
            </div>
          </>
        )}

        {selectedClip.type === 'video' && (
          <>
            <div className="property-group">
              <label 
                style={{ cursor: 'ew-resize' }} 
                onMouseDown={(e) => handleLabelMouseDown(e, 'scale', selectedClip.scale || 100)}
              >Масштаб (%)</label>
              <div className="input-with-keyframe">
                <input
                  type="number"
                  className="prop-input"
                  style={{ cursor: 'ew-resize' }}
                  value={selectedClip.scale || 100}
                  onChange={(e) => handleChange('scale', Number(e.target.value))}
                  onMouseDown={(e) => handleLabelMouseDown(e, 'scale', selectedClip.scale || 100)}
                />
                <button 
                  className={`keyframe-btn ${hasKeyframe('scale') ? 'active' : ''}`}
                  onClick={() => onToggleKeyframe(selectedClip.id, 'scale')}
                  title="Toggle Keyframe"
                >♦</button>
              </div>
            </div>
            <div className="property-group">
              <label 
                style={{ cursor: 'ew-resize' }} 
                onMouseDown={(e) => handleLabelMouseDown(e, 'opacity', selectedClip.opacity !== undefined ? selectedClip.opacity : 100)}
              >Непрозрачность (%)</label>
              <div className="input-with-keyframe">
                <input
                  type="number"
                  className="prop-input"
                  style={{ cursor: 'ew-resize' }}
                  value={getDisplayValue('opacity')}
                  onChange={(e) => handleChange('opacity', Number(e.target.value))}
                  onMouseDown={(e) => handleLabelMouseDown(e, 'opacity', selectedClip.opacity !== undefined ? selectedClip.opacity : 100)}
                />
                <button 
                  className={`keyframe-btn ${hasKeyframe('opacity') ? 'active' : ''}`}
                  onClick={() => onToggleKeyframe(selectedClip.id, 'opacity')}
                  title="Toggle Keyframe"
                >♦</button>
              </div>
            </div>
          </>
        )}

        {selectedClip.type === 'audio' && (
          <>
            <div className="property-group">
              <label>Громкость (dB)</label>
              <input type="number" className="prop-input" defaultValue="0" />
            </div>
          </>
        )}

        <div className="divider"></div>
        
        <div className="panel-header sub-header">
          <span>Трекинг & Анимация</span>
        </div>
        
        <div className="property-group">
          <label>Привязка к объекту (ИИ)</label>
          <button
            className="ai-btn"
            onClick={() => onStartTracking && onStartTracking(selectedClip.id)}
            disabled={selectedClip.type !== 'video'}
            title={selectedClip.type !== 'video' ? 'Трекинг доступен только для видеоклипов' : ''}
          >
            <span className="ai-icon">✨</span>
            Авто-трекинг
          </button>
        </div>
        
        <div className="property-group">
          <label 
            style={{ cursor: 'ew-resize' }} 
            onMouseDown={(e) => handleLabelMouseDown(e, 'canvasX', selectedClip.canvasX || 0)}
          >Позиция X</label>
          <div className="input-with-keyframe">
            <input
              type="number"
              className="prop-input"
              style={{ cursor: 'ew-resize' }}
              value={getDisplayValue('canvasX')}
              onChange={(e) => handleChange('canvasX', Number(e.target.value))}
              onMouseDown={(e) => handleLabelMouseDown(e, 'canvasX', selectedClip.canvasX || 0)}
            />
            <button 
              className={`keyframe-btn ${hasKeyframe('canvasX') ? 'active' : ''}`}
              onClick={() => onToggleKeyframe(selectedClip.id, 'canvasX')}
              title="Toggle Keyframe"
            >♦</button>
          </div>
        </div>
        <div className="property-group">
          <label 
            style={{ cursor: 'ew-resize' }} 
            onMouseDown={(e) => handleLabelMouseDown(e, 'canvasY', selectedClip.canvasY || 0)}
          >Позиция Y</label>
          <div className="input-with-keyframe">
            <input
              type="number"
              className="prop-input"
              style={{ cursor: 'ew-resize' }}
              value={getDisplayValue('canvasY')}
              onChange={(e) => handleChange('canvasY', Number(e.target.value))}
              onMouseDown={(e) => handleLabelMouseDown(e, 'canvasY', selectedClip.canvasY || 0)}
            />
            <button 
              className={`keyframe-btn ${hasKeyframe('canvasY') ? 'active' : ''}`}
              onClick={() => onToggleKeyframe(selectedClip.id, 'canvasY')}
              title="Toggle Keyframe"
            >♦</button>
          </div>
        </div>

        <div className="divider" />

        {/* Система родителей */}
        <div className="panel-header sub-header">
          <span>Иерархия</span>
        </div>
        <div className="property-group">
          <label>Родитель</label>
          <select
            className="prop-input"
            value={selectedClip.parentId || ''}
            onChange={(e) => handleChange('parentId', e.target.value || null)}
          >
            <option value="">Нет</option>
            {(allClips || []).filter(c => c.id !== selectedClip.id).map(c => (
              <option key={c.id} value={c.id}>{c.name || c.id}</option>
            ))}
          </select>
        </div>

        <div className="divider" />

        {/* Маска */}
        <div className="panel-header sub-header">
          <span>Маска</span>
        </div>
        <div className="property-group">
          <label>Применить маску из</label>
          <select
            className="prop-input"
            value={selectedClip.maskClipId || ''}
            onChange={(e) => handleChange('maskClipId', e.target.value || null)}
          >
            <option value="">Нет</option>
            {(allClips || [])
              .filter(c => c.id !== selectedClip.id && c.type === 'shape')
              .map(c => (
                <option key={c.id} value={c.id}>{c.name || c.shapeType || c.id}</option>
              ))
            }
          </select>
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;
