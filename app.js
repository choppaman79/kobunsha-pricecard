(() => {
  const $ = id => document.getElementById(id);
  const excelFile = $('excelFile');
  const dropzone = $('dropzone');
  const tableBody = $('productTable');
  const cardGrid = $('cardGrid');
  const countText = $('countText');
  const searchInput = $('searchInput');
  const designSelect = $('designSelect');
  const ratioSelect = $('ratioSelect');
  const codeSize = $('codeSize');
  const codeSizeOut = $('codeSizeOut');
  const priceSize = $('priceSize');
  const priceSizeOut = $('priceSizeOut');
  const status = $('status');
  const clearBtn = $('clearBtn');
  const downloadSelected = $('downloadSelected');
  const downloadAll = $('downloadAll');
  const printAll = $('printAll');
  const printArea = $('printArea');

  let products = [];
  let filtered = [];
  let selectedIndex = -1;
  let globalJpSize = null;
  let globalEnSize = null;

  const aliases = {
    code: ['商品コード','商品番号','品番','コード','item code','product code','code'],
    jp: ['商品名','日本語商品名','日本語名','品名','product name','name'],
    en: ['英語表記','英語名','英文商品名','英語商品名','english','english name','en'],
    price: ['金額','価格','税込価格','販売価格','price','amount']
  };

  function normalize(s){ return String(s ?? '').trim().toLowerCase().replace(/[\s　_\-／/()（）]/g,''); }
  function findKey(row, list){
    const keys = Object.keys(row);
    for (const k of keys){
      const nk = normalize(k);
      if (list.some(a => normalize(a) === nk)) return k;
    }
    return null;
  }
  function parsePrice(v){
    if (typeof v === 'number') return Math.round(v);
    const n = Number(String(v ?? '').replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  function sanitizeFileName(s){ return String(s || 'card').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,' ').trim(); }
  function money(n){ return Number(n || 0).toLocaleString('ja-JP'); }

  async function readExcel(file){
    try{
      status.textContent = 'Excelを読み込んでいます…';
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
      if (!rows.length) throw new Error('データ行がありません。');

      const sample = rows[0];
      const keyCode = findKey(sample, aliases.code);
      const keyJp = findKey(sample, aliases.jp);
      const keyEn = findKey(sample, aliases.en);
      const keyPrice = findKey(sample, aliases.price);
      if (!keyJp || !keyPrice) throw new Error('「商品名」と「金額」の列を確認してください。');

      products = rows.map((r,i) => ({
        id: i,
        code: keyCode ? String(r[keyCode] ?? '').trim() : '',
        jp: String(r[keyJp] ?? '').trim(),
        en: keyEn ? String(r[keyEn] ?? '').trim() : '',
        price: parsePrice(r[keyPrice])
      })).filter(p => p.jp || p.code || p.price);

      if (!products.length) throw new Error('有効な商品データが見つかりません。');
      selectedIndex = 0;
      searchInput.disabled = false;
      searchInput.value = '';
      computeGlobalSizes();
      renderAll();
      updateButtons();
      status.textContent = `${products.length}件の商品を読み込みました。`;
      localStorage.setItem('kobunsha-pricecard-last', JSON.stringify(products));
    }catch(e){
      console.error(e);
      status.textContent = `読み込みエラー: ${e.message}`;
    }
  }

  function renderAll(){
    const q = normalize(searchInput.value);
    filtered = products.filter(p => !q || normalize(`${p.code} ${p.jp} ${p.en}`).includes(q));
    countText.textContent = `${filtered.length}件 / 全${products.length}件`;
    renderTable(); renderCards();
  }

  function renderTable(){
    if(!filtered.length){ tableBody.innerHTML = '<tr><td colspan="5" class="empty">該当する商品がありません。</td></tr>'; return; }
    tableBody.innerHTML = filtered.map(p => {
      const actual = products.indexOf(p);
      return `<tr class="${actual===selectedIndex?'selected':''}">
        <td>${escapeHtml(p.code)}</td><td>${escapeHtml(p.jp)}</td><td>${escapeHtml(p.en)}</td>
        <td class="price">¥${money(p.price)}</td><td><button class="row-btn" data-index="${actual}">選択</button></td></tr>`;
    }).join('');
    tableBody.querySelectorAll('.row-btn').forEach(b => b.onclick = () => selectProduct(Number(b.dataset.index)));
  }

  function renderCards(){
    if(!filtered.length){ cardGrid.innerHTML = '<div class="empty-preview">表示する商品がありません。</div>'; return; }
    cardGrid.innerHTML = '';
    filtered.forEach(p => {
      const actual = products.indexOf(p);
      const wrap = document.createElement('div');
      wrap.className = 'card-wrap' + (actual === selectedIndex ? ' selected' : '');
      const canvas = document.createElement('canvas');
      drawCard(canvas,p);
      const meta = document.createElement('div');
      meta.className = 'card-meta';
      meta.innerHTML = `<span>${escapeHtml(p.code || 'コードなし')}</span><span>¥${money(p.price)}</span>`;
      wrap.append(canvas,meta);
      wrap.onclick = () => selectProduct(actual);
      cardGrid.appendChild(wrap);
    });
  }

  function selectProduct(i){ selectedIndex = i; renderTable(); renderCards(); updateButtons(); }
  function updateButtons(){
    const has = products.length > 0;
    downloadSelected.disabled = !has || selectedIndex < 0;
    downloadAll.disabled = !has;
    printAll.disabled = !has;
  }

  const PXPMM = 1400/91; // px-per-mm resolution used for print-quality canvases

  function getCanvasSize(){
    return ratioSelect.value === 'square'
      ? {w:1200,h:1200}
      : {w:Math.round(105*PXPMM), h:Math.round(145*PXPMM)};
  }

  function computeGlobalSizes(){
    if(!products.length){ globalJpSize = null; globalEnSize = null; return; }
    const {w} = getCanvasSize();
    const tmp = document.createElement('canvas');
    const ctx = tmp.getContext('2d');
    const m = Math.round(w*0.035);
    const jpMax = ratioSelect.value==='square' ? 120 : 105;
    let minJp = jpMax*(w/1400);
    let minEn = 54*(w/1400);
    products.forEach(p => {
      const js = fitText(ctx, p.jp, w-m*3, jpMax*(w/1400), 44*(w/1400));
      if (js < minJp) minJp = js;
      const es = fitLatin(ctx, p.en || '', w-m*3, 54*(w/1400), 28*(w/1400));
      if (es < minEn) minEn = es;
    });
    globalJpSize = minJp;
    globalEnSize = minEn;
  }

  function fitText(ctx,text,maxWidth,maxSize,minSize=28){
    let size=maxSize;
    while(size>minSize){ ctx.font = `700 ${size}px "Yu Mincho","Hiragino Mincho ProN",serif`; if(ctx.measureText(text).width<=maxWidth) break; size-=2; }
    return size;
  }

  function drawCard(canvas,p){
    const {w,h}=getCanvasSize(); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d');
    const blue = designSelect.value === 'blue';
    const border = blue ? '#174f85' : '#1b1b1b';
    const secondary = blue ? '#174f85' : '#111';
    const m = Math.round(w*0.035);
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
    ctx.lineWidth = blue ? Math.max(7,w*0.006) : Math.max(2,w*0.002);
    ctx.strokeStyle=border; ctx.strokeRect(m,m,w-2*m,h-2*m);

    const codePx = Number(codeSize.value) * (w/420);
    ctx.fillStyle=secondary; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.font=`500 ${codePx}px "Times New Roman",Times,serif`;
    ctx.fillText(p.code || '',m*1.9,h*0.155);

    if(blue){
      ctx.strokeStyle=blue; ctx.lineWidth=Math.max(3,w*0.0025);
      ctx.beginPath();ctx.moveTo(m*1.5,h*0.19);ctx.lineTo(w-m*1.5,h*0.19);ctx.stroke();
    }

    ctx.textAlign='center'; ctx.fillStyle='#050505';
    const jpMax = ratioSelect.value==='square' ? 120 : 105;
    const jpSize = globalJpSize ?? fitText(ctx,p.jp,w-m*3,jpMax*(w/1400),44*(w/1400));
    ctx.font=`700 ${jpSize}px "Yu Mincho","Hiragino Mincho ProN",serif`;
    const titleY = ratioSelect.value==='square' ? h*0.38 : h*0.43;
    ctx.fillText(p.jp,w/2,titleY);

    ctx.fillStyle=secondary; ctx.font=`500 ${54*(w/1400)}px "Times New Roman",Times,serif`;
    const en = p.en || '';
    const enSize = globalEnSize ?? fitLatin(ctx,en,w-m*3,54*(w/1400),28*(w/1400));
    ctx.font=`500 ${enSize}px "Times New Roman",Times,serif`;
    const enY=ratioSelect.value==='square'?h*0.49:h*0.56;
    ctx.fillText(en,w/2,enY);

    if(blue){
      ctx.strokeStyle=blue;ctx.lineWidth=Math.max(3,w*0.0025);
      const lineY=ratioSelect.value==='square'?h*0.55:h*0.62;
      ctx.beginPath();ctx.moveTo(m*1.5,lineY);ctx.lineTo(w-m*1.5,lineY);ctx.stroke();
    }

    const pp = Number(priceSize.value)*(w/420);
    const priceText=`¥${money(p.price)}`;
    const priceY = ratioSelect.value==='square'?h*0.78:h*0.82;
    ctx.font=`700 ${pp}px "Times New Roman",Times,serif`;
    ctx.fillStyle='#d40000'; ctx.textAlign='center';
    const priceWidth=ctx.measureText(priceText).width;
    const taxFont=42*(w/1400);
    ctx.font=`700 ${taxFont}px "Yu Mincho","Hiragino Mincho ProN",serif`;
    const taxW=ctx.measureText('（税込）').width;
    const totalW=priceWidth+taxW+24*(w/1400);
    let startX=(w-totalW)/2;
    ctx.font=`700 ${pp}px "Times New Roman",Times,serif`; ctx.textAlign='left';ctx.fillStyle='#d40000';
    ctx.fillText(priceText,startX,priceY);
    ctx.font=`700 ${taxFont}px "Yu Mincho","Hiragino Mincho ProN",serif`;ctx.fillStyle='#050505';
    ctx.fillText('（税込）',startX+priceWidth+20*(w/1400),priceY-5*(w/1400));

    ctx.font=`500 ${34*(w/1400)}px "Times New Roman",Times,serif`;ctx.fillStyle=secondary;ctx.textAlign='right';
    ctx.fillText('Tax included',w-m*1.7,h-m*1.35);
  }

  function fitLatin(ctx,text,maxWidth,maxSize,minSize){
    let size=maxSize; while(size>minSize){ctx.font=`500 ${size}px "Times New Roman",Times,serif`;if(ctx.measureText(text).width<=maxWidth)break;size-=2;}return size;
  }

  function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function downloadBlob(blob,name){ const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200); }
  function canvasToBlob(canvas){ return new Promise(resolve=>canvas.toBlob(resolve,'image/png',1)); }
  function createCardCanvas(p){ const c=document.createElement('canvas');drawCard(c,p);return c; }

  downloadSelected.onclick = async () => {
    if(selectedIndex<0)return; const p=products[selectedIndex]; const c=createCardCanvas(p); const blob=await canvasToBlob(c);
    downloadBlob(blob,`${sanitizeFileName(p.code||'商品')}_${sanitizeFileName(p.jp)}.png`);
  };

  downloadAll.onclick = async () => {
    if(!products.length)return; status.textContent='PNGをZIPにまとめています…';
    const zip=new JSZip();
    for(let i=0;i<products.length;i++){
      const p=products[i], c=createCardCanvas(p), blob=await canvasToBlob(c);
      zip.file(`${String(i+1).padStart(3,'0')}_${sanitizeFileName(p.code||'商品')}_${sanitizeFileName(p.jp)}.png`,blob);
    }
    const out=await zip.generateAsync({type:'blob'});downloadBlob(out,'kobunsha_price_cards.zip');
    status.textContent=`${products.length}枚のカードをZIP保存しました。`;
  };

  printAll.onclick = () => {
    printArea.innerHTML = '';
    const {w,h} = getCanvasSize();
    const wMM = +(w/PXPMM).toFixed(2);
    const hMM = +(h/PXPMM).toFixed(2);
    const availW = 196, gapCol = 8, gapRow = 4; // A4 portrait minus 7mm margins
    const cols = Math.max(1, Math.floor((availW+gapCol)/(wMM+gapCol)));
    const totalWMM = cols*wMM + (cols-1)*gapCol;
    document.documentElement.style.setProperty('--card-w-mm', wMM+'mm');
    document.documentElement.style.setProperty('--card-h-mm', hMM+'mm');
    document.documentElement.style.setProperty('--print-cols', cols);
    printArea.style.width = totalWMM+'mm';
    products.forEach(p=>printArea.appendChild(createCardCanvas(p)));
    window.print();
  };

  searchInput.oninput=renderAll;
  [designSelect,ratioSelect,codeSize,priceSize].forEach(el=>el.addEventListener('input',()=>{codeSizeOut.value=codeSize.value;priceSizeOut.value=priceSize.value;if(el===ratioSelect)computeGlobalSizes();renderCards();}));
  clearBtn.onclick=()=>{products=[];filtered=[];selectedIndex=-1;excelFile.value='';searchInput.value='';searchInput.disabled=true;countText.textContent='0件';tableBody.innerHTML='<tr><td colspan="5" class="empty">Excelを読み込むと商品一覧が表示されます。</td></tr>';cardGrid.innerHTML='<div class="empty-preview">読み込み後、ここにプライスカードが表示されます。</div>';status.textContent='Excelを読み込んでください。';updateButtons();localStorage.removeItem('kobunsha-pricecard-last');};
  excelFile.onchange=e=>{if(e.target.files[0])readExcel(e.target.files[0]);};
  ['dragenter','dragover'].forEach(n=>dropzone.addEventListener(n,e=>{e.preventDefault();dropzone.classList.add('drag');}));
  ['dragleave','drop'].forEach(n=>dropzone.addEventListener(n,e=>{e.preventDefault();dropzone.classList.remove('drag');}));
  dropzone.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)readExcel(f);});

  codeSizeOut.value=codeSize.value; priceSizeOut.value=priceSize.value;
  try{
    const last=JSON.parse(localStorage.getItem('kobunsha-pricecard-last')||'null');
    if(Array.isArray(last)&&last.length){products=last;selectedIndex=0;searchInput.disabled=false;computeGlobalSizes();renderAll();updateButtons();status.textContent=`前回の${products.length}件を復元しました。Excelを再読込すると置き換わります。`;}
  }catch(_){}
})();
