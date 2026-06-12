import { useRef, useEffect } from 'react';
import './TrackingOverlay.css';

const TrackingCanvas = ({ canvasSize, pickedPoint, onPointSelect, phase }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (pickedPoint) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pickedPoint.x, pickedPoint.y, 12, 0, Math.PI * 2);
      ctx.stroke();

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
    onPointSelect({ x, y });
  };

  return (
    <canvas
      ref={canvasRef}
      className="tracking-canvas"
      width={canvasSize.width}
      height={canvasSize.height}
      onClick={handleCanvasClick}
      style={{ cursor: phase === 'pick' ? 'crosshair' : 'default' }}
    />
  );
};

export default TrackingCanvas;
