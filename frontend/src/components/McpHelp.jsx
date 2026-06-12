import { useState } from 'react';
import './McpHelp.css';

const McpHelp = () => {
  const [isOpen, setIsOpen] = useState(false);

  const configExample = `{
  "mcpServers": {
    "aiclips": {
      "command": "/полный/путь/до/backend/venv/bin/python",
      "args": [
        "/полный/путь/до/backend/mcp_server.py"
      ]
    }
  }
}`;

  return (
    <>
      <button className="mcp-help-btn" onClick={() => setIsOpen(true)} title="Как настроить MCP">
        ?
      </button>

      {isOpen && (
        <div className="mcp-help-overlay" onClick={() => setIsOpen(false)}>
          <div className="mcp-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mcp-help-header">
              <h3>Настройка MCP</h3>
              <button className="mcp-help-close" onClick={() => setIsOpen(false)}>×</button>
            </div>
            <div className="mcp-help-content">
              <p>
                MCP позволяет AI-агентам управлять таймлайном AiClips.
                Доступные команды: <strong>get_timeline</strong>, <strong>add_clip</strong>,{' '}
                <strong>update_clip</strong>, <strong>render_video</strong>.
              </p>

              <h4>1. Запустите бэкенд</h4>
              <pre>
                <code>cd backend
source venv/bin/activate
python main.py</code>
              </pre>

              <h4>2. Запустите MCP-сервер</h4>
              <pre>
                <code>cd backend
source venv/bin/activate
python mcp_server.py</code>
              </pre>

              <h4>3. Добавьте сервер в Claude Desktop</h4>
              <p>
                Файл конфигурации:<br />
                macOS: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code><br />
                Windows: <code>%APPDATA%\\Claude\\claude_desktop_config.json</code><br />
                Linux: <code>~/.config/Claude/claude_desktop_config.json</code>
              </p>
              <pre>
                <code>{configExample}</code>
              </pre>
              <p className="mcp-help-note">
                Замените пути на актуальные. После сохранения перезапустите Claude Desktop.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default McpHelp;
