/*
 * 광고 설정 (Google AdSense)
 * ─────────────────────────────────────────────
 * 1) AdSense 승인 후 받은 게시자 ID를 client 에 넣으세요. 예: "ca-pub-1234567890123456"
 * 2) AdSense에서 만든 광고 단위의 slot ID를 각 위치에 넣으세요.
 * 3) public/ads.txt 의 pub-XXXX 부분도 같은 게시자 ID로 바꾸세요.
 *
 * client 가 비어 있으면 광고 스크립트를 불러오지 않습니다.
 * 그때는 showPlaceholders 가 true 일 때만 "광고 영역" 자리 표시가 보입니다.
 */
window.AD_CONFIG = {
  client: "",
  slots: {
    top: "",      // 탭 메뉴 아래
    middle: "",   // 진행 중인 타이머 아래
    bottom: ""    // 요리 팁 사이
  },
  showPlaceholders: false
};

(function () {
  var cfg = window.AD_CONFIG;
  var enabled = !!cfg.client;

  if (enabled) {
    var s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.client);
    document.head.appendChild(s);
  }

  function fill() {
    var boxes = document.querySelectorAll("[data-ad]");
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      var slot = cfg.slots[box.getAttribute("data-ad")];
      if (enabled && slot) {
        var ins = document.createElement("ins");
        ins.className = "adsbygoogle";
        ins.style.display = "block";
        ins.setAttribute("data-ad-client", cfg.client);
        ins.setAttribute("data-ad-slot", slot);
        ins.setAttribute("data-ad-format", "auto");
        ins.setAttribute("data-full-width-responsive", "true");
        box.appendChild(ins);
        box.classList.add("ad-live");
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } else if (cfg.showPlaceholders) {
        box.classList.add("ad-placeholder");
        box.innerHTML = "<span>광고 영역</span>";
      } else {
        box.remove();
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fill);
  } else {
    fill();
  }
})();
