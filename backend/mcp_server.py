import sys
import asyncio
import json
import urllib.request
import urllib.error
from mcp.server import Server
import mcp.types as types
from mcp.server.stdio import stdio_server

app = Server("aiclips-mcp-server")

def api_get(path):
    req = urllib.request.Request(f"http://127.0.0.1:8000{path}")
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        return {"error": str(e)}

def api_post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(f"http://127.0.0.1:8000{path}", data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        return {"error": str(e)}

@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="get_timeline",
            description="Reads the current state of the video timeline, returning all clips and their properties.",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="add_clip",
            description="Adds a new clip (video, text, or shape) to the timeline.",
            inputSchema={
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["video", "text", "shape"]},
                    "path": {"type": "string", "description": "Absolute file path for video clips. It will be automatically imported into the project."},
                    "name": {"type": "string", "description": "Name for text or shape clips"},
                    "x": {"type": "number", "description": "Position on timeline in pixels (50px = 1 sec)"},
                    "track": {"type": "number", "description": "Track index (0=V1, 1=T1, 2=A1)"},
                    "width": {"type": "number", "description": "Duration length in pixels"},
                    "text": {"type": "string", "description": "Text content if type is text"},
                    "shapeType": {"type": "string", "description": "E.g. square, circle if type is shape"},
                    "fillColor": {"type": "string", "description": "Hex color if type is shape"}
                },
                "required": ["type", "x", "track"]
            }
        ),
        types.Tool(
            name="update_clip",
            description="Updates properties of an existing clip by ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "updates": {
                        "type": "object",
                        "description": "Key-value pairs to update. NOTE: Y-axis goes DOWN! canvasY=0 is TOP, canvasY=720 is BOTTOM. To move UP, decrease canvasY. (e.g. {'canvasX': 100, 'canvasY': 50, 'scale': 150})"
                    }
                },
                "required": ["id", "updates"]
            }
        ),
        types.Tool(
            name="render_video",
            description="Triggers the video rendering process in the UI.",
            inputSchema={"type": "object", "properties": {}}
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    if name == "get_timeline":
        res = await asyncio.to_thread(api_get, "/api/mcp/state")
        return [types.TextContent(type="text", text=json.dumps(res, indent=2))]
    
    elif name == "add_clip":
        clip = arguments
        import time
        import os
        import shutil
        
        clip['id'] = f"{clip['type']}-{int(time.time() * 1000)}"
        if 'width' not in clip: clip['width'] = 150
        if 'keyframes' not in clip: clip['keyframes'] = []
        
        # Принудительно конвертируем в числа (нейросети могут отдавать строки)
        if 'x' in clip: clip['x'] = float(clip['x'])
        if 'track' in clip: clip['track'] = int(float(clip['track']))
        if 'width' in clip: clip['width'] = float(clip['width'])
        
        if clip.get('type') == 'video' and 'path' in clip:
            original_path = clip.pop('path')
            if os.path.exists(original_path):
                filename = os.path.basename(original_path)
                # Ensure we use the correct backend uploads folder regardless of CWD
                backend_dir = os.path.dirname(os.path.abspath(__file__))
                dest_dir = os.path.join(backend_dir, "uploads")
                os.makedirs(dest_dir, exist_ok=True)
                dest_path = os.path.join(dest_dir, filename)
                
                if os.path.abspath(original_path) != os.path.abspath(dest_path):
                    shutil.copy2(original_path, dest_path)
                
                clip['name'] = f"uploads/{filename}"
            else:
                clip['name'] = original_path
        elif 'name' not in clip:
            clip['name'] = f"New {clip['type']}"
        
        res = await asyncio.to_thread(api_post, "/api/mcp/action", {
            "type": "ADD_CLIP",
            "payload": clip
        })
        return [types.TextContent(type="text", text=f"Clip added successfully. ID: {clip['id']}. Response: {res}")]
        
    elif name == "update_clip":
        updates = arguments.get('updates', {})
        
        import json
        if isinstance(updates, str):
            try:
                updates = json.loads(updates)
                arguments['updates'] = updates
            except:
                pass
                
        # Исправляем частую ошибку ИИ, когда он пишет "y" вместо "canvasY"
        if 'y' in updates and 'canvasY' not in updates:
            updates['canvasY'] = updates.pop('y')
            
        # Принудительная конвертация числовых полей, если нейросеть прислала их строками
        numeric_fields = ['canvasX', 'canvasY', 'scale', 'opacity', 'x', 'width']
        for field in numeric_fields:
            if field in updates:
                try: updates[field] = float(updates[field])
                except: pass
        if 'track' in updates:
            try: updates['track'] = int(float(updates['track']))
            except: pass

        res = await asyncio.to_thread(api_post, "/api/mcp/action", {
            "type": "UPDATE_CLIP",
            "payload": arguments
        })
        return [types.TextContent(type="text", text=f"Clip updated successfully. Response: {res}")]
        
    elif name == "render_video":
        res = await asyncio.to_thread(api_post, "/api/mcp/action", {
            "type": "RENDER_VIDEO",
            "payload": {}
        })
        return [types.TextContent(type="text", text=f"Render triggered. Response: {res}")]

    raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
