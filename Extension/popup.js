// =========================
// CLIENTES (persistencia)
// =========================

let clientes = JSON.parse(localStorage.getItem("clientes")) || [];

let selectedIndex = -1;

// =========================
// ELEMENTOS
// =========================

const search = document.getElementById("search");
const results = document.getElementById("results");

const userInput = document.getElementById("user");
const passInput = document.getElementById("pass");

const autoLoginBtn = document.getElementById("autoLogin");
const fileInput = document.getElementById("fileInput");

// =========================
// INIT
// =========================

window.addEventListener("DOMContentLoaded", () => {
  search.value = "";
  results.innerHTML = "";
  selectedIndex = -1;
  search.focus();
});

// =========================
// IMPORTADOR (EXCEL REAL + CSV + TAB)
// =========================

fileInput.addEventListener("change", (e) => {

  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = (event) => {

    let text = event.target.result;

    // 🔥 normalizar saltos de línea
    text = text
      .replace(/\r/g, "\n")
      .replace(/\n+/g, "\n")
      .trim();

    // 🔥 DETECTAR FORMATO REAL
    let delimiter = "\t"; // 👈 TU CASO (Excel pegado)

    if (!text.includes("\t")) {
      if (text.includes(";")) delimiter = ";";
      else if (text.includes(",")) delimiter = ",";
    }

    const rows = text
      .split("\n")
      .map(r => r.split(delimiter).map(c => c.trim()))
      .filter(r => r.length >= 4 && r[0]);

    console.log("DEBUG ROWS:", rows);

    clientes = rows.map(r => ({
      nombre: r[0],
      ruc: r[1],
      dv: r[2],
      pass: r[3],
      fullRuc: `${r[1]}-${r[2]}`
    }));

    localStorage.setItem("clientes", JSON.stringify(clientes));

    alert("Clientes cargados: " + clientes.length);
  };

  reader.readAsText(file, "utf-8");
});

// =========================
// BUSCADOR
// =========================

search.addEventListener("input", () => {

  const value = search.value.toLowerCase().trim();
  results.innerHTML = "";
  selectedIndex = -1;

  if (!value) return;

  const matches = clientes
    .map(c => {

      const nombre = c.nombre.toLowerCase();
      const ruc = c.ruc.toLowerCase();
      const fullRuc = c.fullRuc.toLowerCase();

      let score = 0;

      if (nombre === value || ruc === value) score += 100;
      if (nombre.startsWith(value)) score += 80;
      if (ruc.startsWith(value)) score += 80;
      if (nombre.includes(value)) score += 50;
      if (ruc.includes(value)) score += 50;
      if (fullRuc.includes(value)) score += 40;

      return { ...c, score };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  matches.forEach(c => {

    const div = document.createElement("div");
    div.className = "result-item";

    div.innerHTML = `
      <div style="font-weight:600;">${c.nombre}</div>
      <div style="font-size:12px; color:#64748b;">
        ${c.ruc}-${c.dv}
      </div>
    `;

    div.onclick = () => {

      search.value = c.nombre;

      userInput.value = c.ruc;
      passInput.value = c.pass;

      results.innerHTML = "";
      selectedIndex = -1;

      autoLoginBtn.focus();
    };

    results.appendChild(div);
  });
});

// =========================
// TECLADO
// =========================

search.addEventListener("keydown", (e) => {

  const items = document.querySelectorAll(".result-item");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex++;
    if (selectedIndex >= items.length) selectedIndex = 0;
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex--;
    if (selectedIndex < 0) selectedIndex = items.length - 1;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    items[selectedIndex]?.click();
  }

  if (e.key === "Escape") {
    results.innerHTML = "";
    selectedIndex = -1;
  }

  items.forEach((el, i) => {
    el.style.background = i === selectedIndex ? "#bae6fd" : "white";
  });
});

// =========================
// LOGIN AUTOMÁTICO
// =========================

autoLoginBtn.addEventListener("click", async () => {

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (user, pass) => {

      const u = document.querySelector("input[type='text'], input[type='email']");
      const p = document.querySelector("input[type='password']");

      if (u) u.value = user;
      if (p) p.value = pass;

      u?.dispatchEvent(new Event("input", { bubbles: true }));
      p?.dispatchEvent(new Event("input", { bubbles: true }));

      const form = p?.closest("form");
      if (form) form.submit();
    },
    args: [userInput.value, passInput.value]
  });

  window.close();

});