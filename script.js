const DATA = [
  {
    name: "Editores de código",
    color: "#5FA8A0",
    tools: [
      { name: "StackBlitz", url: "https://stackblitz.com/" },
      { name: "CodeSandbox", url: "https://codesandbox.io/" },
      { name: "Replit", url: "https://replit.com/~" },
      { name: "Babylon.js Playground", url: "https://playground.babylonjs.com/" },
    ]
  },
  {
    name: "Sprites y pixel art",
    color: "#E3A857",
    tools: [
      { name: "Editor de pixel art (integrado)", type: "native" },
      { name: "Piskel", url: "https://www.piskelapp.com/p/create/" },
      { name: "Pixilart", url: "https://www.pixilart.com/draw" },
      { name: "Lospec Pixel Editor", url: "https://lospec.com/pixel-editor/" },
      { name: "Blockbench (voxel/3D)", url: "https://web.blockbench.net/" },
    ]
  },
  {
    name: "Asistentes de IA",
    color: "#B98CD1",
    tools: [
      { name: "Chat de IA (tu API key)", type: "ai-chat" },
      { name: "Claude", url: "https://claude.ai/new" },
      { name: "ChatGPT", url: "https://chatgpt.com/" },
      { name: "Perplexity", url: "https://www.perplexity.ai/" },
    ]
  },
  {
    name: "Motores de juego web",
    color: "#E36B5B",
    tools: [
      { name: "PixelForge", url: "https://www.pixelforgegames.net/" },
      { name: "GDevelop", url: "https://editor.gdevelop.io/" },
      { name: "Construct 3", url: "https://editor.construct.net/" },
      { name: "Flowlab", url: "https://flowlab.io/" },
      { name: "Bitsy", url: "https://make.bitsy.org/editor/" },
      { name: "Godot Web Editor (autoalojado)", url: "/godot-editor/godot.editor.html", direct: true },
    ]
  },
];

function init() {
  const categoriesEl = document.getElementById('categories');
  const viewport = document.getElementById('viewport');
  const viewportWrap = document.querySelector('.viewport-wrap');
  const currentTool = document.getElementById('currentTool');
  const openNewBtn = document.getElementById('openNewBtn');
  const statusDot = document.getElementById('statusDot');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const debugBtn = document.getElementById('debugBtn');
  const debugCount = document.getElementById('debugCount');
  const debugPanel = document.getElementById('debugPanel');
  const debugLog = document.getElementById('debugLog');

  let activeItemEl = null;
  let hintTimer = null;
  let debugErrorCount = 0;

  debugBtn.addEventListener('click', () => {
    debugPanel.style.display = debugPanel.style.display === 'none' ? 'flex' : 'none';
  });
  document.getElementById('debugClose').addEventListener('click', () => {
    debugPanel.style.display = 'none';
  });
  document.getElementById('debugClear').addEventListener('click', () => {
    debugLog.innerHTML = '';
    debugErrorCount = 0;
    debugCount.textContent = '';
    debugBtn.classList.remove('has-errors');
  });

  function logDebug(kind, message) {
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = 'debug-line ' + kind;
    line.textContent = `[${time}] ${message}`;
    debugLog.appendChild(line);
    debugLog.scrollTop = debugLog.scrollHeight;
    if (kind === 'err' || kind === 'rej') {
      debugErrorCount++;
      debugCount.textContent = debugErrorCount;
      debugBtn.classList.add('has-errors');
      debugPanel.style.display = 'flex'; // se abre solo ante el primer error real
    }
  }

  // Intenta "escuchar" errores dentro de un iframe same-origin (como
  // Godot, que ahora vive en nuestro propio dominio). Con sitios de
  // otros dominios esto falla en silencio por seguridad del navegador
  // — es normal y esperado, no es un bug.
  function attachDebugCapture(iframe, toolName) {
    debugBtn.style.display = 'inline-block';
    logDebug('info', `Cargando "${toolName}"...`);
    iframe.addEventListener('load', () => {
      let win;
      try {
        win = iframe.contentWindow;
        // Esto lanza un error si el iframe es de otro dominio (normal).
        void win.document;
      } catch (e) {
        logDebug('info', `"${toolName}" es de otro sitio — no se puede leer su consola desde aquí.`);
        return;
      }
      win.addEventListener('error', (e) => {
        logDebug('err', `${e.message} — ${(e.filename || '').split('/').pop()}:${e.lineno || '?'}`);
      });
      win.addEventListener('unhandledrejection', (e) => {
        logDebug('rej', 'Promesa sin manejar: ' + String(e.reason && e.reason.message || e.reason));
      });
      try {
        const origError = win.console.error.bind(win.console);
        win.console.error = (...args) => { origError(...args); logDebug('err', args.map(String).join(' ')); };
        const origWarn = win.console.warn.bind(win.console);
        win.console.warn = (...args) => { origWarn(...args); logDebug('warn', args.map(String).join(' ')); };
      } catch (e) { /* algunos navegadores bloquean sobreescribir console, se ignora */ }
      logDebug('info', `Conectado a la consola de "${toolName}".`);
    });
  }

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      (viewportWrap.requestFullscreen || viewportWrap.webkitRequestFullscreen).call(viewportWrap);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
  });

  document.addEventListener('fullscreenchange', updateFullscreenLabel);
  document.addEventListener('webkitfullscreenchange', updateFullscreenLabel);

  function updateFullscreenLabel() {
    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
    fullscreenBtn.textContent = isFull ? '✕ Salir de pantalla completa' : '⛶ Pantalla completa';
  }

  DATA.forEach((cat, ci) => {
    const catEl = document.createElement('div');
    catEl.className = 'category' + (ci === 0 ? ' open' : '');

    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
      <span class="cat-dot" style="background:${cat.color}"></span>
      <span class="category-name">${cat.name}</span>
      <span class="chevron">▶</span>
    `;
    header.addEventListener('click', () => catEl.classList.toggle('open'));

    const list = document.createElement('ul');
    list.className = 'tool-list';

    cat.tools.forEach(tool => {
      const li = document.createElement('li');
      li.className = 'tool-item';
      li.innerHTML = `<span class="tool-status" style="background:${cat.color}"></span>${tool.name}`;
      li.addEventListener('click', () => loadTool(tool, cat, li));
      list.appendChild(li);
    });

    catEl.appendChild(header);
    catEl.appendChild(list);
    categoriesEl.appendChild(catEl);
  });

  function loadTool(tool, cat, itemEl) {
    if (activeItemEl) activeItemEl.classList.remove('active');
    itemEl.classList.add('active');
    activeItemEl = itemEl;

    currentTool.innerHTML = `<span class="current-cat">${cat.name} /</span> ${tool.name}`;
    clearTimeout(hintTimer);
    statusDot.classList.remove('loading');
    viewport.innerHTML = '';
    fullscreenBtn.style.display = 'inline-block';
    debugBtn.style.display = 'none';
    debugPanel.style.display = 'none';
    debugLog.innerHTML = '';
    debugErrorCount = 0;
    debugCount.textContent = '';
    debugBtn.classList.remove('has-errors');

    if (tool.type === 'native') {
      openNewBtn.style.display = 'none';
      renderPixelEditor(viewport);
      return;
    }

    if (tool.type === 'ai-chat') {
      openNewBtn.style.display = 'none';
      renderAIChat(viewport);
      return;
    }

    openNewBtn.href = tool.url;
    openNewBtn.style.display = 'inline-block';
    statusDot.classList.add('loading');

    const iframe = document.createElement('iframe');
    // Herramientas "direct" (autoalojadas en nuestro propio dominio, como
    // Godot) cargan tal cual, sin pasar por /proxy — ya son same-origin.
    iframe.src = tool.direct ? tool.url : ('/proxy?url=' + encodeURIComponent(tool.url));
    iframe.allow = "clipboard-write; fullscreen";
    viewport.appendChild(iframe);
    attachDebugCapture(iframe, tool.name);

    iframe.addEventListener('load', () => statusDot.classList.remove('loading'));

    hintTimer = setTimeout(() => {
      const hint = document.createElement('div');
      hint.className = 'hint-bar';
      hint.innerHTML = `<span>¿Pantalla en blanco o pide iniciar sesión? <strong>${tool.name}</strong> puede necesitar la pestaña real.</span><a href="${tool.url}" target="_blank" rel="noopener">Abrir en pestaña nueva ↗</a>`;
      viewport.appendChild(hint);
      statusDot.classList.remove('loading');
    }, 3500);
  }
}

document.addEventListener('DOMContentLoaded', init);

function renderPixelEditor(viewport) {
  viewport.innerHTML = `
    <div class="pixel-editor">
      <div class="pe-toolbar">
        <label class="pe-field">
          Tamaño
          <select class="pe-size">
            <option value="16">16×16</option>
            <option value="32" selected>32×32</option>
            <option value="64">64×64</option>
          </select>
        </label>
        <input type="color" class="pe-color" value="#e3a857" title="Color">
        <button class="pe-tool active" data-tool="pencil">Lápiz</button>
        <button class="pe-tool" data-tool="eraser">Borrador</button>
        <button class="pe-action pe-clear">Limpiar</button>
        <button class="pe-action pe-download">Descargar PNG</button>
      </div>
      <div class="pe-canvas-wrap">
        <canvas class="pe-canvas"></canvas>
      </div>
    </div>
  `;

  const root = viewport.querySelector('.pixel-editor');
  const canvasWrap = root.querySelector('.pe-canvas-wrap');
  const canvas = root.querySelector('.pe-canvas');
  const ctx = canvas.getContext('2d');
  const sizeSelect = root.querySelector('.pe-size');
  const colorInput = root.querySelector('.pe-color');
  const toolBtns = root.querySelectorAll('.pe-tool');

  let gridSize = parseInt(sizeSelect.value, 10);
  let displaySize = 480;
  let cellSize = displaySize / gridSize;
  let currentTool = 'pencil';
  let currentColor = colorInput.value;
  let drawing = false;
  let pixels = createGrid(gridSize);

  function createGrid(n) {
    return Array.from({ length: n }, () => Array(n).fill(null));
  }

  function computeDisplaySize() {
    const available = Math.min(canvasWrap.clientWidth, canvasWrap.clientHeight) - 4;
    displaySize = Math.max(200, available || 480);
    cellSize = displaySize / gridSize;
    canvas.width = displaySize;
    canvas.height = displaySize;
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const c = pixels[y][x];
        ctx.fillStyle = c || (((x + y) % 2 === 0) ? '#20222b' : '#1a1c24');
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.floor(i * cellSize) + 0.5, 0);
      ctx.lineTo(Math.floor(i * cellSize) + 0.5, displaySize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, Math.floor(i * cellSize) + 0.5);
      ctx.lineTo(displaySize, Math.floor(i * cellSize) + 0.5);
      ctx.stroke();
    }
  }

  function getCell(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((clientX - rect.left) * scaleX / cellSize);
    const y = Math.floor((clientY - rect.top) * scaleY / cellSize);
    return { x, y };
  }

  function paintAt(clientX, clientY) {
    const { x, y } = getCell(clientX, clientY);
    if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return;
    pixels[y][x] = currentTool === 'eraser' ? null : currentColor;
    render();
  }

  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    paintAt(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drawing) paintAt(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerup', () => { drawing = false; });
  canvas.addEventListener('pointercancel', () => { drawing = false; });

  sizeSelect.addEventListener('change', () => {
    gridSize = parseInt(sizeSelect.value, 10);
    pixels = createGrid(gridSize);
    computeDisplaySize();
    render();
  });

  colorInput.addEventListener('input', () => { currentColor = colorInput.value; });

  toolBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      toolBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
    });
  });

  root.querySelector('.pe-clear').addEventListener('click', () => {
    pixels = createGrid(gridSize);
    render();
  });

  root.querySelector('.pe-download').addEventListener('click', () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = gridSize;
    exportCanvas.height = gridSize;
    const ectx = exportCanvas.getContext('2d');
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const c = pixels[y][x];
        if (c) {
          ectx.fillStyle = c;
          ectx.fillRect(x, y, 1, 1);
        }
      }
    }
    const link = document.createElement('a');
    link.download = 'pixel-art.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  });

  window.addEventListener('resize', () => {
    computeDisplaySize();
    render();
  });

  computeDisplaySize();
  render();
}

function renderAIChat(viewport) {
  viewport.innerHTML = `
    <div class="ai-chat">
      <div class="ai-settings">
        <input type="text" class="ai-base-url" placeholder="URL base (ej. https://router.huggingface.co/v1/chat/completions)">
        <input type="text" class="ai-model" placeholder="Modelo (ej. meta-llama/Llama-3.1-8B-Instruct)">
        <input type="password" class="ai-key" placeholder="Tu API key">
        <button class="ai-save">Guardar</button>
        <span class="ai-key-status"></span>
      </div>
      <div class="ai-messages"></div>
      <form class="ai-input-row">
        <textarea class="ai-input" placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para salto de línea)" rows="1"></textarea>
        <button type="submit" class="ai-send">Enviar</button>
      </form>
    </div>
  `;

  const root = viewport.querySelector('.ai-chat');
  const baseUrlInput = root.querySelector('.ai-base-url');
  const modelInput = root.querySelector('.ai-model');
  const keyInput = root.querySelector('.ai-key');
  const statusEl = root.querySelector('.ai-key-status');
  const messagesEl = root.querySelector('.ai-messages');
  const form = root.querySelector('.ai-input-row');
  const textarea = root.querySelector('.ai-input');
  const sendBtn = root.querySelector('.ai-send');

  const STORAGE_KEY = 'ph_ai_chat_config';
  let history = [];

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      baseUrlInput.value = saved.baseUrl || 'https://router.huggingface.co/v1/chat/completions';
      modelInput.value = saved.model || '';
      keyInput.value = saved.key || '';
      statusEl.textContent = saved.key ? 'Config. guardada ✓' : '';
    } catch (e) {
      baseUrlInput.value = 'https://router.huggingface.co/v1/chat/completions';
    }
  }

  function saveConfig() {
    const config = {
      baseUrl: baseUrlInput.value.trim(),
      model: modelInput.value.trim(),
      key: keyInput.value.trim(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    statusEl.textContent = 'Guardado ✓';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  }

  root.querySelector('.ai-save').addEventListener('click', saveConfig);

  function addBubble(role, text) {
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble ai-' + role;
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function autoResize() {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  }
  textarea.addEventListener('input', autoResize);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = textarea.value.trim();
    if (!text) return;

    const config = {
      baseUrl: baseUrlInput.value.trim(),
      model: modelInput.value.trim(),
      key: keyInput.value.trim(),
    };

    if (!config.baseUrl || !config.model || !config.key) {
      addBubble('error', 'Completa URL base, modelo y API key, y toca "Guardar" antes de enviar mensajes.');
      return;
    }

    addBubble('user', text);
    history.push({ role: 'user', content: text });
    textarea.value = '';
    autoResize();

    sendBtn.disabled = true;
    const thinking = addBubble('assistant', 'Pensando...');

    try {
      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.key,
        },
        body: JSON.stringify({
          model: config.model,
          messages: history,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = (data && data.error && (data.error.message || data.error)) || ('Error HTTP ' + response.status);
        thinking.textContent = 'Error: ' + msg;
        thinking.className = 'ai-bubble ai-error';
        return;
      }

      const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (reply) {
        thinking.textContent = reply;
        thinking.className = 'ai-bubble ai-assistant';
        history.push({ role: 'assistant', content: reply });
      } else {
        thinking.textContent = 'La API respondió pero no encontré el texto esperado en el formato de respuesta.';
        thinking.className = 'ai-bubble ai-error';
      }
    } catch (err) {
      thinking.textContent = 'No se pudo conectar (' + err.message + '). Puede que la API bloquee peticiones directas desde el navegador (CORS).';
      thinking.className = 'ai-bubble ai-error';
    } finally {
      sendBtn.disabled = false;
    }
  });

  loadConfig();
}

