(() => {
  "use strict";

  const C = window.APP_CONFIG;
  if (!C) throw new Error("找不到 APP_CONFIG，請確認 config.js 已正確載入。");

  const state = {
    prices: Object.fromEntries(C.holdings.map(h => [h.id, h.fallbackPrice])),
    usdTwd: C.fallbackUsdTwd,
    sound: true,
    countdown: C.refreshSeconds,
    autoRefresh: localStorage.getItem("autoRefresh") !== "false",
    refreshing: false,
    lastSuccessAt: null
  };

  const $ = selector => document.querySelector(selector);
  const money = (value, currency = "TWD") => new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "TWD" ? 0 : 2
  }).format(Number(value) || 0);
  const number = value => new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(Number(value) || 0);
  const signedTwd = value => `${value >= 0 ? "+" : "-"}${money(Math.abs(value), "TWD")}`;

  function holdingData(h) {
    const price = Number(state.prices[h.id] ?? h.fallbackPrice);
    const pnlOriginal = (price - h.cost) * h.qty;
    const fx = h.currency === "USD" ? state.usdTwd : 1;
    return {
      ...h,
      price,
      pnlOriginal,
      pnlTwd: pnlOriginal * fx,
      costTwd: h.cost * h.qty * fx,
      valueTwd: price * h.qty * fx
    };
  }

  function render() {
    const data = C.holdings.map(holdingData);
    const totalPnl = data.reduce((sum, h) => sum + h.pnlTwd, 0);
    const totalCost = data.reduce((sum, h) => sum + h.costTwd, 0);
    const pct = totalCost ? totalPnl / totalCost * 100 : 0;

    $("#totalPnl").textContent = signedTwd(totalPnl);
    $("#totalPnlPct").textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
    $(".summary-card.total").classList.toggle("loss", totalPnl < 0);
    $(".summary-card.total").classList.toggle("profit", totalPnl >= 0);
    $("#totalCost").textContent = money(totalCost, "TWD");
    $("#usdTwd").textContent = state.usdTwd.toFixed(3);

    const sorted = [...data].sort((a, b) => a.pnlTwd - b.pnlTwd);
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    $("#worstHolding").textContent = worst?.name || "—";
    $("#worstPnl").textContent = worst ? signedTwd(worst.pnlTwd) : "—";
    $("#bestHolding").textContent = best?.name || "—";
    $("#bestPnl").textContent = best ? signedTwd(best.pnlTwd) : "—";

    $("#portfolio").innerHTML = data.map(h => {
      const isLoss = h.pnlTwd < 0;
      const diff = h.price - h.cost;
      return `<article class="stock-card ${isLoss ? "is-loss" : "is-profit"}" data-id="${h.id}" style="--glow:${isLoss ? "var(--red)" : "var(--green)"}">
        <div class="card-top">
          <div><div class="ticker-code">${h.ticker}</div><h3>${h.name}</h3></div>
          <span class="status-badge">Yahoo</span>
        </div>
        <div class="price">${money(h.price, h.currency)}</div>
        <div class="currency">最新現價 · ${h.currency}</div>
        <div class="card-stats">
          <div class="stat"><span>入場成本</span><b>${money(h.cost, h.currency)}</b></div>
          <div class="stat"><span>持有數量</span><b>${number(h.qty)} 股</b></div>
          <div class="stat"><span>每股價差</span><b>${diff >= 0 ? "+" : ""}${number(diff)}</b></div>
        </div>
        <div class="pnl ${isLoss ? "loss" : "profit"}">${isLoss ? "賠" : "賺"} ${money(Math.abs(h.pnlOriginal), h.currency)}<br><small>約 ${signedTwd(h.pnlTwd)}</small></div>
      </article>`;
    }).join("");

    const tickerHtml = data.map(h => `<span class="${h.pnlTwd < 0 ? "down" : "up"}">${h.ticker} ${money(h.price, h.currency)} · ${signedTwd(h.pnlTwd)}</span>`).join("");
    $("#ticker").innerHTML = tickerHtml + tickerHtml;

    document.querySelectorAll(".stock-card").forEach(card => {
      card.addEventListener("click", () => cardEvent(card));
    });
  }

  async function fetchYahooWorker() {
    const symbols = [...new Set([...C.holdings.map(h => h.apiSymbol), "USDTWD=X"])];
    const url = `${C.workerUrl}/?symbols=${encodeURIComponent(symbols.join(","))}&t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });

    if (!response.ok) throw new Error(`Worker 回傳 HTTP ${response.status}`);
    const result = await response.json();
    if (!result || !result.data) throw new Error(result?.message || "Worker 未回傳有效資料");

    const usdQuote = result.data["USDTWD=X"];
    if (usdQuote?.success && Number.isFinite(Number(usdQuote.price))) {
      state.usdTwd = Number(usdQuote.price);
    }

    let successCount = 0;
    const failed = [];

    for (const h of C.holdings) {
      const quote = result.data[h.apiSymbol];
      if (quote?.success && Number.isFinite(Number(quote.price))) {
        state.prices[h.id] = Number(quote.price);
        successCount++;
      } else {
        failed.push(h.apiSymbol);
      }
    }

    $("#fxSource").textContent = usdQuote?.success ? "Yahoo Finance" : "預設匯率";
    $("#apiStatus").textContent = successCount ? "連線正常" : "連線失敗";
    $("#apiStatus").className = successCount ? "status-ok" : "status-error";
    $("#apiDetail").textContent = failed.length ? `成功 ${successCount} 檔，失敗 ${failed.length} 檔` : `成功更新 ${successCount} 檔股票`;

    if (failed.length) console.warn("以下代號未取得新報價：", failed.join(", "));
    return successCount > 0;
  }

  async function refresh() {
    if (state.refreshing) return;
    state.refreshing = true;

    const btn = $("#refreshBtn");
    btn.disabled = true;
    btn.textContent = "更新中…";
    $("#apiStatus").textContent = "連線中";

    try {
      const ok = await fetchYahooWorker();
      render();
      state.lastSuccessAt = ok ? new Date() : state.lastSuccessAt;
      $("#updatedAt").textContent = new Date().toLocaleString("zh-TW", { hour12: false });
      state.countdown = C.refreshSeconds;
      toast(ok ? "Yahoo Finance 股價更新完成" : "未取得新報價，保留上次價格");
      playTone(ok ? "success" : "soft");
    } catch (error) {
      console.error(error);
      render();
      $("#apiStatus").textContent = "連線失敗";
      $("#apiStatus").className = "status-error";
      $("#apiDetail").textContent = error.message;
      toast(`更新失敗：${error.message}`);
      playTone("fail");
    } finally {
      btn.disabled = false;
      btn.textContent = "立即更新";
      state.refreshing = false;
    }
  }

  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function playTone(type = "soft") {
    if (!state.sound) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const presets = { success: [660, 880], fail: [180, 90], soft: [300, 430], chaos: [120, 720] };
    const [start, end] = presets[type] || presets.soft;
    osc.type = type === "fail" ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(start, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(end, ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.38);
  }

  function playRandomMp3() {
    if (!state.sound || !C.mp3Files?.length) return;
    const src = C.mp3Files[Math.floor(Math.random() * C.mp3Files.length)];
    const audio = new Audio(src);
    audio.volume = 0.65;
    audio.play().catch(() => playTone("chaos"));
  }

  function burst(x = innerWidth / 2, y = innerHeight / 2, amount = 20) {
    const chars = ["-$$$", "爆", "哭", "GG", "▼", "💸"];
    for (let i = 0; i < amount; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      p.textContent = chars[Math.floor(Math.random() * chars.length)];
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.setProperty("--x", `${(Math.random() - 0.5) * 420}px`);
      p.style.setProperty("--y", `${-80 - Math.random() * 350}px`);
      p.style.setProperty("--r", `${(Math.random() - 0.5) * 500}deg`);
      p.style.color = Math.random() > 0.5 ? "var(--red)" : "var(--yellow)";
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }
  }

  function cardEvent(card) {
    card.classList.remove("hit");
    void card.offsetWidth;
    card.classList.add("hit");
    const rect = card.getBoundingClientRect();
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 12);
    playRandomMp3();
    const holding = holdingData(C.holdings.find(x => x.id === card.dataset.id));
    toast(holding.pnlTwd < 0 ? `${holding.name} 目前虧損 ${money(Math.abs(holding.pnlTwd), "TWD")}` : `${holding.name} 目前獲利 ${money(holding.pnlTwd, "TWD")}`);
  }

  function chaos() {
    document.body.classList.add("screen-flash");
    setTimeout(() => document.body.classList.remove("screen-flash"), 450);
    document.querySelectorAll(".stock-card").forEach((card, i) => {
      setTimeout(() => {
        card.classList.add("hit");
        setTimeout(() => card.classList.remove("hit"), 600);
      }, i * 55);
    });
    burst(innerWidth / 2, innerHeight / 2, 60);
    playTone("chaos");
    playRandomMp3();
    toast("全資產損益大爆擊");
  }

  function renderSocials() {
    $("#socialLinks").innerHTML = C.socialLinks.map(x => `<a class="social-link" href="${x.url}" target="_blank" rel="noopener"><span class="social-icon">${x.icon}</span><span>${x.name} →</span></a>`).join("");
  }

  $("#refreshBtn")?.addEventListener("click", refresh);
  $("#chaosBtn")?.addEventListener("click", chaos);
  $("#soundBtn")?.addEventListener("click", event => {
    state.sound = !state.sound;
    event.currentTarget.textContent = `音效：${state.sound ? "開" : "關"}`;
    event.currentTarget.setAttribute("aria-pressed", String(state.sound));
    if (state.sound) playTone("success");
  });
  $("#autoRefreshBtn")?.addEventListener("click", event => {
    state.autoRefresh = !state.autoRefresh;
    localStorage.setItem("autoRefresh", String(state.autoRefresh));
    event.currentTarget.textContent = `自動更新：${state.autoRefresh ? "開" : "關"}`;
    event.currentTarget.setAttribute("aria-pressed", String(state.autoRefresh));
    state.countdown = C.refreshSeconds;
    toast(state.autoRefresh ? "已開啟自動更新" : "已關閉自動更新");
  });

  setInterval(() => {
    if (!state.autoRefresh) {
      $("#countdown").textContent = "自動更新已關閉";
      return;
    }
    state.countdown--;
    if (state.countdown <= 0) refresh();
    $("#countdown").textContent = `${Math.max(0, state.countdown)} 秒後自動更新`;
  }, 1000);

  renderSocials();
  render();
  const autoRefreshBtn = $("#autoRefreshBtn");
  if (autoRefreshBtn) {
    autoRefreshBtn.textContent = `自動更新：${state.autoRefresh ? "開" : "關"}`;
    autoRefreshBtn.setAttribute("aria-pressed", String(state.autoRefresh));
  }
  setTimeout(refresh, 400);
})();
