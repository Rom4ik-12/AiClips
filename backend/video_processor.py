import os
from pathlib import Path
from moviepy import VideoFileClip, TextClip, CompositeVideoClip, ColorClip

BASE_DIR = Path(__file__).resolve().parent

def hex_to_rgb(hex_str):
    hex_str = str(hex_str).lstrip('#')
    try:
        return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))
    except:
        return (255, 255, 255)

def get_interpolated_value(clip, prop, t_seconds):
    base_val = clip.get(prop, 0)
    if prop == 'scale' and base_val == 0:
        base_val = 100
        
    keyframes = clip.get('keyframes', [])
    if not keyframes:
        return base_val
        
    prop_kfs = sorted([k for k in keyframes if k.get('property') == prop], key=lambda k: k.get('x', 0))
    if not prop_kfs:
        return base_val
        
    playhead = t_seconds * 50 # 50px = 1 sec
    
    if playhead <= prop_kfs[0]['x']:
        return prop_kfs[0]['value']
    if playhead >= prop_kfs[-1]['x']:
        return prop_kfs[-1]['value']
        
    for i in range(len(prop_kfs) - 1):
        k1 = prop_kfs[i]
        k2 = prop_kfs[i+1]
        if k1['x'] <= playhead <= k2['x']:
            progress = (playhead - k1['x']) / (k2['x'] - k1['x'])
            return k1['value'] + (k2['value'] - k1['value']) * progress
            
    return base_val

def resolve_transform(clip_id, all_clips, t_seconds, visited=None):
    if visited is None: visited = set()
    if clip_id in visited: return {'x': 0, 'y': 0, 'scale': 100}
    visited.add(clip_id)
    
    clip = next((c for c in all_clips if c.get('id') == clip_id), None)
    if not clip: return {'x': 0, 'y': 0, 'scale': 100}
    
    x = get_interpolated_value(clip, 'canvasX', t_seconds)
    y = get_interpolated_value(clip, 'canvasY', t_seconds)
    scale = get_interpolated_value(clip, 'scale', t_seconds)
    
    parent_id = clip.get('parentId')
    if parent_id:
        pt = resolve_transform(parent_id, all_clips, t_seconds, visited)
        return {
            'x': x + pt['x'],
            'y': y + pt['y'],
            'scale': scale * (pt['scale'] / 100)
        }
        
    return {'x': x, 'y': y, 'scale': scale}

def render_timeline(clips_data, output_path="output.mp4"):
    print("Starting render...")
    video_elements = []
    
    # Сортируем: чем больше track (н-р A1=2, T1=1, V1=0), тем раньше рендерим,
    # чтобы V1 оказался поверх всех
    sorted_clips = sorted(clips_data, key=lambda c: c.get('track', 0), reverse=True)
    
    PROJECT_W, PROJECT_H = 1280, 720
    
    for clip in sorted_clips:
        v_clip = None
        duration = clip.get('width', 100) / 50
        start_time = clip.get('x', 0) / 50
        
        if clip.get('type') == 'video':
            try:
                video_path = clip['name']
                # Поддерживаем как относительные пути (uploads/...), так и абсолютные
                if not os.path.isabs(video_path):
                    resolved = BASE_DIR / video_path
                    if resolved.exists():
                        video_path = str(resolved)
                if os.path.exists(video_path):
                    v_clip = VideoFileClip(video_path)
                    v_clip = v_clip.resized(height=PROJECT_H)
                    if v_clip.w > PROJECT_W:
                        v_clip = v_clip.resized(width=PROJECT_W)
                else:
                    print(f"Warning: Video {clip['name']} not found.")
            except Exception as e:
                print(f"Error loading video: {e}")
                
        elif clip.get('type') == 'text':
            try:
                t_clip = TextClip(text=clip.get('text', clip.get('name', '')), font_size=70, color=clip.get('fillColor', 'white'))
                v_clip = t_clip
            except Exception as e:
                print(f"Error loading text: {e}")
                
        elif clip.get('type') == 'shape':
            try:
                color = hex_to_rgb(clip.get('fillColor', '#3498db'))
                v_clip = ColorClip(size=(100, 100), color=color)
            except Exception as e:
                print(f"Error loading shape: {e}")
                
        elif clip.get('type') == 'tracker':
            try:
                v_clip = ColorClip(size=(20, 20), color=(0, 255, 136))
            except Exception as e:
                print(f"Error loading tracker: {e}")
                
        if v_clip:
            v_clip = v_clip.with_duration(duration).with_start(start_time)
            
            def make_pos_func(cid, base_w, base_h, c_start_time):
                def pos(t):
                    t_global = c_start_time + t
                    transform = resolve_transform(cid, clips_data, t_global)
                    scaled_w = base_w * (transform['scale'] / 100)
                    scaled_h = base_h * (transform['scale'] / 100)
                    left = (PROJECT_W / 2) + transform['x'] - (scaled_w / 2)
                    top = (PROJECT_H / 2) + transform['y'] - (scaled_h / 2)
                    return (left, top)
                return pos
                
            v_clip = v_clip.with_position(make_pos_func(clip['id'], v_clip.w, v_clip.h, start_time))
            video_elements.append(v_clip)

    if not video_elements:
        print("No valid clips to render.")
        return False
        
    final_video = CompositeVideoClip(video_elements, size=(PROJECT_W, PROJECT_H))
    final_video.write_videofile(output_path, fps=30)
    print("Render complete!")
    return True
