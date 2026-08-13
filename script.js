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
  const currentTool = document.getElementById('currentTool');
  const openNewBtn = document.getElementById('openNewBtn');
  const statusDot = document.getElementById('statusDot');

  let activeItemEl = null;
  let hintTimer = null;

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
