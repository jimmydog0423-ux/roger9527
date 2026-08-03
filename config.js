window.APP_CONFIG = {
  refreshSeconds: 60,
  fallbackUsdTwd: 32.38,
  socialLinks: [
    { name: "Twitch", url: "https://www.twitch.tv/", icon: "TW" },
    { name: "Facebook", url: "https://www.facebook.com/", icon: "FB" },
    { name: "YouTube", url: "https://www.youtube.com/", icon: "YT" }
  ],
  // apiSymbol 可依 Twelve Data 實際帳號支援範圍調整。
  holdings: [
    { id:"yageo", name:"國巨", ticker:"2327", market:"TW", apiSymbol:"2327:XTAI", currency:"TWD", cost:973, qty:400, fallbackPrice:502.00 },
    { id:"mu", name:"美光", ticker:"MU", market:"US", apiSymbol:"MU", currency:"USD", cost:955, qty:10, fallbackPrice:874.66 },
    { id:"nbis", name:"Nebius", ticker:"NBIS", market:"US", apiSymbol:"NBIS", currency:"USD", cost:244, qty:70, fallbackPrice:188.43 },
    { id:"skhy", name:"海力士", ticker:"SKHY", market:"MANUAL", apiSymbol:null, currency:"USD", cost:172, qty:40, fallbackPrice:149.00, note:"此代號可能無公開即時報價，暫用手動價格" },
    { id:"dram", name:"DRAM ETF", ticker:"DRAM", market:"MANUAL", apiSymbol:null, currency:"USD", cost:64, qty:300, fallbackPrice:52.34, note:"請確認實際交易代號後填入 apiSymbol" },
    { id:"spcx", name:"SpaceX", ticker:"SPCX", market:"MANUAL", apiSymbol:null, currency:"USD", cost:174, qty:90, fallbackPrice:112.20, note:"SpaceX 非公開上市股票，暫用手動估值" },
    { id:"mrvl", name:"邁威爾", ticker:"MRVL", market:"US", apiSymbol:"MRVL", currency:"USD", cost:307, qty:50, fallbackPrice:183.30 },
    { id:"nvda", name:"輝達", ticker:"NVDA", market:"US", apiSymbol:"NVDA", currency:"USD", cost:205, qty:60, fallbackPrice:195.04 },
    { id:"umc", name:"聯電", ticker:"2303", market:"TW", apiSymbol:"2303:XTAI", currency:"TWD", cost:167, qty:4000, fallbackPrice:121.00 },
    { id:"0050", name:"元大台灣50", ticker:"0050", market:"TW", apiSymbol:"0050:XTAI", currency:"TWD", cost:105, qty:12000, fallbackPrice:102.85 }
  ],
  mp3Files: [
    "assets/sounds/lose-1.mp3",
    "assets/sounds/lose-2.mp3",
    "assets/sounds/win-1.mp3",
    "assets/sounds/alert-1.mp3"
  ]
};
