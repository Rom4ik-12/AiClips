# AiClips

Веб-редактор видео с AI-трекингом объектов и MCP-интеграцией. Позволяет собирать таймлайн из видео, текста и фигур, накладывать маски, анимировать свойства через кейфреймы и автоматически отслеживать объекты на видео прямо в браузере.

## Возможности

- 🎬 **Таймлайн** с несколькими дорожками (V1, T1, A1)
- 🖼 **Предпросмотр** в реальном времени с масштабированием и позиционированием
- ✏️ **Текст и фигуры**: квадрат, круг, ромб, многоугольник
- 🎭 **Маски**: используйте фигуры в качестве масок для видео
- 📍 **Кейфреймы** для анимации позиции, масштаба и прозрачности
- 🤖 **AI-трекинг объектов** на чистом JavaScript (Lucas-Kanade optical flow)
- 🔌 **MCP-сервер** для управления таймлайном из внешних агентов
- ⌨️ **Горячие клавиши**: Space (play/pause), Delete, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y

## Технологии

- **Backend**: Python 3, FastAPI, Uvicorn, MoviePy, OpenCV
- **Frontend**: React 19, Vite, CSS Modules
- **Tracking**: Optical Flow на Canvas API (без внешних зависимостей)
- **MCP**: Model Context Protocol server

## Установка

### Требования

- Python 3.10+
- Node.js 18+
- ImageMagick (для рендера текста через MoviePy)

### Быстрый старт

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/username/AiClips.git
cd AiClips

# 2. Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# 3. Frontend
cd frontend
npm install
cd ..
```

## Запуск

### Backend

```bash
cd backend
source venv/bin/activate
python main.py
```

API будет доступно на `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm run dev
```

Откройте `http://localhost:5173`.

### Сборка production

```bash
cd frontend
npm run build
npm run preview
```

## Использование

1. Импортируйте видео через панель **Медиа** слева.
2. Перетащите файл на таймлайн.
3. Выберите клип и измените свойства в правой панели.
4. Установите кейфреймы, чтобы анимировать движение, масштаб или прозрачность.
5. Нажмите **Экспорт** для рендера финального видео.
6. Используйте кнопку **Авто-трекинг** на видеоклипе, чтобы отслеживать объект.

## MCP-интеграция

Проект включает MCP-сервер (`backend/mcp_server.py`), который позволяет внешним AI-агентам читать и изменять таймлайн.

### Доступные инструменты

- `get_timeline` — получить текущее состояние таймлайна.
- `add_clip` — добавить клип (видео, текст или фигуру).
- `update_clip` — обновить свойства клипа по ID.
- `render_video` — запустить рендер видео.

### Запуск MCP-сервера

1. Убедитесь, что бэкенд запущен:
   ```bash
   cd backend
   source venv/bin/activate
   python main.py
   ```

2. В отдельном терминале запустите MCP-сервер:
   ```bash
   cd backend
   source venv/bin/activate
   python mcp_server.py
   ```

Сервер ожидает, что backend запущен на `http://127.0.0.1:8000`.

### Настройка в Claude Desktop

Откройте файл конфигурации Claude Desktop:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Добавьте секцию `mcpServers`:

```json
{
  "mcpServers": {
    "aiclips": {
      "command": "/полный/путь/до/backend/venv/bin/python",
      "args": [
        "/полный/путь/до/backend/mcp_server.py"
      ]
    }
  }
}
```

Пример для Linux/macOS:

```json
{
  "mcpServers": {
    "aiclips": {
      "command": "/home/user/AiClips/backend/venv/bin/python",
      "args": [
        "/home/user/AiClips/backend/mcp_server.py"
      ]
    }
  }
}
```

После сохранения перезапустите Claude Desktop. Агент сможет управлять таймлайном AiClips через естественный язык.

### Проверка в программе

В интерфейсе AiClips в правом верхнем углу отображается индикатор **MCP: Подключено**. Если он красный — проверьте, что бэкенд и MCP-сервер запущены.

## Структура проекта

```
AiClips/
├── backend/
│   ├── main.py              # FastAPI приложение
│   ├── video_processor.py   # Рендер таймлайна через MoviePy
│   ├── tracker.py           # OpenCV CSRT трекер
│   ├── mcp_server.py        # MCP-сервер
│   ├── requirements.txt
│   ├── static/              # Сюда сохраняется output.mp4
│   └── uploads/             # Загруженные пользователем файлы
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── components/      # VideoPlayer, Timeline, PropertiesPanel, MediaBin, TrackingOverlay
│   │   └── utils/           # animations.js, tracker.js
│   ├── package.json
│   └── index.html
└── README.md
```

## Лицензия

MIT
