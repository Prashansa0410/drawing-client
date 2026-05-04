import React, { useRef, useState, useEffect } from 'react';
import './App.css';
import io from 'socket.io-client';

function App() {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const socketRef = useRef(); 
  const lastEmitTime = useRef(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000"); 
  const [size, setSize] = useState(5); 

  const paint = (data) => {
    if (!contextRef.current) return;
    const { x, y, type, strokeColor, strokeSize } = data;
    const ctx = contextRef.current;
  
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeSize;
  
    if (type === 'start') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (type === 'move') {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };
  const SOCKET_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    const canvas = canvasRef.current;
    canvas.width = 800 * 2;
    canvas.height = 600 * 2;
    canvas.style.width = "800px";
    canvas.style.height = "600px";
    const context = canvas.getContext("2d");
    context.scale(2, 2);
    context.lineCap = "round";
    contextRef.current = context;

    socket.on('recap-history', (history) => {
      history.forEach(point => paint(point));
    });

    socket.on('draw-data', (data) => {
      paint(data);
    });

    // --- NEW: THE UNDO LISTENER ---
    socket.on('re-render', (newHistory) => {
      // 1. Wipe the paper
      context.clearRect(0, 0, canvas.width, canvas.height);
      // 2. Re-play the movie (minus the last line)
      newHistory.forEach(point => paint(point));
    });

    return () => {
      socket.off('re-render');
      socket.off('recap-history');
      socket.off('draw-data');
      socket.disconnect();
    };
  }, []);

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    const data = { x: offsetX, y: offsetY, type: 'start', strokeColor: color, strokeSize: size };
    paint(data);
    setIsDrawing(true);
    socketRef.current.emit('draw-data', data);
    lastEmitTime.current = Date.now();
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    const data = { x: offsetX, y: offsetY, type: 'move', strokeColor: color, strokeSize: size };
    paint(data);
    const now = Date.now();
    if (now - lastEmitTime.current > 15) {
      socketRef.current.emit('draw-data', data);
      lastEmitTime.current = now;
    }
  };

  const finishDrawing = () => setIsDrawing(false);

  // --- NEW: UNDO TRIGGER ---
  const handleUndo = () => {
    socketRef.current.emit('undo');
  };

  return (
    <div className="App">
      <h1>Collaborative Board</h1>
      
      <div style={{ marginBottom: "10px" }}>
        <label>Color: </label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        
        <label style={{ marginLeft: "20px" }}>Size: </label>
        <input type="range" min="1" max="20" value={size} onChange={(e) => setSize(e.target.value)} />
        <span> {size}px</span>

        {/* UNDO BUTTON */}
        <button onClick={handleUndo} style={{ marginLeft: "30px", padding: "5px 15px", cursor: "pointer" }}>
          Undo Last Stroke
        </button>
      </div>

      <canvas
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={finishDrawing}
        onMouseLeave={finishDrawing}
        ref={canvasRef}
        style={{ border: "2px solid black", background: "white", cursor: "crosshair" }}
      />
    </div>
  );
}

export default App;
