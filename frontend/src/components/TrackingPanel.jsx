import './TrackingOverlay.css';

const TrackingPanel = ({
  phase,
  cvLoaded,
  cvError,
  pickedPoint,
  progress,
  onStart,
  onCancel,
}) => {
  const progressPercent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="tracking-panel tracking-panel-inline">
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
              onClick={onStart}
              disabled={!pickedPoint || !cvLoaded || !!cvError}
            >
              ▶ Начать трекинг
            </button>
            <button className="track-btn track-btn-cancel" onClick={onCancel}>
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
          <button className="track-btn track-btn-cancel" onClick={onCancel}>
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
  );
};

export default TrackingPanel;
