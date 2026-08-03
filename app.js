const C = window.APP_CONFIG;
const state = {
  prices: Object.fromEntries(C.holdings.map(h => [h.id, h.fallbackPrice])),
  usdTwd: C.fallbackUsdTwd,
  sound: true,
  countdown: C.refreshSeconds,
  autoRefresh: localStorage.getItem('autoRefresh') !== 'false'
};

const $ = s => document.querySelector(s);
const money = (n, c='TWD') => new Intl.NumberFormat('zh-TW',{style:'currency',currency:c,maximumFractionDigits:c==='TWD'?0:2}).format(n);
const num = n => new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(n);
const signed = n => `${n >= 0 ? '+' : '-'}${money(Math.abs(n),'TWD')}`;

function holdingData(h){
  const price = Number(state.prices[h.id] ?? h.fallbackPrice);
  const pnlOriginal = (price - h.cost) * h.qty;
  const fx = h.currency === 'USD' ? state.usdTwd : 1;
  return {...h,price,pnlOriginal,pnlTwd:pnlOriginal*fx,costTwd:h.cost*h.qty*fx,valueTwd:price*h.qty*fx};
}

function render(){
  const data = C.holdings.map(holdingData);
  const totalPnl = data.reduce((s,h)=>s+h.pnlTwd,0);
  const totalCost = data.reduce((s,h)=>s+h.costTwd,0);
  const pct = totalCost ? totalPnl/totalCost*100 : 0;
  $('#totalPnl').textContent = signed(totalPnl);
  $('#totalPnlPct').textContent = `${pct>=0?'+':''}${pct.toFixed(2)}%`;
  $('.summary-card.total').classList.toggle('loss',totalPnl<0);
  $('.summary-card.total').classList.toggle('profit',totalPnl>=0);
  $('#totalCost').textContent = money(totalCost,'TWD');
  $('#usdTwd').textContent = state.usdTwd.toFixed(3);
  $('#portfolio').innerHTML = data.map(h=>{
    const loss=h.pnlTwd<0;
    return `<article class="stock-card" data-id="${h.id}" style="--glow:${loss?'var(--red)':'var(--green)'}">
      <div class="card-top"><div><div class="ticker-code">${h.ticker}</div><h3>${h.name}</h3></div><span class="status-badge">${h.market==='MANUAL'?'手動估值':'API'}</span></div>
      <div class="price">${money(h.price,h.currency)}</div><div class="currency">最新現價 · ${h.currency}</div>
      <div class="card-stats">
        <div class="stat"><span>入場成本</span><b>${money(h.cost,h.currency)}</b></div>
        <div class="stat"><span>持有數量</span><b>${num(h.qty)} 股</b></div>
        <div class="stat"><span>每股價差</span><b>${h.price-h.cost>=0?'+':''}${num(h.price-h.cost)}</b></div>
      </div>
      <div class="pnl ${loss?'loss':'profit'}">${loss?'賠':'賺'} ${money(Math.abs(h.pnlOriginal),h.currency)}<br><small>約 ${signed(h.pnlTwd)}</small></div>
      ${h.note?`<div class="manual-note">${h.note}</div>`:''}
    </article>`;
  }).join('');
  const tickerHtml=data.map(h=>`<span class="${h.pnlTwd<0?'down':'up'}">${h.ticker} ${money(h.price,h.currency)} · ${signed(h.pnlTwd)}</span>`).join('');
  $('#ticker').innerHTML=tickerHtml+tickerHtml;
  document.querySelectorAll('.stock-card').forEach(card=>card.addEventListener('click',()=>cardEvent(card)));
}

async function fetchYahooWorker() {
  const symbols = [
    ...C.holdings.map(item => item.apiSymbol),
    "USDTWD=X"
  ];

  const url =
    `${C.workerUrl}/?symbols=${encodeURIComponent(symbols.join(","))}` +
    `&timestamp=${Date.now()}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Worker 回傳 HTTP ${response.status}`);
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error(
      result.message || "Worker 沒有回傳有效資料"
    );
  }

  const usdQuote = result.data["USDTWD=X"];

  if (
    usdQuote &&
    usdQuote.success &&
    Number.isFinite(Number(usdQuote.price))
  ) {
    state.usdTwd = Number(usdQuote.price);
  }

  let successCount = 0;
  const failedSymbols = [];

  for (const holding of C.holdings) {
    const quote = result.data[holding.apiSymbol];

    if (
      quote &&
      quote.success &&
      Number.isFinite(Number(quote.price))
    ) {
      state.prices[holding.id] = Number(quote.price);
      successCount++;
    } else {
      failedSymbols.push(holding.apiSymbol);

      console.warn(
        `${holding.apiSymbol} 更新失敗：`,
        quote?.error || "沒有報價"
      );
    }
  }

  document.querySelector("#fxSource").textContent =
    usdQuote?.success ? "Yahoo Finance" : "預設匯率";

  if (failedSymbols.length > 0) {
    console.warn(
      "以下股票報價更新失敗：",
      failedSymbols.join(", ")
    );
  
  }

  return successCount > 0;
}

async function refresh() {
  const btn = document.querySelector("#refreshBtn");

  btn.disabled = true;
  btn.textContent = "更新中…";

  try {
    const ok = await fetchYahooWorker();

    render();

    document.querySelector("#updatedAt").textContent =
      new Date().toLocaleString("zh-TW", {
        hour12: false
      });

    state.countdown = C.refreshSeconds;

    toast(
      ok
        ? "Yahoo Finance 股價更新完成"
        : "未取得新報價，顯示上次價格"
    );

    playTone(ok ? "success" : "soft");
  } catch (error) {
    console.error("股價更新失敗：", error);

    render();

    toast(`更新失敗：${error.message}`);
    playTone("fail");
  } finally {
    btn.disabled = false;
    btn.textContent = "立即更新";
  }
}

function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2600)}
function playTone(type='soft'){
  if(!state.sound)return;
  const A=window.AudioContext||window.webkitAudioContext; if(!A)return;
  const ctx=new A(),o=ctx.createOscillator(),g=ctx.createGain();
  const presets={success:[660,880],fail:[180,90],soft:[300,430],chaos:[120,720]};
  const [a,b]=presets[type]||presets.soft;o.type=type==='fail'?'sawtooth':'triangle';o.frequency.setValueAtTime(a,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(b,ctx.currentTime+.22);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.14,ctx.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.35);o.connect(g).connect(ctx.destination);o.start();o.stop(ctx.currentTime+.38);
}
function playRandomMp3(){
  if(!state.sound)return;
  const src=C.mp3Files[Math.floor(Math.random()*C.mp3Files.length)];
  const a=new Audio(src);a.volume=.65;a.play().catch(()=>playTone('chaos'));
}
function burst(x=innerWidth/2,y=innerHeight/2,amount=20){
  const chars=['-$$$','爆','哭','GG','▼','💸'];
  for(let i=0;i<amount;i++){const p=document.createElement('span');p.className='particle';p.textContent=chars[Math.floor(Math.random()*chars.length)];p.style.left=`${x}px`;p.style.top=`${y}px`;p.style.setProperty('--x',`${(Math.random()-.5)*420}px`);p.style.setProperty('--y',`${-80-Math.random()*350}px`);p.style.setProperty('--r',`${(Math.random()-.5)*500}deg`);p.style.color=Math.random()>.5?'var(--red)':'var(--yellow)';document.body.appendChild(p);setTimeout(()=>p.remove(),1200)}
}
function cardEvent(card){
  card.classList.remove('hit');void card.offsetWidth;card.classList.add('hit');
  const r=card.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2,12);playRandomMp3();
  const h=holdingData(C.holdings.find(x=>x.id===card.dataset.id));
  toast(h.pnlTwd<0?`${h.name} 又被套住了 ${money(Math.abs(h.pnlTwd),'TWD')}`:`${h.name} 正在賺錢！`);
}
const lines=['今天不是下跌，只是資產在蹲低。','吉米精靈表示：還沒賣就不算輸。','警告：損益正在挑戰實況主血壓。','市場只是暫時不懂你的價值。','點一次不夠，建議再點一次。','藍藍幫已進入抄底模式。'];
function spriteEvent(){const s=$('#sprite');s.classList.add('angry');setTimeout(()=>s.classList.remove('angry'),900);const msg=lines[Math.floor(Math.random()*lines.length)];$('#spriteMessage').textContent=msg;burst(innerWidth*.25,innerHeight*.72,18);playRandomMp3();toast(msg)}
function chaos(){document.body.classList.add('screen-flash');setTimeout(()=>document.body.classList.remove('screen-flash'),450);document.querySelectorAll('.stock-card').forEach((c,i)=>setTimeout(()=>{c.classList.add('hit');setTimeout(()=>c.classList.remove('hit'),600)},i*55));burst(innerWidth/2,innerHeight/2,60);playTone('chaos');playRandomMp3();toast('全資產損益大爆擊！')}
function renderSocials(){ $('#socialLinks').innerHTML=C.socialLinks.map(x=>`<a class="social-link" href="${x.url}" target="_blank" rel="noopener"><span><span class="social-icon">${x.icon}</span></span><span>${x.name} →</span></a>`).join('') }

$('#refreshBtn').addEventListener('click',refresh);$('#chaosBtn').addEventListener('click',chaos);$('#sprite').addEventListener('click',spriteEvent);$('#sprite').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')spriteEvent()});$('#summonBtn').addEventListener('click',spriteEvent);
$('#soundBtn').addEventListener('click',e=>{state.sound=!state.sound;e.currentTarget.textContent=`音效：${state.sound?'開':'關'}`;e.currentTarget.setAttribute('aria-pressed',String(state.sound));if(state.sound)playTone('success')});
$('#settingsBtn').addEventListener('click',()=>{ $('#apiKeyInput').value=localStorage.getItem('twelveDataKey')||'';$('#autoRefreshInput').checked=state.autoRefresh;$('#settingsDialog').showModal() });
$('#saveSettingsBtn').addEventListener('click',()=>{const k=$('#apiKeyInput').value.trim();if(k)localStorage.setItem('twelveDataKey',k);state.autoRefresh=$('#autoRefreshInput').checked;localStorage.setItem('autoRefresh',String(state.autoRefresh));setTimeout(refresh,0)});
$('#clearKeyBtn').addEventListener('click',()=>{localStorage.removeItem('twelveDataKey');$('#apiKeyInput').value='';toast('API Key 已清除')});
setInterval(()=>{if(!state.autoRefresh){$('#countdown').textContent='自動更新已關閉';return}state.countdown--;if(state.countdown<=0)refresh();$('#countdown').textContent=`${Math.max(0,state.countdown)} 秒後自動更新`},1000);
renderSocials();
render();

document.querySelector("#autoRefreshInput").checked =
  state.autoRefresh;

setTimeout(() => {
  refresh();
}, 500);
