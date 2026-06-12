import os
import cv2

def track_object(video_path, initial_bbox):
    """
    Tracks an object in a video using OpenCV CSRT tracker.
    initial_bbox: (x, y, w, h)
    Returns a list of bounding boxes for each frame.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")

    tracker = cv2.TrackerCSRT_create()
    video = cv2.VideoCapture(video_path)

    if not video.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    ok, frame = video.read()
    if not ok or frame is None:
        video.release()
        return []

    tracker.init(frame, initial_bbox)
    tracking_data = []

    while True:
        ok, frame = video.read()
        if not ok:
            break

        ok, bbox = tracker.update(frame)
        if ok:
            # Конвертируем float в int для сериализации JSON
            tracking_data.append([int(v) for v in bbox])
        else:
            tracking_data.append(None)

    video.release()
    return tracking_data
