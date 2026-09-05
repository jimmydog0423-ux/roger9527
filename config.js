window.APP_CONFIG = {
  refreshSeconds: 86400,
  workerUrl: "https://lucky-rice-01c0.jimmydog0423.workers.dev",
  workerUrl2: "https://crimson-union-c21f.jimmydog0702.workers.dev",
  fallbackUsdTwd: 31.63,

  socialLinks: [
    { name: "Twitch", url: "https://www.twitch.tv/roger9527", icon: "TW" },
    { name: "Facebook", url: "https://www.facebook.com/Roger95279527", icon: "FB" },
    { name: "YouTube", url: "https://www.youtube.com/@Roger9527-sb", icon: "YT" }
  ],

  /*
   * 羅傑沒有公開完整成本、股數、買賣價格與即時持倉細節。
   * 所以這裡不假裝能算出真實即時損益，而是以 2026/09/04 的公開損益
   * 當基準，再用台股 / 美股大盤相對基準點的變化做動態估算。
   */
  holdings: [],

  disclosedPortfolio: {
    baselineDate: "2026/09/04",
    taiwanTotal: -320000,
    usTotal: -5800,

    marketBaseline: {
      twSymbol: "^TWII",
      twName: "台灣加權指數",
      twIndex: 46551.13,

      usSymbol: "^IXIC",
      usName: "NASDAQ Composite",
      usIndex: 26506.99
    },

    positions: [
      { id: "mu", name: "美光", ticker: "MU", pnl: 1500, currency: "USD", status: "持有中" },
      { id: "skhy", name: "海力士", ticker: "", pnl: 1000, currency: "USD", status: "持有中" },
      { id: "mrvl", name: "MRVL", ticker: "MRVL", pnl: -4400, currency: "USD", status: "持有中" },
      { id: "rocket", name: "火箭", ticker: "", pnl: -2100, currency: "USD", status: "持有中" },
      { id: "tsla", name: "特斯拉", ticker: "TSLA", pnl: null, currency: "USD", status: "已賣出" }
    ]
  },

  mp3Files: [
    "assets/sounds/lose-1.mp3",
    "assets/sounds/lose-2.mp3",
    "assets/sounds/win-1.mp3",
    "assets/sounds/alert-1.mp3"
  ]
};

(() => {
  "use strict";

  const C = window.APP_CONFIG;
  const disclosed = C.disclosedPortfolio;
  const REFRESH_MS = 60 * 1000;

  const state = {
    twIndex: disclosed.marketBaseline.twIndex,
    usIndex: disclosed.marketBaseline.usIndex,
    usdTwd: C.fallbackUsdTwd,
    twChange: 0,
    usChange: 0,
    loading: false,
    updatedAt: null,
    source: "基準資料"
  };

  try {
    localStorage.setItem("autoRefresh", "false");
  } catch (error) {
    console.warn("無法寫入自動更新設定", error);
  }

  /* 阻止舊 app.js 在載入後立即啟動舊持倉行情刷新。 */
  const nativeSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = function (callback, delay, ...args) {
    if (
      delay === 400 &&
      typeof callback === "function" &&
      callback.name === "refresh"
    ) {
      return 0;
    }
    return nativeSetTimeout(callback, delay, ...args);
  };

  nativeSetTimeout(() => {
    window.setTimeout = nativeSetTimeout;
  }, 0);

  const number = value => Number(value) || 0;

  const formatTwd = value => {
    const amount = Math.round(Math.abs(number(value))).toLocaleString("zh-TW");
    return `${value >= 0 ? "+" : "-"}NT$${amount}`;
  };

  const formatUsd = value => {
    const amount = Math.round(Math.abs(number(value))).toLocaleString("en-US");
    return `${value >= 0 ? "+" : "-"}US$${amount}`;
  };

  const formatPct = value => {
    const pct = number(value) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  };

  const estimatedPnl = (baselinePnl, marketChange) => {
    const base = number(baselinePnl);
    return base + Math.abs(base) * number(marketChange);
  };

  const calculate = () => {
    const twEstimated = estimatedPnl(disclosed.taiwanTotal, state.twChange);
    const usEstimated = estimatedPnl(disclosed.usTotal, state.usChange);
    const totalTwd = twEstimated + usEstimated * state.usdTwd;

    return {
      twEstimated,
      usEstimated,
      totalTwd
    };
  };

  const cardClass = value => number(value) < 0 ? "is-loss" : "is-profit";

  const positionHtml = position => {
    const sold = position.status === "已賣出";
    const tickerText = position.ticker || "未公開代號";
    const value = sold ? null : estimatedPnl(position.pnl, state.usChange);

    return `
      <article class="public-position-card ${sold ? "is-sold" : cardClass(value)}" data-public-id="${position.id}">
        <div class="public-position-head">
          <div>
            <span class="public-ticker">${tickerText}</span>
            <h3>${position.name}</h3>
          </div>
          <span class="public-status">${position.status}</span>
        </div>
        <strong class="public-position-pnl">
          ${sold ? "已賣出" : formatUsd(value)}
        </strong>
        <small>
          ${sold ? "不列入目前估算" : `公開基準 ${formatUsd(position.pnl)} · 依美股市場變動估算`}
        </small>
      </article>
    `;
  };

  function removeMessageBoard() {
    document.querySelector(".message-board-section")?.remove();
    document.querySelector(".message-ticker-wrap")?.remove();
    document.getElementById("messageForm")?.remove();
  }

  function updateAuthorNotice() {
    const notice = document.getElementById("authorNotice");
    if (!notice) return;

    const paragraphs = notice.querySelectorAll(".notice-box > p");
    if (paragraphs[0]) {
      paragraphs[0].textContent = "hi 我是吉米狗，9/5更新如下";
    }
    if (paragraphs[1]) {
      paragraphs[1].innerHTML = [
        "1. 台股 / 美股損益改成隨市場變動的動態估算",
        "2. 新增總收益，統一換算成新台幣",
        "3. 保留公開損益基準，不假設未公開成本與股數"
      ].join("<br>");
    }
  }

  function hideLegacyFinance() {
    document.querySelector(".summary-grid")?.classList.add("legacy-finance-hidden");
    document.querySelector(".total-chart-section")?.classList.add("legacy-finance-hidden");
    document.querySelector(".ticker-wrap")?.classList.add("legacy-finance-hidden");
    document.querySelector(".rank-grid")?.classList.add("legacy-finance-hidden");
    document.querySelectorAll(".market-section").forEach(section => {
      section.classList.add("legacy-finance-hidden");
    });

    const refreshBtn = document.getElementById("refreshBtn");
    const autoRefreshBtn = document.getElementById("autoRefreshBtn");
    if (refreshBtn) refreshBtn.hidden = true;
    if (autoRefreshBtn) autoRefreshBtn.hidden = true;
  }

  function installStyle() {
    if (document.getElementById("publicPortfolioStyle")) return;

    const style = document.createElement("style");
    style.id = "publicPortfolioStyle";
    style.textContent = `
      .legacy-finance-hidden { display: none !important; }
      .message-board-section,
      .message-ticker-wrap,
      #messageForm { display: none !important; }

      .public-portfolio-section { margin-bottom: 34px; }

      .public-section-head,
      .public-detail-title,
      .public-market-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 24px;
        margin-bottom: 18px;
      }

      .public-section-head > p,
      .public-detail-title > p,
      .public-market-head > p {
        margin: 0;
        color: var(--muted, rgba(255,255,255,.62));
        text-align: right;
      }

      .public-summary-grid {
        display: grid;
        grid-template-columns: 1.35fr 1fr 1fr;
        gap: 16px;
        margin-bottom: 18px;
      }

      .public-summary-card,
      .public-market-card,
      .public-position-card,
      .public-disclosure-note {
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(15, 11, 31, .78);
        box-shadow: 0 18px 45px rgba(0,0,0,.22);
      }

      .public-summary-card {
        padding: 24px;
        border-radius: 20px;
      }

      .public-summary-card.total-return {
        border-width: 2px;
      }

      .public-summary-card span,
      .public-summary-card small,
      .public-market-card small,
      .public-position-card small {
        display: block;
        color: var(--muted, rgba(255,255,255,.62));
      }

      .public-summary-card strong {
        display: block;
        margin: 8px 0 6px;
        font-size: clamp(28px, 3.6vw, 50px);
        line-height: 1;
      }

      .public-summary-card.total-return strong {
        font-size: clamp(34px, 4.8vw, 62px);
      }

      .is-loss strong,
      .public-position-card.is-loss .public-position-pnl,
      .public-market-change.is-down {
        color: var(--red, #ff385c);
      }

      .is-profit strong,
      .public-position-card.is-profit .public-position-pnl,
      .public-market-change.is-up {
        color: var(--green, #38f29a);
      }

      .public-market-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 26px;
      }

      .public-market-card {
        padding: 18px;
        border-radius: 18px;
      }

      .public-market-card span {
        color: var(--muted, rgba(255,255,255,.62));
        font-size: 13px;
      }

      .public-market-card strong {
        display: block;
        margin: 8px 0 4px;
        font-size: 25px;
      }

      .public-market-change {
        font-weight: 900;
      }

      .public-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .public-updated-at {
        color: var(--muted, rgba(255,255,255,.62));
        font-size: 13px;
      }

      .public-detail-block {
        padding: 22px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 24px;
        background: rgba(8, 6, 20, .48);
      }

      .public-position-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .public-position-card {
        min-height: 170px;
        padding: 18px;
        border-radius: 18px;
      }

      .public-position-card.is-sold { opacity: .72; }

      .public-position-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }

      .public-position-head h3 {
        margin: 5px 0 0;
        font-size: 22px;
      }

      .public-ticker {
        color: var(--muted, rgba(255,255,255,.58));
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .08em;
      }

      .public-status {
        white-space: nowrap;
        padding: 5px 9px;
        border-radius: 999px;
        background: rgba(255,255,255,.08);
        font-size: 12px;
      }

      .public-position-pnl {
        display: block;
        margin: 26px 0 6px;
        font-size: 30px;
        line-height: 1;
      }

      .public-position-card.is-sold .public-position-pnl {
        color: rgba(255,255,255,.72);
      }

      .public-disclosure-note {
        margin-top: 16px;
        padding: 16px 18px;
        border-radius: 16px;
        color: rgba(255,255,255,.72);
        line-height: 1.8;
      }

      .public-disclosure-note strong { color: #fff; }

      @media (max-width: 980px) {
        .public-summary-grid,
        .public-market-grid { grid-template-columns: 1fr; }
        .public-position-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 640px) {
        .public-position-grid { grid-template-columns: 1fr; }
        .public-section-head,
        .public-detail-title,
        .public-market-head {
          align-items: flex-start;
          flex-direction: column;
        }
        .public-section-head > p,
        .public-detail-title > p,
        .public-market-head > p { text-align: left; }
      }
    `;

    document.head.appendChild(style);
  }

  function renderPublicPortfolio() {
    const section = document.getElementById("publicPortfolioSection");
    if (!section) return;

    const result = calculate();
    const updatedText = state.updatedAt
      ? state.updatedAt.toLocaleString("zh-TW", { hour12: false })
      : "尚未取得最新行情";

    section.innerHTML = `
      <div class="public-section-head">
        <div>
          <p class="eyebrow">MARKET-ADJUSTED PNL ESTIMATE</p>
          <h2>羅傑動態損益估算</h2>
        </div>
        <p>公開損益基準：${disclosed.baselineDate}</p>
      </div>

      <div class="public-summary-grid">
        <article class="public-summary-card total-return ${cardClass(result.totalTwd)}">
          <span>總收益（台幣）</span>
          <strong>${formatTwd(result.totalTwd)}</strong>
          <small>台股估算損益 + 美股估算損益 × USD/TWD</small>
        </article>

        <article class="public-summary-card ${cardClass(result.twEstimated)}">
          <span>台股估算總損益</span>
          <strong>${formatTwd(result.twEstimated)}</strong>
          <small>公開基準 ${formatTwd(disclosed.taiwanTotal)}</small>
        </article>

        <article class="public-summary-card ${cardClass(result.usEstimated)}">
          <span>美股估算總損益</span>
          <strong>${formatUsd(result.usEstimated)}</strong>
          <small>公開基準 ${formatUsd(disclosed.usTotal)}</small>
        </article>
      </div>

      <div class="public-market-head">
        <div>
          <p class="eyebrow">MARKET IMPACT</p>
          <h2>目前市場影響</h2>
        </div>
        <p>市場上漲會改善估算損益，下跌會擴大估算虧損。</p>
      </div>

      <div class="public-market-grid">
        <article class="public-market-card">
          <span>${disclosed.marketBaseline.twName}</span>
          <strong>${number(state.twIndex).toLocaleString("zh-TW", { maximumFractionDigits: 2 })}</strong>
          <div class="public-market-change ${state.twChange >= 0 ? "is-up" : "is-down"}">
            相對基準 ${formatPct(state.twChange)}
          </div>
          <small>基準 ${disclosed.marketBaseline.twIndex.toLocaleString("zh-TW")}</small>
        </article>

        <article class="public-market-card">
          <span>${disclosed.marketBaseline.usName}</span>
          <strong>${number(state.usIndex).toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
          <div class="public-market-change ${state.usChange >= 0 ? "is-up" : "is-down"}">
            相對基準 ${formatPct(state.usChange)}
          </div>
          <small>基準 ${disclosed.marketBaseline.usIndex.toLocaleString("en-US")}</small>
        </article>

        <article class="public-market-card">
          <span>USD / TWD</span>
          <strong>${number(state.usdTwd).toFixed(3)}</strong>
          <div class="public-market-change">美股換算台幣匯率</div>
          <small>來源：${state.source}</small>
        </article>
      </div>

      <div class="public-toolbar">
        <button id="publicRefreshBtn" class="btn primary" type="button">
          ${state.loading ? "更新中…" : "更新行情"}
        </button>
        <span class="public-updated-at">最後更新：${updatedText} · 每 60 秒自動更新</span>
      </div>

      <div class="public-detail-block">
        <div class="public-detail-title">
          <div>
            <p class="eyebrow">DISCLOSED POSITIONS</p>
            <h2>公開提及的個股</h2>
          </div>
          <p>個股卡片同樣依美股市場幅度做估算，不代表真實持倉損益。</p>
        </div>

        <div class="public-position-grid">
          ${disclosed.positions.map(positionHtml).join("")}
        </div>

        <div class="public-disclosure-note">
          <strong>估算方式：</strong>
          以 2026/09/04 公開的台股 -NT$320,000、美股 -US$5,800 為基準。
          台股使用台灣加權指數、美股使用 NASDAQ Composite 相對基準點的漲跌比例調整；
          美股再依即時 USD/TWD 換算成新台幣，最後與台股相加得到「總收益（台幣）」。
          因未公開成本與股數，此數字是市場連動估算，不是券商帳戶的精準未實現損益。
        </div>
      </div>
    `;

    document.getElementById("publicRefreshBtn")?.addEventListener("click", refreshMarketEstimate);
  }

  function installPublicPortfolioView() {
    const main = document.querySelector("main");
    if (!main || !disclosed) return;

    document.title = "羅傑動態損益戰情室｜吉米狗製作";

    removeMessageBoard();
    hideLegacyFinance();
    installStyle();

    const liveRow = document.querySelector(".live-row span:last-child");
    if (liveRow) liveRow.textContent = "MARKET-ADJUSTED PNL";

    const title = document.querySelector(".hero h1");
    if (title) title.textContent = "羅傑動態損益戰情室";

    const subtitle = document.querySelector(".subtitle");
    if (subtitle) {
      subtitle.textContent = "以公開損益為基準，跟著台股、美股與美元匯率動態估算";
    }

    const infoRows = document.querySelectorAll(".roger-info-list > div");
    if (infoRows[2]) {
      infoRows[2].innerHTML = "<span>綽號</span><strong>2486、高金生、V老大的狗、說教男</strong>";
    }

    let section = document.getElementById("publicPortfolioSection");
    if (!section) {
      section = document.createElement("section");
      section.id = "publicPortfolioSection";
      section.className = "public-portfolio-section";
      main.insertBefore(section, main.firstChild);
    }

    renderPublicPortfolio();
  }

  async function fetchFromWorker(baseUrl, symbols) {
    const base = String(baseUrl || "").replace(/\/$/, "");
    if (!base) throw new Error("行情 Worker URL 未設定");

    const url = `${base}/?symbols=${encodeURIComponent(symbols.join(","))}&t=${Date.now()}`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Worker HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!json || !json.data) {
      throw new Error(json?.message || "Worker 未回傳有效行情");
    }

    return json.data;
  }

  async function getMarketData() {
    const symbols = [
      disclosed.marketBaseline.twSymbol,
      disclosed.marketBaseline.usSymbol,
      "USDTWD=X"
    ];

    let lastError = null;

    for (const worker of [C.workerUrl, C.workerUrl2]) {
      try {
        return await fetchFromWorker(worker, symbols);
      } catch (error) {
        lastError = error;
        console.warn("行情來源失敗，嘗試下一個 Worker", error);
      }
    }

    throw lastError || new Error("無法取得行情資料");
  }

  async function refreshMarketEstimate() {
    if (state.loading) return;
    state.loading = true;
    renderPublicPortfolio();

    try {
      const data = await getMarketData();

      const twQuote = data[disclosed.marketBaseline.twSymbol];
      const usQuote = data[disclosed.marketBaseline.usSymbol];
      const fxQuote = data["USDTWD=X"];

      if (twQuote?.success && Number.isFinite(Number(twQuote.price))) {
        state.twIndex = Number(twQuote.price);
        state.twChange = state.twIndex / disclosed.marketBaseline.twIndex - 1;
      }

      if (usQuote?.success && Number.isFinite(Number(usQuote.price))) {
        state.usIndex = Number(usQuote.price);
        state.usChange = state.usIndex / disclosed.marketBaseline.usIndex - 1;
      }

      if (fxQuote?.success && Number.isFinite(Number(fxQuote.price))) {
        state.usdTwd = Number(fxQuote.price);
      }

      state.updatedAt = new Date();
      state.source = "Yahoo Finance / Cloudflare Worker";
    } catch (error) {
      console.error("動態損益更新失敗", error);
      state.source = "基準 / 上次成功資料";
    } finally {
      state.loading = false;
      renderPublicPortfolio();
    }
  }

  installPublicPortfolioView();

  window.addEventListener("DOMContentLoaded", () => {
    removeMessageBoard();
    hideLegacyFinance();
    updateAuthorNotice();
    installPublicPortfolioView();
  });

  nativeSetTimeout(refreshMarketEstimate, 700);
  window.setInterval(refreshMarketEstimate, REFRESH_MS);
})();
