window.APP_CONFIG = {
  refreshSeconds: 86400,
  workerUrl: "https://lucky-rice-01c0.jimmydog0423.workers.dev",
  workerUrl2: "https://crimson-union-c21f.jimmydog0702.workers.dev",
  fallbackUsdTwd: 32.38,

  socialLinks: [
    { name: "Twitch", url: "https://www.twitch.tv/roger9527", icon: "TW" },
    { name: "Facebook", url: "https://www.facebook.com/Roger95279527", icon: "FB" },
    { name: "YouTube", url: "https://www.youtube.com/@Roger9527-sb", icon: "YT" }
  ],

  /*
   * 羅傑沒有公開完整成本、股數、買賣價格與即時持倉細節。
   * 因此不再用推算資料製作即時持倉，只整理他明確公開講過的損益。
   */
  holdings: [],

  disclosedPortfolio: {
    taiwanTotal: -320000,
    usTotal: -5800,
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

/*
 * 公開資訊版介面修正
 * config.js 會先於 app.js 載入，因此在舊版行情程式啟動前先調整畫面。
 */
(() => {
  "use strict";

  const C = window.APP_CONFIG;
  const disclosed = C.disclosedPortfolio;

  // 不再啟用自動行情刷新；公開數字不是即時持倉資料。
  try {
    localStorage.setItem("autoRefresh", "false");
  } catch (error) {
    console.warn("無法寫入自動更新設定", error);
  }

  // 舊 app.js 啟動時會排一個 400ms 的首次行情更新；公開資訊版不需要它。
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

  const usd = value => {
    const amount = Math.abs(Number(value) || 0).toLocaleString("en-US");
    return `${value >= 0 ? "+" : "-"}US$${amount}`;
  };

  const twd = value => {
    const amount = Math.abs(Number(value) || 0).toLocaleString("zh-TW");
    return `${value >= 0 ? "+" : "-"}NT$${amount}`;
  };

  const positionHtml = position => {
    const isSold = position.status === "已賣出";
    const isLoss = Number(position.pnl) < 0;
    const valueText = isSold ? "已賣出" : usd(position.pnl);
    const stateClass = isSold ? "is-sold" : (isLoss ? "is-loss" : "is-profit");
    const tickerText = position.ticker || "未公開代號";

    return `
      <article class="public-position-card ${stateClass}" data-public-id="${position.id}">
        <div class="public-position-head">
          <div>
            <span class="public-ticker">${tickerText}</span>
            <h3>${position.name}</h3>
          </div>
          <span class="public-status">${position.status}</span>
        </div>
        <strong class="public-position-pnl">${valueText}</strong>
        <small>${isSold ? "已退出目前持倉統計" : "羅傑公開提及損益"}</small>
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
        "1. 投資區改為羅傑公開損益摘要",
        "2. 移除留言板",
        "3. 不再推算未公開成本、股數與持倉細節"
      ].join("<br>");
    }
  }

  function installPublicPortfolioView() {
    const main = document.querySelector("main");
    if (!main || !disclosed) return;

    document.title = "羅傑公開損益戰情室｜吉米狗製作";

    // 留言牆直接從畫面 DOM 移除，舊 app.js 因找不到表單也不會再初始化留言功能。
    removeMessageBoard();

    // 舊版即時行情區保留在 DOM 當相容層，但不再顯示。
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

    const liveRow = document.querySelector(".live-row span:last-child");
    if (liveRow) liveRow.textContent = "PUBLIC PNL DISCLOSURE";

    const title = document.querySelector(".hero h1");
    if (title) title.textContent = "羅傑公開損益戰情室";

    const subtitle = document.querySelector(".subtitle");
    if (subtitle) {
      subtitle.textContent = "只整理羅傑公開講過的損益，不推算成本、股數、買賣價格與未公開持倉";
    }

    // 修正原本「綽號」欄位的錯誤 HTML 標籤。
    const infoRows = document.querySelectorAll(".roger-info-list > div");
    if (infoRows[2]) {
      infoRows[2].innerHTML = "<span>綽號</span><strong>2486、高金生、V老大的狗、說教男</strong>";
    }

    if (document.getElementById("publicPortfolioSection")) return;

    const section = document.createElement("section");
    section.id = "publicPortfolioSection";
    section.className = "public-portfolio-section";
    section.innerHTML = `
      <div class="public-section-head">
        <div>
          <p class="eyebrow">PUBLICLY DISCLOSED PNL</p>
          <h2>羅傑公開損益</h2>
        </div>
        <p>沒有公開的資料就不自行推算。</p>
      </div>

      <div class="public-summary-grid">
        <article class="public-summary-card is-loss">
          <span>台股總損益</span>
          <strong>${twd(disclosed.taiwanTotal)}</strong>
          <small>只公開整體，個股細節未公開</small>
        </article>

        <article class="public-summary-card is-loss">
          <span>美股總損益</span>
          <strong>${usd(disclosed.usTotal)}</strong>
          <small>依羅傑公開說法整理</small>
        </article>
      </div>

      <div class="public-detail-block">
        <div class="public-detail-title">
          <div>
            <p class="eyebrow">DISCLOSED US POSITIONS</p>
            <h2>有公開講過的美股個股</h2>
          </div>
          <p>只顯示公開損益，不補成本、股數與買賣價格。</p>
        </div>

        <div class="public-position-grid">
          ${disclosed.positions.map(positionHtml).join("")}
        </div>

        <div class="public-disclosure-note">
          個股損益屬於羅傑零散公開的數字，可能與「美股總損益」不是同一時間點或同一統計口徑。
          因此不拿個股加總去反推其他持倉，也不自行補出差額。
        </div>
      </div>
    `;

    main.insertBefore(section, main.firstChild);

    const style = document.createElement("style");
    style.id = "publicPortfolioStyle";
    style.textContent = `
      .legacy-finance-hidden { display: none !important; }
      .message-board-section,
      .message-ticker-wrap,
      #messageForm { display: none !important; }
      .public-portfolio-section { margin-bottom: 34px; }
      .public-section-head,
      .public-detail-title {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 24px;
        margin-bottom: 18px;
      }
      .public-section-head > p,
      .public-detail-title > p {
        margin: 0;
        color: var(--muted, rgba(255,255,255,.62));
        text-align: right;
      }
      .public-summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 26px;
      }
      .public-summary-card,
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
      .public-summary-card span,
      .public-summary-card small,
      .public-position-card small {
        display: block;
        color: var(--muted, rgba(255,255,255,.62));
      }
      .public-summary-card strong {
        display: block;
        margin: 8px 0 4px;
        font-size: clamp(30px, 4vw, 52px);
        line-height: 1;
      }
      .public-summary-card.is-loss strong,
      .public-position-card.is-loss .public-position-pnl {
        color: var(--red, #ff385c);
      }
      .public-position-card.is-profit .public-position-pnl {
        color: var(--green, #38f29a);
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
      .public-position-card.is-sold {
        opacity: .72;
      }
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
      @media (max-width: 900px) {
        .public-position-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .public-summary-grid,
        .public-position-grid { grid-template-columns: 1fr; }
        .public-section-head,
        .public-detail-title { align-items: flex-start; flex-direction: column; }
        .public-section-head > p,
        .public-detail-title > p { text-align: left; }
      }
    `;
    document.head.appendChild(style);
  }

  installPublicPortfolioView();

  // 作者公告寫在 script 標籤之後，所以 DOM 完成後再更新一次。
  window.addEventListener("DOMContentLoaded", () => {
    removeMessageBoard();
    updateAuthorNotice();
  });
})();
