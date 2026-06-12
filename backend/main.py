from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
import os
import json
import re
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import uvicorn
from video_processor import render_timeline

app = FastAPI(title="AiClips API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

class RenderRequest(BaseModel):
    clips: List[Dict[str, Any]]

# MCP Integration State
ws_clients: List[WebSocket] = []
current_timeline_state: List[Dict[str, Any]] = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    ws_clients.append(websocket)
    global current_timeline_state
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "SYNC_STATE":
                    current_timeline_state = msg.get("payload", [])
            except:
                pass
    except WebSocketDisconnect:
        ws_clients.remove(websocket)

@app.get("/api/mcp/state")
def get_mcp_state():
    return {"status": "success", "clips": current_timeline_state}

@app.post("/api/mcp/action")
async def mcp_action(action: Dict[str, Any]):
    # Broadcast action to all connected React clients
    for client in ws_clients:
        try:
            await client.send_json(action)
        except:
            pass
    return {"status": "success", "message": "Action broadcasted"}


@app.get("/")
def read_root():
    return {"status": "ok", "message": "AiClips Backend Running"}

@app.post("/render")
def api_render_video(req: RenderRequest):
    try:
        output_file = str(STATIC_DIR / "output.mp4")
        success = render_timeline(req.clips, output_file)
        if success:
            return {"status": "success", "file": "output.mp4"}
        else:
            raise HTTPException(status_code=500, detail="Failed to render video.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def sanitize_filename(filename: str) -> str:
    """Удаляем потенциально опасные символы из имени файла."""
    filename = os.path.basename(filename)
    filename = re.sub(r'[^\w\-.\s]', '', filename)
    return filename or "upload"

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        safe_name = sanitize_filename(file.filename)
        file_path = UPLOADS_DIR / safe_name
        with open(file_path, "wb") as f:
            f.write(await file.read())
        return {"status": "success", "filename": safe_name, "url": f"http://localhost:8000/uploads/{safe_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TrackRequest(BaseModel):
    video_path: str
    initial_bbox: List[int] # [x, y, w, h]

@app.post("/track")
def api_track_object(req: TrackRequest):
    from tracker import track_object
    try:
        # Безопасно разрешаем путь относительно папки uploads
        safe_name = sanitize_filename(req.video_path)
        video_path = UPLOADS_DIR / safe_name
        if not video_path.exists():
            raise HTTPException(status_code=404, detail="Video not found")
        data = track_object(str(video_path), tuple(req.initial_bbox))
        return {"status": "success", "tracking_data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
