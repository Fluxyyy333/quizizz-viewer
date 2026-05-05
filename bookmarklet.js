(function () {
  "use strict";

  const CONFIG = {
    updateInterval: 1500,
  };

  let questions = [];
  let panel = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let startPos = { x: 0, y: 0 };

  function decodeHTML(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }

  function stripTags(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  // ==================== DATA EXTRACTION ====================

  function hookFetch() {
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      return originalFetch.apply(this, args).then((response) => {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
        if (
          url.includes("/quiz/") ||
          url.includes("/game/") ||
          url.includes("/questions")
        ) {
          response
            .clone()
            .json()
            .then((data) => extractFromAPIResponse(data))
            .catch(() => {});
        }
        return response;
      });
    };
  }

  function hookXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._qzUrl = url;
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener("load", function () {
        if (
          this._qzUrl &&
          (this._qzUrl.includes("/quiz/") ||
            this._qzUrl.includes("/game/") ||
            this._qzUrl.includes("/questions"))
        ) {
          try {
            extractFromAPIResponse(JSON.parse(this.responseText));
          } catch (e) {}
        }
      });
      return originalSend.apply(this, args);
    };
  }

  function scanPageState() {
    const possiblePaths = [
      () => window.__NEXT_DATA__,
      () => window.__remixContext,
      () => window.quizizzData,
    ];
    for (const getPath of possiblePaths) {
      try {
        const data = getPath();
        if (data) extractFromAPIResponse(data);
      } catch (e) {}
    }
    scanReactFiber();
  }

  function scanReactFiber() {
    const rootEl =
      document.getElementById("root") ||
      document.getElementById("__next") ||
      document.querySelector("[data-reactroot]");
    if (!rootEl) return;

    const fiberKey = Object.keys(rootEl).find(
      (k) =>
        k.startsWith("__reactFiber") ||
        k.startsWith("__reactInternalInstance")
    );
    if (!fiberKey) return;

    const seen = new WeakSet();
    function walk(fiber, depth) {
      if (!fiber || depth > 30 || seen.has(fiber)) return;
      seen.add(fiber);
      try {
        const state = fiber.memoizedState;
        const props = fiber.memoizedProps;
        const stateData = fiber.stateNode;
        for (const obj of [state, props, stateData]) {
          if (obj && typeof obj === "object") extractFromAnyObject(obj);
        }
      } catch (e) {}
      walk(fiber.child, depth + 1);
      walk(fiber.sibling, depth + 1);
    }
    try {
      walk(rootEl[fiberKey], 0);
    } catch (e) {}
  }

  function extractFromAnyObject(obj, depth = 0) {
    if (!obj || depth > 8 || typeof obj !== "object") return;
    try {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (isQuestionObject(item)) addQuestion(item);
          else if (typeof item === "object") extractFromAnyObject(item, depth + 1);
        }
        return;
      }
      if (isQuestionObject(obj)) { addQuestion(obj); return; }
      for (const key of Object.keys(obj)) {
        if (["questions", "data", "info", "quiz", "game", "items"].includes(key))
          extractFromAnyObject(obj[key], depth + 1);
      }
    } catch (e) {}
  }

  function extractFromAPIResponse(data) {
    if (!data || typeof data !== "object") return;
    extractFromAnyObject(data);
    if (questions.length > 0) renderQuestions();
  }

  // ==================== QUESTION PARSING ====================

  function isQuestionObject(obj) {
    if (!obj || typeof obj !== "object") return false;
    return (
      (obj.structure && obj.structure.query) ||
      (obj.structure && obj.structure.options) ||
      (obj.type && obj.structure && obj.structure.answer)
    );
  }

  function addQuestion(qObj) {
    const id =
      qObj._id || qObj.id || JSON.stringify(qObj.structure?.query).slice(0, 50);
    if (questions.find((q) => q.id === id)) return;
    const parsed = parseQuestion(qObj);
    if (parsed) {
      questions.push({ id, ...parsed });
      renderQuestions();
    }
  }

  function parseQuestion(q) {
    try {
      const struct = q.structure;
      if (!struct) return null;

      const questionText = extractText(struct.query);
      const questionImage = extractImage(struct.query);
      const type = q.type || "UNKNOWN";

      let options = [];
      let correctAnswers = [];

      if (struct.options && Array.isArray(struct.options)) {
        options = struct.options.map((opt, idx) => ({
          index: idx,
          text: extractText(opt),
          image: extractImage(opt),
        }));
      }

      const answer = struct.answer;
      if (typeof answer === "number") {
        correctAnswers = [answer];
      } else if (Array.isArray(answer)) {
        if (answer.every((a) => typeof a === "number")) correctAnswers = answer;
        else if (answer.every((a) => typeof a === "object" && a.text))
          correctAnswers = answer.map((a) => extractText(a));
        else correctAnswers = answer;
      } else if (typeof answer === "string") {
        correctAnswers = [answer];
      } else if (typeof answer === "object" && answer !== null) {
        correctAnswers = Object.values(answer);
      }

      return { type, question: questionText, questionImage, options, correctAnswers };
    } catch (e) {
      return null;
    }
  }

  function extractText(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return stripTags(decodeHTML(obj));
    if (obj.text) return stripTags(decodeHTML(obj.text));
    if (obj.html) return stripTags(decodeHTML(obj.html));
    if (obj.media && obj.media.length > 0) {
      const textMedia = obj.media.find((m) => m.type === "text");
      if (textMedia) return stripTags(decodeHTML(textMedia.text || textMedia.data));
    }
    return "";
  }

  function extractImage(obj) {
    if (!obj) return null;
    if (obj.media && Array.isArray(obj.media)) {
      const img = obj.media.find((m) => m.type === "image");
      if (img) return img.url || img.data;
    }
    return null;
  }

  // ==================== UI ====================

  function createPanel() {
    if (panel) panel.remove();

    panel = document.createElement("div");
    panel.id = "qz-viewer-panel";
    panel.innerHTML = `
      <div id="qz-header">
        <span>\u{1F4CB} QZ Viewer</span>
        <div>
          <button id="qz-refresh" title="Refresh">\u{1F504}</button>
          <button id="qz-minimize" title="Minimize">—</button>
          <button id="qz-close" title="Close">✕</button>
        </div>
      </div>
      <div id="qz-body">
        <div id="qz-status">Menunggu data soal...</div>
        <div id="qz-list"></div>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #qz-viewer-panel {
        position: fixed;
        bottom: 10px;
        left: 5px;
        right: 5px;
        width: auto;
        max-width: 400px;
        max-height: 55vh;
        background: #1a1a2e;
        border: 1px solid #16213e;
        border-radius: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        color: #e0e0e0;
        overflow: hidden;
        transition: max-height 0.3s ease;
        touch-action: none;
      }
      @media (min-width: 600px) {
        #qz-viewer-panel {
          bottom: auto;
          top: 20px;
          right: 20px;
          left: auto;
          width: 370px;
          max-height: 500px;
        }
      }
      #qz-viewer-panel.minimized {
        max-height: 44px;
      }
      #qz-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 11px 14px;
        background: #16213e;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        font-weight: 600;
        font-size: 14px;
      }
      #qz-header button {
        background: none;
        border: none;
        color: #e0e0e0;
        cursor: pointer;
        font-size: 16px;
        padding: 4px 8px;
        border-radius: 6px;
        margin-left: 2px;
        -webkit-tap-highlight-color: transparent;
      }
      #qz-header button:active {
        background: rgba(255,255,255,0.15);
      }
      #qz-body {
        padding: 10px 14px;
        max-height: calc(55vh - 50px);
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
      @media (min-width: 600px) {
        #qz-body { max-height: 440px; }
      }
      #qz-status {
        text-align: center;
        color: #888;
        padding: 20px 0;
      }
      .qz-item {
        background: #0f3460;
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 8px;
        border-left: 3px solid #e94560;
      }
      .qz-item-q {
        font-weight: 600;
        margin-bottom: 6px;
        color: #fff;
        line-height: 1.4;
        word-break: break-word;
      }
      .qz-item-q img {
        max-width: 100%;
        border-radius: 6px;
        margin-top: 4px;
      }
      .qz-item-a {
        color: #53cf6d;
        font-weight: 500;
        padding: 4px 8px;
        background: rgba(83, 207, 109, 0.1);
        border-radius: 4px;
        display: inline-block;
        margin-top: 2px;
        word-break: break-word;
      }
      .qz-item-type {
        font-size: 10px;
        color: #888;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .qz-item-opts { margin-top: 4px; }
      .qz-opt {
        padding: 3px 0;
        color: #aaa;
        word-break: break-word;
      }
      .qz-opt.correct {
        color: #53cf6d;
        font-weight: 600;
      }
      .qz-opt.correct::before {
        content: "\\2713  ";
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(panel);

    const header = panel.querySelector("#qz-header");

    // Mouse drag
    header.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      panel.style.left = e.clientX - dragOffset.x + "px";
      panel.style.top = e.clientY - dragOffset.y + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    document.addEventListener("mouseup", () => (isDragging = false));

    // Touch drag
    header.addEventListener(
      "touchstart",
      (e) => {
        if (e.target.tagName === "BUTTON") return;
        isDragging = true;
        const touch = e.touches[0];
        const rect = panel.getBoundingClientRect();
        dragOffset.x = touch.clientX - rect.left;
        dragOffset.y = touch.clientY - rect.top;
        startPos.x = touch.clientX;
        startPos.y = touch.clientY;
      },
      { passive: true }
    );
    document.addEventListener(
      "touchmove",
      (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - startPos.x);
        const dy = Math.abs(touch.clientY - startPos.y);
        if (dx > 5 || dy > 5) {
          panel.style.left = touch.clientX - dragOffset.x + "px";
          panel.style.top = touch.clientY - dragOffset.y + "px";
          panel.style.right = "auto";
          panel.style.bottom = "auto";
          e.preventDefault();
        }
      },
      { passive: false }
    );
    document.addEventListener("touchend", () => (isDragging = false));

    // Buttons
    panel.querySelector("#qz-minimize").addEventListener("click", () => {
      panel.classList.toggle("minimized");
    });
    panel.querySelector("#qz-close").addEventListener("click", () => {
      panel.remove();
      panel = null;
    });
    panel.querySelector("#qz-refresh").addEventListener("click", () => {
      questions = [];
      scanPageState();
      renderQuestions();
    });
  }

  function renderQuestions() {
    if (!panel) createPanel();

    const list = panel.querySelector("#qz-list");
    const status = panel.querySelector("#qz-status");

    if (questions.length === 0) {
      status.style.display = "block";
      status.textContent = "Menunggu data soal...";
      list.innerHTML = "";
      return;
    }

    status.style.display = "none";
    list.innerHTML = questions
      .map((q, idx) => {
        let answerHTML = "";

        if (q.options.length > 0) {
          const optsHTML = q.options
            .map((opt, oi) => {
              const isCorrect = q.correctAnswers.includes(oi);
              const text = opt.text || "Option " + (oi + 1);
              return '<div class="qz-opt ' + (isCorrect ? "correct" : "") + '">' + text + "</div>";
            })
            .join("");
          answerHTML = '<div class="qz-item-opts">' + optsHTML + "</div>";
        } else if (q.correctAnswers.length > 0) {
          answerHTML = q.correctAnswers
            .map((a) => '<div class="qz-item-a">' + a + "</div>")
            .join("");
        }

        const imgHTML = q.questionImage
          ? '<img src="' + q.questionImage + '" alt="question image">'
          : "";

        return (
          '<div class="qz-item">' +
          '<div class="qz-item-type">#' + (idx + 1) + " · " + q.type + "</div>" +
          '<div class="qz-item-q">' + q.question + imgHTML + "</div>" +
          answerHTML +
          "</div>"
        );
      })
      .join("");
  }

  // ==================== INIT ====================

  function init() {
    const host = window.location.hostname;
    if (!host.includes("quizizz.com") && !host.includes("wayground.com")) {
      alert("Buka Wayground/Quizizz dulu sebelum menjalankan bookmarklet ini!");
      return;
    }

    createPanel();
    hookFetch();
    hookXHR();
    setTimeout(() => scanPageState(), 1000);
    setInterval(() => scanPageState(), CONFIG.updateInterval);
  }

  init();
})();
