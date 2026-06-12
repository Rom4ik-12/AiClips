import { useRef, useState } from 'react';
import { uploadMedia } from '../api';
import './MediaBin.css';

const MediaBin = ({ onAddClip }) => {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState('files');
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadMedia(file);
      setFiles(prev => [...prev, { name: res.filename, url: res.url }]);
    } catch (err) {
      alert('Ошибка загрузки: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e) => {
    handleFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleAdd = (file) => {
    onAddClip(file);
  };

  const handleDragStart = (e, file) => {
    e.dataTransfer.setData('application/json', JSON.stringify(file));
  };

  return (
    <div
      className={`media-bin-container glass-panel ${isDragOver ? 'drag-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="media-tabs">
        <div 
          className={`media-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >Файлы</div>
        <div 
          className={`media-tab ${activeTab === 'elements' ? 'active' : ''}`}
          onClick={() => setActiveTab('elements')}
        >Элементы</div>
      </div>

      <div className="media-content">
        {activeTab === 'elements' && (
          <div className="elements-grid">
            <div 
              className="element-item"
              draggable
              onDragStart={(e) => handleDragStart(e, { type: 'text', name: 'Текст' })}
            >
              <span className="element-icon">T</span>
              <span>Текст</span>
            </div>
            <div 
              className="element-item"
              draggable
              onDragStart={(e) => handleDragStart(e, { type: 'shape', shapeType: 'square', name: 'Квадрат', fillColor: '#3b82f6' })}
            >
              <span className="element-icon">■</span>
              <span>Квадрат</span>
            </div>
            <div 
              className="element-item"
              draggable
              onDragStart={(e) => handleDragStart(e, { type: 'shape', shapeType: 'circle', name: 'Круг', fillColor: '#ef4444' })}
            >
              <span className="element-icon">●</span>
              <span>Круг</span>
            </div>
            <div 
              className="element-item"
              draggable
              onDragStart={(e) => handleDragStart(e, { type: 'shape', shapeType: 'diamond', name: 'Ромб', fillColor: '#10b981' })}
            >
              <span className="element-icon">◆</span>
              <span>Ромб</span>
            </div>
            <div 
              className="element-item"
              draggable
              onDragStart={(e) => handleDragStart(e, { type: 'shape', shapeType: 'polygon', name: 'Многоугольник', fillColor: '#8b5cf6', sides: 3 })}
            >
              <span className="element-icon">▲</span>
              <span>Полигон</span>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <>
            <div className="media-header">
              <button 
                className="import-btn" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                style={{ width: '100%' }}
              >
                {isUploading ? 'Загрузка...' : '+ Импорт'}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="video/*,audio/*,image/*"
                onChange={handleFileChange}
              />
            </div>
            <div className="media-list">
              {files.length === 0 ? (
                <div className="empty-text">Нет файлов. Нажмите "+ Импорт"</div>
              ) : (
                files.map((f, i) => (
                  <div 
                    className="media-item" 
                    key={i} 
                    onClick={() => handleAdd(f)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { ...f, type: f.name.endsWith('.mp3') ? 'audio' : f.name.endsWith('.png') ? 'image' : 'video' })}
                  >
                    <span className="media-icon">🎬</span>
                    <span className="media-name" title={f.name}>{f.name}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MediaBin;
