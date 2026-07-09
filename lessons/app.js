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

  function updateGlobe(lonA, lonB) {
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
        .pointRadius(0.8);
    }
    window.learningGlobe.pointsData([
      { lat: 24, lng: lonA, color: "#ff8da1" },
      { lat: -12, lng: lonB, color: "#64b5f6" }
    ]).pointColor("color");
  }

  function calculate() {
    if (!timeA || !cityA || !cityB) return;
    const lonA = selectedLongitude(cityA, "a");
    const lonB = selectedLongitude(cityB, "b");
    const base = new Date(timeA.value || nowLocalDatetime());
    const diffHours = (lonB - lonA) / 15;
    const target = new Date(base.getTime() + diffHours * 60 * 60 * 1000);
    setClock("a", base);
    setClock("b", target);
    updateAxis(lonA, lonB);
    updateSky(lonA, lonB);
    updateGlobe(lonA, lonB);

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

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((item) => item.classList.toggle("active", item === tab));
      panes.forEach((pane) => pane.classList.toggle("active", pane.id === target));
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
    if ($("star-count")) $("star-count").textContent = "0";
  });

  if ($("star-count")) $("star-count").textContent = localStorage.getItem("learning-stars") || "0";
  setCustomRow(cityA, "a");
  setCustomRow(cityB, "b");
  calculate();
})();
