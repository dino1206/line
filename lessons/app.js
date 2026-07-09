(function () {
  const $ = (id) => document.getElementById(id);
  const cityA = $("city-select-a");
  const cityB = $("city-select-b");
  const timeA = $("time-input-a");
  const calcSteps = $("calc-steps");
  const tabs = document.querySelectorAll(".nav-tab");
  const panes = document.querySelectorAll(".tab-pane");

  const pad = (value) => String(value).padStart(2, "0");
  const lonToOffset = (lon) => Number(lon) / 15;

  // --- 城市英文對照表以解決 3D 地球儀中文亂碼問題 ---
  const CITY_EN = {
    "台北": "Taipei",
    "倫敦": "London",
    "東京": "Tokyo",
    "雪梨": "Sydney",
    "紐約": "New York",
    "舊金山": "San Francisco",
    "開羅": "Cairo"
  };

  function getENName(chName) {
    if (CITY_EN[chName]) {
      return CITY_EN[chName];
    }
    if (chName && chName.startsWith("自訂")) {
      return chName.replace("自訂", "Custom");
    }
    return chName || "";
  }

  function nowLocalDatetime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  function selectedLongitude(selectEl, suffix) {
    if (!selectEl) return 0;
    if (selectEl.value !== "custom") return Number(selectEl.value);
    const value = Number($(`lon-val-${suffix}`)?.value || 0);
    const dir = $(`lon-dir-${suffix}`)?.value || "E";
    return dir === "W" ? -Math.abs(value) : Math.abs(value);
  }

  function setCustomRow(selectEl, suffix) {
    const row = $(`custom-longitude-${suffix}-row`);
    if (row) row.style.display = selectEl?.value === "custom" ? "block" : "none";
  }

  function formatDate(date) {
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  }

  function formatTime(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function setClock(prefix, date) {
    const digital = $(`digital-${prefix}`);
    const dateEl = $(`date-${prefix}`);
    const hour = $(`hour-${prefix}`);
    const minute = $(`minute-${prefix}`);
    if (digital) digital.textContent = formatTime(date);
    if (dateEl) dateEl.textContent = formatDate(date);
    if (hour) hour.style.transform = `translateX(-50%) rotate(${(date.getHours() % 12) * 30 + date.getMinutes() * 0.5}deg)`;
    if (minute) minute.style.transform = `translateX(-50%) rotate(${date.getMinutes() * 6}deg)`;
  }

  function lonToPercent(lon) {
    return ((Number(lon) + 180) / 360) * 100;
  }

  function updateAxis(lonA, lonB) {
    const markerA = $("axis-marker-a");
    const markerB = $("axis-marker-b");
    if (markerA) markerA.style.left = `${lonToPercent(lonA)}%`;
    if (markerB) markerB.style.left = `${lonToPercent(lonB)}%`;
  }

  function updateSky(lonA, lonB) {
    const sky = $("sky-bg");
    const sun = $("sun-body");
    const moon = $("moon-body");
    const aLocalHour = (new Date(timeA.value || nowLocalDatetime()).getHours() + lonToOffset(lonA)) % 24;
    if (sky) {
      sky.style.background = aLocalHour >= 6 && aLocalHour < 18
        ? "linear-gradient(to bottom, #83c5ff 0%, #f7d774 100%)"
        : "linear-gradient(to bottom, #172554 0%, #020617 100%)";
    }
    if (sun) {
      sun.style.left = `${Math.max(8, Math.min(82, lonToPercent(lonA)))}%`;
      sun.style.top = aLocalHour >= 6 && aLocalHour < 18 ? "18%" : "80%";
    }
    if (moon) {
      moon.style.left = `${Math.max(8, Math.min(82, lonToPercent(lonB)))}%`;
      moon.style.top = aLocalHour >= 6 && aLocalHour < 18 ? "72%" : "18%";
    }
  }

  // 產生 24 條經度線 (每 15 度一條)
  const longitudePaths = [];
  for (let lng = -180; lng < 180; lng += 15) {
    const coords = [];
    for (let lat = -90; lat <= 90; lat += 5) {
      coords.push([lat, lng]);
    }
    let color = "rgba(255, 255, 255, 0.22)";
    let width = 0.6;
    if (lng === 0) {
      color = "#ef4444"; // 本初子午線 (紅色)
      width = 1.8;
    } else if (lng === 180 || lng === -180) {
      color = "#f97316"; // 180度經線 (橘色)
      width = 1.2;
    }
    longitudePaths.push({
      coords: coords,
      color: color,
      width: width
    });
  }

  function updateGlobe(lonA, lonB, nameA, nameB) {
    const globeEl = $("globeViz");
    if (!globeEl) return;
    if (!window.Globe) {
      globeEl.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:white;text-align:center;padding:24px;">3D 地球儀載入中，時差計算可先使用。</div>';
      return;
    }
    if (!window.learningGlobe) {
      window.learningGlobe = Globe()(globeEl)
        .backgroundColor("rgba(0,0,0,0)")
        .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
        .pointAltitude(0.04)
        .pointRadius(0.8)
        .labelLat(d => d.lat)
        .labelLng(d => d.lng)
        .labelText(d => d.text)
        .labelColor(d => d.color)
        .labelSize(3.0)
        .labelDotRadius(0.4)
        .labelResolution(2)
        .pathsData(longitudePaths)
        .pathPoints(d => d.coords)
        .pathPointLat(p => p[0])
        .pathPointLng(p => p[1])
        .pathColor(d => d.color)
        .pathStroke(d => d.width)
        .pathAltitude(0.0025);

      const controls = window.learningGlobe.controls();
      if (controls) {
        // 限制只能東西向（左右）旋轉，不能上下轉
        // 設為稍微俯視赤道 (Math.PI / 2 - 0.15 弧度，約 81 度，以看清經線交會)
        const angle = Math.PI / 2 - 0.15;
        controls.minPolarAngle = angle;
        controls.maxPolarAngle = angle;
      }
    }
    window.learningGlobe.pointsData([
      { lat: 24, lng: lonA, color: "#ff8da1" },
      { lat: -12, lng: lonB, color: "#64b5f6" }
    ]).pointColor("color");

    const nameA_en = getENName(nameA);
    const nameB_en = getENName(nameB);

    window.learningGlobe.labelsData([
      { lat: 24, lng: lonA, text: `Base A: ${nameA_en}`, color: "#ff8da1" },
      { lat: -12, lng: lonB, text: `Target B: ${nameB_en}`, color: "#64b5f6" }
    ]);
  }

  function getCityName(selectEl, suffix) {
    if (!selectEl) return "";
    if (selectEl.value !== "custom") {
      const text = selectEl.options[selectEl.selectedIndex].text;
      return text.split(" (")[0];
    } else {
      const value = Number($(`lon-val-${suffix}`)?.value || 0);
      const dir = $(`lon-dir-${suffix}`)?.value || "E";
      return `自訂 (${value}°${dir})`;
    }
  }

  function calculate() {
    if (!timeA || !cityA || !cityB) return;
    const lonA = selectedLongitude(cityA, "a");
    const lonB = selectedLongitude(cityB, "b");
    const nameA = getCityName(cityA, "a");
    const nameB = getCityName(cityB, "b");
    const base = new Date(timeA.value || nowLocalDatetime());
    const diffHours = (lonB - lonA) / 15;
    const target = new Date(base.getTime() + diffHours * 60 * 60 * 1000);
    setClock("a", base);
    setClock("b", target);
    updateAxis(lonA, lonB);
    updateSky(lonA, lonB);
    updateGlobe(lonA, lonB, nameA, nameB);

    const diffText = `${diffHours >= 0 ? "+" : ""}${diffHours.toFixed(1)}h`;
    if ($("qr-time-a")) $("qr-time-a").textContent = formatTime(base);
    if ($("qr-time-b")) $("qr-time-b").textContent = formatTime(target);
    if ($("qr-diff")) $("qr-diff").textContent = diffText;
    if (calcSteps) {
      const direction = diffHours >= 0 ? "東邊，時間加上去" : "西邊，時間減下來";
      calcSteps.innerHTML = `
        <p>1. A 地經度：${lonA.toFixed(1)}°，B 地經度：${lonB.toFixed(1)}°。</p>
        <p>2. 經度差：${(lonB - lonA).toFixed(1)}°，換算時差為 ${diffText}。</p>
        <p>3. B 地在 A 地的${direction}，所以 B 地時間是 ${formatDate(target)} ${formatTime(target)}。</p>
      `;
    }
  }

  function shiftA(degrees) {
    if (!cityA) return;
    cityA.value = "custom";
    setCustomRow(cityA, "a");
    const current = selectedLongitude(cityA, "a");
    const next = Math.max(-180, Math.min(180, current + degrees));
    if ($("lon-val-a")) $("lon-val-a").value = Math.abs(next);
    if ($("lon-dir-a")) $("lon-dir-a").value = next < 0 ? "W" : "E";
    const toast = $("lon-toast");
    if (toast) {
      toast.textContent = `${degrees > 0 ? "+" : ""}${degrees}°`;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 700);
    }
    calculate();
  }

  // --- 挑戰賽題庫定義 ---
  const QUIZ_QUESTIONS = {
    easy: [
      {
        question: "台北位於東經 120°，倫敦位於經度 0°（本初子午線）。台北與倫敦的時差是多少小時？",
        options: ["6小時", "8小時", "10小時", "12小時"],
        correct: 1,
        desc: "經度每相差 15 度差 1 小時。台北 120°E，倫敦 0°，相差 120 度。120 ÷ 15 = 8 小時。"
      },
      {
        question: "東京位於東經 135°，台北位於東經 120°。當台北時間是早上 9:00 時，東京時間是幾點？",
        options: ["早上 8:00", "早上 10:00", "早上 11:00", "下午 1:00"],
        correct: 1,
        desc: "東京與台北相差 135° - 120° = 15°，時差為 1 小時。東京在台北的東邊，所以時間比較快（早一小時），即早上 10:00。"
      },
      {
        question: "開羅位於東經 30°。當倫敦 (0°) 時間是中午 12:00 時，開羅時間是幾點？",
        options: ["上午 10:00", "下午 1:00", "下午 2:00", "下午 3:00"],
        correct: 2,
        desc: "開羅與倫敦相差 30°，時差為 30 ÷ 15 = 2 小時。開羅在東經，時間較快，12:00 + 2 = 14:00 (下午 2:00)。"
      },
      {
        question: "如果 A 地在東經 120°，B 地在東經 60°。兩地相差幾小時？",
        options: ["2小時", "4小時", "6小時", "8小時"],
        correct: 1,
        desc: "兩地同在東半球，經度差為 120° - 60° = 60°。時差為 60 ÷ 15 = 4 小時。"
      },
      {
        question: "雪梨位於東經 150°，台北位於東經 120°。當雪梨時間是下午 2:00 時，台北時間是幾點？",
        options: ["中午 12:00", "上午 10:00", "下午 3:00", "下午 4:00"],
        correct: 0,
        desc: "雪梨與台北相差 150° - 120° = 30°，時差 2 小時。台北在西邊（相對雪梨而言），時間較慢，下午 2:00 - 2 小時 = 中午 12:00。"
      }
    ],
    medium: [
      {
        question: "倫敦位於 0° 經線，紐約位於西經 75°。當倫敦時間是下午 3:00 時，紐約時間是幾點？",
        options: ["上午 9:00", "上午 10:00", "下午 5:00", "下午 8:00"],
        correct: 1,
        desc: "一東一西（或跨 0 度），經度差為 75°。時差為 75 ÷ 15 = 5 小時。紐約在西經，時間較慢，15:00 - 5 = 10:00 (上午 10:00)。"
      },
      {
        question: "台北位於東經 120°，紐約位於西經 75°。兩地的時差為多少小時？",
        options: ["3小時", "11小時", "13小時", "15小時"],
        correct: 2,
        desc: "一東一西經度差相加：120° + 75° = 195°。時差為 195 ÷ 15 = 13 小時。"
      },
      {
        question: "開羅位於東經 30°，巴西利亞位於西經 45°。當開羅是晚上 8:00，巴西利亞是幾點？",
        options: ["下午 2:00", "下午 3:00", "晚上 11:00", "凌晨 1:00"],
        correct: 1,
        desc: "經度差為 30° + 45° = 75°。時差為 75 ÷ 15 = 5 小時。巴西利亞在西邊，時間較慢，20:00 - 5 = 15:00 (下午 3:00)。"
      },
      {
        question: "舊金山位於西經 120°，倫敦為 0°。當舊金山是早上 6:00 時，倫敦是幾點？",
        options: ["上午 10:00", "下午 2:00", "下午 4:00", "晚上 10:00"],
        correct: 1,
        desc: "經度差 120°，時差 120 ÷ 15 = 8 小時。倫敦在舊金山東邊，時間較快，6:00 + 8 = 14:00 (下午 2:00)。"
      },
      {
        question: "東京位於東經 135°，舊金山位於西經 120°。兩地相差多少小時？",
        options: ["1小時", "15小時", "17小時", "19小時"],
        correct: 2,
        desc: "一東一西經度差相加：135° + 120° = 255°。時差為 255 ÷ 15 = 17 小時。"
      }
    ],
    hard: [
      {
        question: "台北為東經 120°，舊金山為西經 120°。當台北時間是 10 月 2 日凌晨 1:00 時，舊金山是幾點？",
        options: ["10 月 1 日下午 5:00", "10 月 1 日早上 9:00", "10 月 2 日早上 9:00", "10 月 2 日下午 5:00"],
        correct: 1,
        desc: "經度差 120° + 120° = 240°，時差 16 小時。舊金山在西邊時間較慢，10 月 2 日 1:00 減去 16 小時為 10 月 1 日早上 9:00。"
      },
      {
        question: "倫敦 (0°) 當地時間是 12 月 31 日晚上 10:00。此時東京 (135°E) 的日期與時間是？",
        options: ["12 月 31 日下午 1:00", "1 月 1 日凌晨 1:00", "1 月 1 日早上 7:00", "1 月 1 日早上 9:00"],
        correct: 2,
        desc: "東京與倫敦時差為 135 ÷ 15 = 9 小時。東京在東邊較快，12 月 31 日 22:00 + 9 小時 = 跨年 1 月 1 日早上 7:00。"
      },
      {
        question: "紐約 (75°W) 時間是 6 月 1 日下午 8:00，此時台北 (120°E) 的日期與時間是？",
        options: ["6 月 1 日上午 7:00", "6 月 2 日上午 7:00", "6 月 2 日上午 9:00", "5 月 31 日下午 7:00"],
        correct: 2,
        desc: "時差為 13 小時。台北在東邊時間較快，6 月 1 日 20:00 + 13 小時 = 跨日 6 月 2 日上午 9:00。"
      },
      {
        question: "一艘船從西半球跨越 180° 國際日期變更線進入東半球。關於日期的調整，下列何者正確？",
        options: ["日期要加一天", "日期要減一天", "日期不變，時間加一小時", "日期不變，時間減一小時"],
        correct: 0,
        desc: "180° 線西側（東半球）時間最快，東側（西半球）時間最慢。從西半球跨入東半球是進入較快時間區，因此日期需「加一天」。"
      },
      {
        question: "雪梨 (150°E) 時間是 5 月 5 日早上 5:00，此時倫敦 (0°) 的日期與時間是？",
        options: ["5 月 4 日晚上 7:00", "5 月 4 日晚上 8:00", "5 月 5 日下午 3:00", "5 月 5 日下午 5:00"],
        correct: 0,
        desc: "時差 10 小時。倫敦在雪梨西邊時間較慢，5 月 5 日 5:00 減去 10 小時為 5 月 4 日晚上 7:00。"
      }
    ]
  };

  // --- 徽章資料定義 ---
  const BADGES = [
    {
      id: "taipei_101",
      name: "台北 101 徽章",
      icon: "🗼",
      cost: 5,
      lat: "25.0°N",
      timezone: "東八區 (GMT+8)",
      desc: "台北是台灣的首都，標準時間使用 GMT+8 國家標準時間，每天清晨與台北 101 一起迎接第一道曙光！"
    },
    {
      id: "big_ben",
      name: "大笨鐘徽章 (倫敦)",
      icon: "🇬🇧",
      cost: 10,
      lat: "51.5°N",
      timezone: "零時區 (GMT+0)",
      desc: "倫敦是格林威治標準時間 (GMT) 的起點，本初子午線貫穿此處，也是世界劃分時區的基準線喔！"
    },
    {
      id: "fuji_mountain",
      name: "富士山徽章 (東京)",
      icon: "🗻",
      cost: 15,
      lat: "35.6°N",
      timezone: "東九區 (GMT+9)",
      desc: "日本屬於 GMT+9 時區，比台灣快一小時。富士山不僅是日本最高峰，也是日出迷人的象徵！"
    },
    {
      id: "statue_of_liberty",
      name: "自由女神徽章 (紐約)",
      icon: "🗽",
      cost: 20,
      lat: "40.7°N",
      timezone: "西五區 (GMT-5)",
      desc: "紐約位於西五區 (GMT-5)，比台灣慢 13 小時。這座自由女神像是世界和平與自由著名的地標。"
    },
    {
      id: "sydney_opera",
      name: "雪梨歌劇院徽章",
      icon: "🐚",
      cost: 25,
      lat: "33.9°S",
      timezone: "東十區 (GMT+10)",
      desc: "雪梨位於東十區，比台灣快 2 小時。雪梨歌劇院是跨年倒數全球最早迎接新年的地標之一！"
    },
    {
      id: "pyramids",
      name: "金字塔徽章 (開羅)",
      icon: "🏜️",
      cost: 30,
      lat: "30.0°N",
      timezone: "東二區 (GMT+2)",
      desc: "埃及開羅位於 GMT+2 時區，這裡有古老神祕的吉薩金字塔群，見證了幾千年的時空與歷史變遷。"
    },
    {
      id: "golden_gate",
      name: "金門大橋徽章 (舊金山)",
      icon: "🌉",
      cost: 35,
      lat: "37.8°N",
      timezone: "西八區 (GMT-8)",
      desc: "舊金山位於美國太平洋時區 (GMT-8)，著名的金門大橋常年被濃霧籠罩，展現獨特美麗的灣區風情。"
    }
  ];

  // --- 狀態管理與儲存 ---
  let quizDifficulty = "easy";
  let quizQuestions = [];
  let currentQIndex = 0;
  let quizScore = 0;
  let selectedOptIdx = null;

  function getStars() {
    return parseInt(localStorage.getItem("learning-stars") || "0", 10);
  }

  function saveStars(count) {
    localStorage.setItem("learning-stars", count);
    const starCountEl = $("star-count");
    if (starCountEl) starCountEl.textContent = count;
  }

  function getUnlockedBadges() {
    return JSON.parse(localStorage.getItem("learning-unlocked-badges") || "[]");
  }

  function unlockBadgeId(id) {
    const list = getUnlockedBadges();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem("learning-unlocked-badges", JSON.stringify(list));
    }
  }

  // --- 挑戰賽函式 ---
  function initQuizUI() {
    const startScreen = $("quiz-start-screen");
    const activeScreen = $("quiz-active-screen");
    const resultScreen = $("quiz-result-screen");

    if (startScreen) startScreen.style.display = "block";
    if (activeScreen) activeScreen.style.display = "none";
    if (resultScreen) resultScreen.style.display = "none";

    // 難度按鈕切換
    const diffButtons = document.querySelectorAll(".btn-diff");
    diffButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        diffButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        quizDifficulty = btn.dataset.level || "easy";
      });
    });

    // 開始挑戰按鈕
    $("btn-start-quiz")?.addEventListener("click", startQuiz);

    // 下一題按鈕
    $("btn-next-question")?.addEventListener("click", nextQuestion);

    // 重新挑戰按鈕
    $("btn-restart-quiz")?.addEventListener("click", () => {
      if (startScreen) startScreen.style.display = "block";
      if (resultScreen) resultScreen.style.display = "none";
    });

    // 去徽章牆按鈕
    $("btn-go-badges")?.addEventListener("click", () => {
      const badgeTabBtn = document.querySelector('.nav-tab[data-tab="tab-badges"]');
      if (badgeTabBtn) {
        badgeTabBtn.click();
      }
    });
  }

  function startQuiz() {
    quizQuestions = QUIZ_QUESTIONS[quizDifficulty] || QUIZ_QUESTIONS.easy;
    currentQIndex = 0;
    quizScore = 0;
    
    $("quiz-start-screen").style.display = "none";
    $("quiz-active-screen").style.display = "block";
    $("quiz-result-screen").style.display = "none";

    loadQuestion();
  }

  function loadQuestion() {
    selectedOptIdx = null;
    const q = quizQuestions[currentQIndex];
    
    // 更新進度與難度
    const progressPercent = (currentQIndex / quizQuestions.length) * 100;
    $("quiz-progress-bar").style.width = `${progressPercent}%`;
    $("quiz-q-num").textContent = `第 ${currentQIndex + 1} 題 / 共 ${quizQuestions.length} 題`;
    
    const diffText = {
      easy: "難度：簡單",
      medium: "難度：中等",
      hard: "難度：困難"
    };
    $("quiz-q-diff").textContent = diffText[quizDifficulty] || "難度：簡單";
    
    $("quiz-q-text").textContent = q.question;

    const container = $("quiz-options-container");
    container.innerHTML = "";
    q.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "btn-option";
      btn.innerHTML = `<span class="option-letter">${String.fromCharCode(65 + idx)}</span>${opt}`;
      btn.addEventListener("click", () => {
        if (selectedOptIdx !== null) return;
        selectOption(idx);
      });
      container.appendChild(btn);
    });

    $("quiz-feedback").style.display = "none";
  }

  function selectOption(idx) {
    selectedOptIdx = idx;
    const q = quizQuestions[currentQIndex];
    const isCorrect = idx === q.correct;
    
    if (isCorrect) {
      quizScore++;
    }

    const optionButtons = document.querySelectorAll(".btn-option");
    optionButtons.forEach((btn, bIdx) => {
      btn.classList.add("disabled");
      if (bIdx === q.correct) {
        btn.classList.add("correct-choice");
      } else if (bIdx === selectedOptIdx) {
        btn.classList.add("incorrect-choice");
      }
    });

    const feedback = $("quiz-feedback");
    const icon = $("feedback-icon");
    const title = $("feedback-title");
    const desc = $("feedback-desc");

    if (isCorrect) {
      icon.textContent = "🎉";
      title.textContent = "答對了！";
      title.style.color = "var(--color-success)";
    } else {
      icon.textContent = "😢";
      title.textContent = "答錯了！";
      title.style.color = "var(--color-error)";
    }

    desc.textContent = q.desc;
    feedback.style.display = "flex";
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function nextQuestion() {
    currentQIndex++;
    if (currentQIndex < quizQuestions.length) {
      loadQuestion();
    } else {
      showResult();
    }
  }

  function showResult() {
    $("quiz-active-screen").style.display = "none";
    $("quiz-result-screen").style.display = "block";
    $("quiz-progress-bar").style.width = "100%";

    $("result-correct-count").textContent = `${quizScore}/${quizQuestions.length}`;

    const rewardMultiplier = {
      easy: 2,
      medium: 3,
      hard: 4
    };
    const factor = rewardMultiplier[quizDifficulty] || 2;
    const rewardShards = quizScore * factor;

    $("result-reward-shards").textContent = `+${rewardShards}`;

    let evalText = "做得好！繼續加油！";
    if (quizScore === quizQuestions.length) {
      evalText = "👑 太厲害了！你已經是個時空大師了！";
    } else if (quizScore >= 3) {
      evalText = "🌟 表現優異！快去解鎖你的時空徽章吧！";
    }
    $("result-eval-text").textContent = evalText;

    const currentStars = getStars();
    saveStars(currentStars + rewardShards);

    renderBadges();
  }

  // --- 徽章詳情彈窗 ---
  function showBadgeDetail(badge) {
    let overlay = $("badge-modal-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "badge-modal-overlay";
    overlay.className = "badge-modal-overlay";
    overlay.innerHTML = `
      <div class="badge-modal">
        <div class="badge-modal-icon">${badge.icon}</div>
        <h3>${badge.name}</h3>
        <span class="badge-modal-meta">${badge.lat} | ${badge.timezone}</span>
        <p class="badge-modal-desc">${badge.desc}</p>
        <button class="btn-close-modal" id="btn-close-badge-modal">關閉手札</button>
      </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => overlay.classList.add("active"), 10);

    const closeBtn = $("btn-close-badge-modal");
    closeBtn?.addEventListener("click", () => {
      overlay.classList.remove("active");
      setTimeout(() => overlay.remove(), 300);
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
        setTimeout(() => overlay.remove(), 300);
      }
    });
  }

  // --- 徽章牆渲染與解鎖 ---
  function renderBadges() {
    const container = $("badges-grid-container");
    if (!container) return;

    const unlocked = getUnlockedBadges();
    const stars = getStars();

    container.innerHTML = "";

    BADGES.forEach((badge) => {
      const isUnlocked = unlocked.includes(badge.id);
      const card = document.createElement("div");
      card.className = `badge-card ${isUnlocked ? "unlocked" : "locked"}`;
      card.dataset.id = badge.id;

      let iconHtml = `<div class="badge-card-icon">${badge.icon}</div>`;
      if (!isUnlocked) {
        iconHtml += `<div class="badge-card-lock-overlay">🔒</div>`;
      }

      card.innerHTML = `
        <div class="badge-card-icon-container">
          ${iconHtml}
        </div>
        <div class="badge-card-info">
          <h4>${badge.name}</h4>
          <p>${badge.timezone}</p>
        </div>
        <button class="badge-unlock-btn" data-id="${badge.id}" data-cost="${badge.cost}">
          ✨ 解鎖 (${badge.cost})
        </button>
      `;

      card.addEventListener("click", (e) => {
        if (e.target.classList.contains("badge-unlock-btn") || e.target.closest(".badge-unlock-btn")) {
          return;
        }

        if (isUnlocked) {
          showBadgeDetail(badge);
        } else {
          alert(`此徽章尚未解鎖，請點選下方解鎖按鈕！(解鎖需要 ${badge.cost} 個星之碎片)`);
        }
      });

      const unlockBtn = card.querySelector(".badge-unlock-btn");
      if (unlockBtn) {
        unlockBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (isUnlocked) return;

          const currentStars = getStars();
          if (currentStars >= badge.cost) {
            const newStars = currentStars - badge.cost;
            saveStars(newStars);
            unlockBadgeId(badge.id);
            alert(`🎉 恭喜！您已成功解鎖了「${badge.name}」！`);
            renderBadges();
          } else {
            alert(`😢 星之碎片不足！解鎖此徽章需要 ${badge.cost} 個碎片，您目前只有 ${currentStars} 個。快去挑戰賽答題賺取碎片吧！`);
          }
        });
      }

      container.appendChild(card);
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((item) => item.classList.toggle("active", item === tab));
      panes.forEach((pane) => pane.classList.toggle("active", pane.id === target));
      if (target === "tab-badges") {
        renderBadges();
      }
    });
  });

  [cityA, cityB].forEach((selectEl, index) => {
    if (!selectEl) return;
    const suffix = index === 0 ? "a" : "b";
    selectEl.addEventListener("change", () => {
      setCustomRow(selectEl, suffix);
      calculate();
    });
  });

  ["lon-val-a", "lon-dir-a", "lon-val-b", "lon-dir-b"].forEach((id) => {
    const node = $(id);
    if (node) node.addEventListener("input", calculate);
    if (node) node.addEventListener("change", calculate);
  });

  if (timeA) {
    timeA.value = nowLocalDatetime();
    timeA.addEventListener("input", calculate);
  }
  $("btn-swap-locations")?.addEventListener("click", () => {
    const a = cityA.value;
    cityA.value = cityB.value;
    cityB.value = a;
    setCustomRow(cityA, "a");
    setCustomRow(cityB, "b");
    calculate();
  });
  $("btn-move-west")?.addEventListener("click", () => shiftA(-15));
  $("btn-move-east")?.addEventListener("click", () => shiftA(15));
  $("btn-reset")?.addEventListener("click", () => {
    localStorage.removeItem("learning-stars");
    localStorage.removeItem("learning-unlocked-badges");
    if ($("star-count")) $("star-count").textContent = "0";
    renderBadges();
  });

  if ($("star-count")) $("star-count").textContent = getStars();
  setCustomRow(cityA, "a");
  setCustomRow(cityB, "b");
  calculate();

  // --- 初始化挑戰與徽章牆 ---
  initQuizUI();
  renderBadges();
})();
