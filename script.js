const DATA = [
  {
    name: "Editores de código",
    color: "#5FA8A0",
    tools: [
      { name: "StackBlitz", url: "https://stackblitz.com/" },
      { name: "CodeSandbox", url: "https://codesandbox.io/" },
      { name: "Replit", url: "https://replit.com/~" },
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
    ]
  },
  {
    name: "Asistentes de IA",
    color: "#B98CD1",
    tools: [
      { name: "Claude", url: "https://claude.ai/new" },
      { name: "ChatGPT", url: "https://chatgpt.com/" },
      { name: "Perplexity", url: "https://www.perplexity.ai/" },
    ]
  },
  {
    name: "Motores de juego web",
    color: "#E36B5B",
    tools: [
      { name: "GDevelop", url: "https://editor.gdevelop.io/" },
      { name: "PlayCanvas", url: "https://playcanvas.com/" },
      { name: "Construct 3", url: "https://editor.construct.net/" },
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

  let activeItemEl = null;
  let hintTimer = null;

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

    if (tool.type === 'native') {
      openNewBtn.style.display = 'none';
      renderPixelEditor(viewport);
      return;
    }

    openNewBtn.href = tool.url;
    openNewBtn.style.display = 'inline-block';
    statusDot.classList.add('loading');

    const iframe = document.createElement('iframe');
    iframe.src = '/proxy?url=' + encodeURIComponent(tool.url);
    iframe.allow = "clipboard-write; fullscreen";
    viewport.appendChild(iframe);

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
