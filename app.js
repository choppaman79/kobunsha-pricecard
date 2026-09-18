const MM_TO_IN = 1 / 25.4;
const DPI = 300;
const SIZES = {
  business: { mmW: 91, mmH: 55 },
  a7: { mmW: 105, mmH: 74 }
};

const els = {
  imageInput: document.getElementById('imageInput'),
  jpName: document.getElementById('jpName'),
  enName: document.getElementById('enName'),
  price: document.getElementById('price'),
  taxMode: document.getElementById('taxMode'),
  template: document.getElementById('template'),
  cardSize: document.getElementById('cardSize'),
  imageLayout: document.getElementById('imageLayout'),
  imageFit: document.getElementById('imageFit'),
  canvas: document.getElementById('cardCanvas'),
  exportBtn: document.getElementById('exportBtn'),
  printBtn: document.getElementById('printBtn'),
  resetBtn: document.getElementById('resetBtn'),
  saveProductBtn: document.getElementById('saveProductBtn'),
  refreshProductsBtn: document.getElementById('refreshProductsBtn'),
  productSelect: document.getElementById('productSelect'),
  status: document.getElementById('status'),
};

let productImage = null;
let productImageDataUrl = '';
let firebaseApi = null;

function pxFromMm(mm) {
  return Math.round(mm * MM_TO_IN * DPI);
}

function setupCanvas() {
  const s = SIZES[els.cardSize.value];
  els.canvas.width = pxFromMm(s.mmW);
  els.canvas.height = pxFromMm(s.mmH);
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawFittedImage(ctx, img, x, y, w, h, fit = 'contain') {
  const ir = img.width / img.height;
  const rr = w / h;
  let dw, dh;
  if ((fit === 'contain' && ir > rr) || (fit === 'cover' && ir < rr)) {
    dw = w;
    dh = w / ir;
  } else {
    dh = h;
    dw = h * ir;
  }
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function fontSizeToFit(ctx, text, maxWidth, startSize, minSize, fontFamily, weight = 700) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function formatPrice(value) {
  const n = Number(value || 0);
  return `¥${n.toLocaleString('ja-JP')}`;
}

function drawSimple(ctx, W, H) {
  const pad = Math.round(W * 0.028);
  const gold = '#a87921';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = gold;
  ctx.lineWidth = Math.max(3, W * 0.0035);
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  const isLeft = els.imageLayout.value === 'left';
  let imageBox, textBox;
  if (isLeft) {
    imageBox = { x: pad * 1.8, y: pad * 1.8, w: W * 0.49, h: H - pad * 3.6 };
    textBox = { x: W * 0.55, y: pad * 2.0, w: W * 0.41, h: H - pad * 4 };
  } else {
    imageBox = { x: pad * 1.8, y: pad * 1.7, w: W - pad * 3.6, h: H * 0.50 };
    textBox = { x: pad * 2.2, y: H * 0.57, w: W - pad * 4.4, h: H * 0.35 };
  }

  if (productImage) drawFittedImage(ctx, productImage, imageBox.x, imageBox.y, imageBox.w, imageBox.h, els.imageFit.value);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = textBox.x + textBox.w / 2;

  const jpFont = '"Yu Mincho", "Hiragino Mincho ProN", serif';
  const enFont = 'Georgia, "Times New Roman", serif';
  const priceFont = 'Georgia, "Times New Roman", serif';

  const jpSize = fontSizeToFit(ctx, els.jpName.value, textBox.w * 0.96, H * (isLeft ? 0.14 : 0.10), H * 0.06, jpFont, 700);
  ctx.font = `700 ${jpSize}px ${jpFont}`;
  ctx.fillStyle = '#111111';
  ctx.fillText(els.jpName.value, cx, textBox.y + textBox.h * 0.19);

  ctx.strokeStyle = gold;
  ctx.lineWidth = Math.max(2, W * 0.0018);
  ctx.beginPath();
  ctx.moveTo(textBox.x + textBox.w * 0.08, textBox.y + textBox.h * 0.34);
  ctx.lineTo(textBox.x + textBox.w * 0.92, textBox.y + textBox.h * 0.34);
  ctx.stroke();

  const enSize = fontSizeToFit(ctx, els.enName.value, textBox.w * 0.94, H * 0.06, H * 0.035, enFont, 400);
  ctx.font = `400 ${enSize}px ${enFont}`;
  ctx.fillStyle = '#5f4520';
  ctx.fillText(els.enName.value, cx, textBox.y + textBox.h * 0.47);

  const priceText = formatPrice(els.price.value);
  const priceSize = fontSizeToFit(ctx, priceText, textBox.w * 0.9, H * (isLeft ? 0.20 : 0.13), H * 0.09, priceFont, 700);
  ctx.font = `700 ${priceSize}px ${priceFont}`;
  ctx.fillStyle = '#c80000';
  ctx.fillText(priceText, cx, textBox.y + textBox.h * 0.73);

  if (els.taxMode.value === 'tax') {
    ctx.font = `600 ${Math.max(22, H * 0.043)}px ${jpFont}`;
    ctx.fillStyle = '#111111';
    ctx.fillText('（税込）', cx + textBox.w * 0.34, textBox.y + textBox.h * 0.76);
    ctx.font = `400 ${Math.max(18, H * 0.034)}px ${enFont}`;
    ctx.fillText('Tax included', cx + textBox.w * 0.27, textBox.y + textBox.h * 0.89);
  }
}

function drawHandwritten(ctx, W, H) {
  const pad = Math.round(W * 0.028);
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#ed8fa6';
  ctx.lineWidth = Math.max(7, W * 0.005);
  ctx.setLineDash([W * 0.018, W * 0.007]);
  roundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 18);
  ctx.stroke();
  ctx.setLineDash([]);

  // soft watercolor bands
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#f6a7b8';
  ctx.fillRect(W * 0.05, H * 0.05, W * 0.50, H * 0.035);
  ctx.fillRect(W * 0.60, H * 0.86, W * 0.34, H * 0.03);
  ctx.globalAlpha = 1;

  const isLeft = els.imageLayout.value === 'left';
  let imageBox, textBox;
  if (isLeft) {
    imageBox = { x: pad * 1.8, y: pad * 1.9, w: W * 0.49, h: H - pad * 3.8 };
    textBox = { x: W * 0.56, y: pad * 2.0, w: W * 0.38, h: H - pad * 4 };
  } else {
    imageBox = { x: pad * 1.8, y: pad * 1.7, w: W - pad * 3.6, h: H * 0.49 };
    textBox = { x: pad * 2.2, y: H * 0.56, w: W - pad * 4.4, h: H * 0.36 };
  }

  if (productImage) drawFittedImage(ctx, productImage, imageBox.x, imageBox.y, imageBox.w, imageBox.h, els.imageFit.value);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = textBox.x + textBox.w / 2;
  const jpFont = '"Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif';
  const enFont = '"Comic Sans MS", "Segoe Print", cursive';

  const jpSize = fontSizeToFit(ctx, els.jpName.value, textBox.w * 0.98, H * (isLeft ? 0.13 : 0.095), H * 0.055, jpFont, 800);
  ctx.font = `800 ${jpSize}px ${jpFont}`;
  ctx.fillStyle = '#35251f';
  ctx.fillText(els.jpName.value, cx, textBox.y + textBox.h * 0.21);

  ctx.strokeStyle = '#ef9bae';
  ctx.lineWidth = Math.max(8, W * 0.004);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(textBox.x + textBox.w * 0.08, textBox.y + textBox.h * 0.35);
  ctx.quadraticCurveTo(cx, textBox.y + textBox.h * 0.31, textBox.x + textBox.w * 0.92, textBox.y + textBox.h * 0.36);
  ctx.stroke();

  const enSize = fontSizeToFit(ctx, els.enName.value, textBox.w * 0.96, H * 0.055, H * 0.032, enFont, 400);
  ctx.font = `400 ${enSize}px ${enFont}`;
  ctx.fillStyle = '#3c2a23';
  ctx.fillText(els.enName.value, cx, textBox.y + textBox.h * 0.48);

  const priceText = formatPrice(els.price.value);
  const priceSize = fontSizeToFit(ctx, priceText, textBox.w * 0.92, H * (isLeft ? 0.18 : 0.12), H * 0.085, enFont, 700);
  ctx.font = `700 ${priceSize}px ${enFont}`;
  ctx.fillStyle = '#d92945';
  ctx.fillText(priceText, cx, textBox.y + textBox.h * 0.72);

  if (els.taxMode.value === 'tax') {
    ctx.font = `700 ${Math.max(22, H * 0.040)}px ${jpFont}`;
    ctx.fillStyle = '#2b211d';
    ctx.fillText('（税込）', cx + textBox.w * 0.34, textBox.y + textBox.h * 0.76);
    ctx.font = `400 ${Math.max(18, H * 0.032)}px ${enFont}`;
    ctx.fillText('Tax included', cx + textBox.w * 0.25, textBox.y + textBox.h * 0.89);
  }
}

function render() {
  setupCanvas();
  const ctx = els.canvas.getContext('2d');
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  if (els.template.value === 'handwritten') drawHandwritten(ctx, els.canvas.width, els.canvas.height);
  else drawSimple(ctx, els.canvas.width, els.canvas.height);
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

els.imageInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    productImageDataUrl = reader.result;
    productImage = await loadImageFromDataUrl(productImageDataUrl);
    render();
  };
  reader.readAsDataURL(file);
});

['jpName','enName','price','taxMode','template','cardSize','imageLayout','imageFit'].forEach(id => {
  els[id].addEventListener('input', render);
  els[id].addEventListener('change', render);
});

els.exportBtn.addEventListener('click', () => {
  render();
  const a = document.createElement('a');
  const safe = (els.jpName.value || 'price-card').replace(/[\\/:*?"<>|]/g, '_');
  a.download = `${safe}.png`;
  a.href = els.canvas.toDataURL('image/png');
  a.click();
});

els.printBtn.addEventListener('click', () => {
  render();
  const s = SIZES[els.cardSize.value];
  const dataUrl = els.canvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  win.document.write(`<!doctype html><html><head><title>印刷</title><style>@page{size:${s.mmW}mm ${s.mmH}mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:${s.mmW}mm;height:${s.mmH}mm}</style></head><body><img src="${dataUrl}" onload="window.print()"></body></html>`);
  win.document.close();
});

els.resetBtn.addEventListener('click', () => {
  els.jpName.value = '陶器セット　桜';
  els.enName.value = 'Ceramic Set – Sakura';
  els.price.value = 3800;
  els.taxMode.value = 'tax';
  els.template.value = 'simple';
  els.cardSize.value = 'business';
  els.imageLayout.value = 'left';
  els.imageFit.value = 'contain';
  els.imageInput.value = '';
  productImage = null;
  productImageDataUrl = '';
  render();
});

function currentProduct() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    jpName: els.jpName.value,
    enName: els.enName.value,
    price: Number(els.price.value || 0),
    taxMode: els.taxMode.value,
    template: els.template.value,
    cardSize: els.cardSize.value,
    imageLayout: els.imageLayout.value,
    imageFit: els.imageFit.value,
    imageDataUrl: productImageDataUrl,
    updatedAt: new Date().toISOString()
  };
}

function setStatus(msg) {
  els.status.textContent = msg;
}

function localProducts() {
  try { return JSON.parse(localStorage.getItem('kobunshaPriceProducts') || '[]'); }
  catch { return []; }
}

function saveLocalProduct(p) {
  const list = localProducts();
  list.unshift(p);
  localStorage.setItem('kobunshaPriceProducts', JSON.stringify(list.slice(0, 200)));
}

async function initFirebase() {
  if (!window.FIREBASE_CONFIG) return null;
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
    const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    const app = initializeApp(window.FIREBASE_CONFIG);
    const db = getFirestore(app);
    return {
      save: async (p) => addDoc(collection(db, 'priceCards'), p),
      list: async () => {
        const q = query(collection(db, 'priceCards'), orderBy('updatedAt', 'desc'), limit(200));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    };
  } catch (err) {
    console.error(err);
    setStatus('Firebase接続に失敗しました。ローカル保存を使用します。');
    return null;
  }
}

async function refreshProducts() {
  let list = [];
  if (firebaseApi) {
    try { list = await firebaseApi.list(); setStatus('Firebaseから商品一覧を読み込みました。'); }
    catch (e) { console.error(e); setStatus('Firebaseの読み込みに失敗しました。'); }
  } else {
    list = localProducts();
    setStatus('この端末に保存された商品一覧を読み込みました。');
  }
  els.productSelect.innerHTML = '<option value="">選択してください</option>';
  list.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${p.jpName || '商品'} / ${formatPrice(p.price)}`;
    opt.dataset.product = JSON.stringify(p);
    els.productSelect.appendChild(opt);
  });
}

els.saveProductBtn.addEventListener('click', async () => {
  const p = currentProduct();
  if (firebaseApi) {
    try { await firebaseApi.save(p); setStatus('Firebaseに商品を登録しました。'); }
    catch (e) { console.error(e); setStatus('Firebaseへの保存に失敗しました。'); }
  } else {
    saveLocalProduct(p);
    setStatus('この端末に商品を登録しました。');
  }
  refreshProducts();
});

els.refreshProductsBtn.addEventListener('click', refreshProducts);
els.productSelect.addEventListener('change', async () => {
  const opt = els.productSelect.selectedOptions[0];
  if (!opt?.dataset.product) return;
  const p = JSON.parse(opt.dataset.product);
  els.jpName.value = p.jpName || '';
  els.enName.value = p.enName || '';
  els.price.value = p.price || 0;
  els.taxMode.value = p.taxMode || 'tax';
  els.template.value = p.template || 'simple';
  els.cardSize.value = p.cardSize || 'business';
  els.imageLayout.value = p.imageLayout || 'left';
  els.imageFit.value = p.imageFit || 'contain';
  productImageDataUrl = p.imageDataUrl || '';
  productImage = await loadImageFromDataUrl(productImageDataUrl);
  render();
});

(async () => {
  firebaseApi = await initFirebase();
  render();
  refreshProducts();
})();
