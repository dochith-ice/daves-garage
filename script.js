// --- Helpers ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 1700);
}

function labelStatus(s) {
  if (s === "offen") return "Offen";
  if (s === "in-arbeit") return "In Arbeit";
  if (s === "fertig") return "Fertig";
  return s;
}

// --- Tabs ---
$$(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    $$(".panel").forEach((p) => p.classList.remove("active"));
    const panel = $(`#tab-${tab}`);
    panel.classList.add("active");

    // restart entrance animation (clean Shaga feel)
    panel.querySelectorAll(".card").forEach((c) => {
      c.style.animation = "none";
      c.offsetHeight; // reflow
      c.style.animation = "";
    });
  });
});

// ===============================
// AUFTRÄGE (LocalStorage)
// ===============================
const JOB_KEY = "garage_jobs_v1";
let jobs = load(JOB_KEY);

// Modal
const modal = $("#modal");
$("#newJobBtn").addEventListener("click", () => modal.classList.add("open"));
$("#closeModal").addEventListener("click", () => modal.classList.remove("open"));
modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });

// UI
const jobList = $("#jobList");
const emptyJobs = $("#emptyJobs");
const filterStatus = $("#filterStatus");

const jobCustomer = $("#jobCustomer");
const jobVehicle = $("#jobVehicle");

function renderJobs() {
  const filter = filterStatus.value;
  const shown = filter === "all" ? jobs : jobs.filter(j => j.status === filter);

  jobList.innerHTML = "";

  if (shown.length === 0) emptyJobs.style.display = "block";
  else emptyJobs.style.display = "none";

  shown
    .slice()
    .sort((a,b) => b.createdAt - a.createdAt)
    .forEach((job) => {
      const li = document.createElement("li");
      li.className = "item";

      li.innerHTML = `
        <div class="item-top">
          <strong>${escapeHtml(job.title)}</strong>
          <span class="badge">${labelStatus(job.status)}</span>
        </div>
        ${(job.customerId || job.vehicleId) ? (() => {
          const cName = job.customerId ? customerNameById(job.customerId) : "";
          const v = job.vehicleId ? vehicleById(job.vehicleId) : null;
          const plate = v?.plate || "";
          const bits = [];
          if (cName) bits.push(`👤 ${escapeHtml(cName)}`);
          if (plate) bits.push(`🚗 ${escapeHtml(plate)}`);
          return `<p>${bits.join(" • ")}</p>`;
        })() : ""}
        ${job.desc ? `<p>${escapeHtml(job.desc)}</p>` : ""}
        <div class="row" style="margin-top:10px;">
          <button class="btn" data-action="next" data-id="${job.id}">Status wechseln</button>
          <button class="btn" data-action="delete" data-id="${job.id}">Löschen</button>
        </div>
      `;

      jobList.appendChild(li);
    });
}

filterStatus.addEventListener("change", renderJobs);

$("#jobForm").addEventListener("submit", (e) => {
  if (jobCustomer && jobVehicle) {
    jobCustomer.addEventListener("change", () => {
      refreshCustomerOptions();
    });
  }
  e.preventDefault();

  const title = $("#jobTitle").value.trim();
  const desc = $("#jobDesc").value.trim();
  const status = $("#jobStatus").value;
  const customerId = jobCustomer ? (jobCustomer.value || "") : "";
const vehicleId = jobVehicle ? (jobVehicle.value || "") : "";

  if (!title) return;

  jobs.push({ id: uid(), title, desc, status, customerId, vehicleId, createdAt: Date.now() });
  save(JOB_KEY, jobs);
  toast("Auftrag gespeichert ✅");

  e.target.reset();
  modal.classList.remove("open");
  document.querySelector('[data-tab="jobs"]').click();
  renderJobs();
});

jobList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "delete") {
    jobs = jobs.filter(j => j.id !== id);
    save(JOB_KEY, jobs);
    toast("Auftrag gelöscht 🗑️");
    renderJobs();
  }

  if (action === "next") {
    const order = ["offen", "in-arbeit", "fertig"];
    jobs = jobs.map(j => {
      if (j.id !== id) return j;
      const idx = order.indexOf(j.status);
      return { ...j, status: order[(idx + 1) % order.length] };
    });
    save(JOB_KEY, jobs);
    toast("Status aktualisiert 🔄");
    renderJobs();
  }
});

$("#clearAll").addEventListener("click", () => {
  const ok = confirm("Wirklich ALLE Aufträge löschen?");
  if (!ok) return;
  jobs = [];
  save(JOB_KEY, jobs);
  toast("Alle Aufträge gelöscht 🗑️");
  renderJobs();
});

// ===============================
// KUNDEN + FAHRZEUGE (LocalStorage)
// ===============================
const CUSTOMER_KEY = "garage_customers_v1";
const VEHICLE_KEY = "garage_vehicles_v1";

let customers = load(CUSTOMER_KEY);
let vehicles = load(VEHICLE_KEY);

// UI refs
const customerModal = $("#customerModal");
const vehicleModal = $("#vehicleModal");

const customerList = $("#customerList");
const emptyCustomers = $("#emptyCustomers");

const vehicleList = $("#vehicleList");
const emptyVehicles = $("#emptyVehicles");

const vehicleCustomer = $("#vehicleCustomer");
const vehicleCustomerFilter = $("#vehicleCustomerFilter");
const vehicleSort = $("#vehicleSort");

// Modal open/close
$("#newCustomerBtn").addEventListener("click", () => customerModal.classList.add("open"));
$("#closeCustomerModal").addEventListener("click", () => customerModal.classList.remove("open"));
customerModal.addEventListener("click", (e) => { if (e.target === customerModal) customerModal.classList.remove("open"); });

$("#newVehicleBtn").addEventListener("click", () => {
  if (customers.length === 0) {
    toast("Bitte zuerst einen Kunden anlegen.");
    return;
  }
  vehicleModal.classList.add("open");
});
$("#closeVehicleModal").addEventListener("click", () => vehicleModal.classList.remove("open"));
vehicleModal.addEventListener("click", (e) => { if (e.target === vehicleModal) vehicleModal.classList.remove("open"); });

// Helpers
function customerNameById(id) {
  function vehicleById(id) {
    return vehicles.find(x => x.id === id) || null;
  }
  const c = customers.find(x => x.id === id);
  return c ? c.name : "Unbekannt";
}
function countVehiclesForCustomer(customerId) {
  return vehicles.filter(v => v.customerId === customerId).length;
}
function normalizePlate(plate) {
  return plate.trim().toUpperCase().replace(/\s+/g, " ");
}
  // Job form dropdowns (optional assignment)
  if (jobCustomer) {
    const currentJobCustomer = jobCustomer.value || "";
    jobCustomer.innerHTML =
      `<option value="">— Kunde (optional) —</option>` +
      customers
        .slice()
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
        .join("");
    jobCustomer.value = customers.some(c => c.id === currentJobCustomer) ? currentJobCustomer : "";
  }

  if (jobVehicle) {
    const currentJobVehicle = jobVehicle.value || "";
    const custId = jobCustomer ? (jobCustomer.value || "") : "";
    const pool = custId ? vehicles.filter(v => v.customerId === custId) : vehicles;

    jobVehicle.innerHTML =
      `<option value="">— Fahrzeug (optional) —</option>` +
      pool
        .slice()
        .sort((a,b) => (a.plate || "").localeCompare(b.plate || ""))
        .map(v => `<option value="${v.id}">${escapeHtml(v.plate)} • ${escapeHtml(customerNameById(v.customerId))}</option>`)
        .join("");

    jobVehicle.value = pool.some(v => v.id === currentJobVehicle) ? currentJobVehicle : "";
  }
// Dropdowns
function refreshCustomerOptions() {
  refreshApptOptions();

    refreshApptOptions();
  // Vehicle form dropdown
  vehicleCustomer.innerHTML = customers
    .slice()
    .sort((a,b) => a.name.localeCompare(b.name))
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");

  // Filter dropdown
  const current = vehicleCustomerFilter.value || "all";
  vehicleCustomerFilter.innerHTML =
    `<option value="all">Alle Kunden</option>` +
    customers
      .slice()
      .sort((a,b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");

  vehicleCustomerFilter.value = customers.some(c => c.id === current) ? current : "all";

  // Keep Termine dropdowns in sync too
  refreshApptOptions();
}

function renderCustomers() {
  customerList.innerHTML = "";
  if (customers.length === 0) {
    emptyCustomers.style.display = "block";
    return;
  }
  emptyCustomers.style.display = "none";

  customers
    .slice()
    .sort((a,b) => b.createdAt - a.createdAt)
    .forEach(c => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div class="item-top">
          <strong>${escapeHtml(c.name)}</strong>
          <span class="badge">${countVehiclesForCustomer(c.id)} Fahrzeuge</span>
        </div>
        <p>
          ${c.phone ? "📞 " + escapeHtml(c.phone) : ""}
          ${c.email ? (c.phone ? " • " : "") + "✉️ " + escapeHtml(c.email) : ""}
        </p>
        <div class="row" style="margin-top:10px;">
          <button class="btn" data-action="delete-customer" data-id="${c.id}">Kunde löschen</button>
        </div>
        <p class="muted small">Löschen entfernt auch alle Fahrzeuge von diesem Kunden.</p>
      `;
      customerList.appendChild(li);
    });
}

function renderVehicles() {
  const filter = vehicleCustomerFilter.value || "all";
  let shown = filter === "all" ? vehicles : vehicles.filter(v => v.customerId === filter);

  const sort = vehicleSort.value;
  if (sort === "newest") shown = shown.slice().sort((a,b) => b.createdAt - a.createdAt);
  if (sort === "plate") shown = shown.slice().sort((a,b) => (a.plate || "").localeCompare(b.plate || ""));
  if (sort === "brand") shown = shown.slice().sort((a,b) => (a.brand || "").localeCompare(b.brand || ""));

  vehicleList.innerHTML = "";
  if (shown.length === 0) {
    emptyVehicles.style.display = "block";
    return;
  }
  emptyVehicles.style.display = "none";

  shown.forEach(v => {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="item-top">
        <strong>${escapeHtml(v.plate)}</strong>
        <span class="badge">${escapeHtml(customerNameById(v.customerId))}</span>
      </div>
      <p>${[v.brand, v.model, v.year].filter(Boolean).map(escapeHtml).join(" • ")}</p>
      <div class="row" style="margin-top:10px;">
        <button class="btn" data-action="delete-vehicle" data-id="${v.id}">Fahrzeug löschen</button>
      </div>
    `;
    vehicleList.appendChild(li);
  });

  refreshApptOptions();
}

vehicleCustomerFilter.addEventListener("change", renderVehicles);
vehicleSort.addEventListener("change", renderVehicles);

// Forms
$("#customerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#customerName").value.trim();
  const phone = $("#customerPhone").value.trim();
  const email = $("#customerEmail").value.trim();
  if (!name) return;

  customers.push({ id: uid(), name, phone, email, createdAt: Date.now() });
  save(CUSTOMER_KEY, customers);
  toast("Kunde gespeichert ✅");

  e.target.reset();
  customerModal.classList.remove("open");

  refreshCustomerOptions();
  renderCustomers();
  renderVehicles();
});

$("#vehicleForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const customerId = $("#vehicleCustomer").value;
  const plate = normalizePlate($("#vehiclePlate").value);
  const brand = $("#vehicleBrand").value.trim();
  const model = $("#vehicleModel").value.trim();
  const yearRaw = $("#vehicleYear").value.trim();
  const year = yearRaw ? String(yearRaw) : "";

  if (!customerId || !plate) return;

  vehicles.push({ id: uid(), customerId, plate, brand, model, year, createdAt: Date.now() });
  save(VEHICLE_KEY, vehicles);
  toast("Fahrzeug gespeichert ✅");

  e.target.reset();
  vehicleModal.classList.remove("open");

  renderCustomers();
  renderVehicles();
  refreshApptOptions();
});

// Delete actions
customerList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "delete-customer") {
    const ok = confirm("Kunde wirklich löschen? (Alle Fahrzeuge dieses Kunden werden ebenfalls gelöscht)");
    if (!ok) return;

    customers = customers.filter(c => c.id !== id);
    vehicles = vehicles.filter(v => v.customerId !== id);

    save(CUSTOMER_KEY, customers);
    save(VEHICLE_KEY, vehicles);
    toast("Kunde gelöscht 🗑️");

    refreshCustomerOptions();
    renderCustomers();
    renderVehicles();
    renderAppts();
  }
});

vehicleList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "delete-vehicle") {
    const ok = confirm("Fahrzeug wirklich löschen?");
    if (!ok) return;

    vehicles = vehicles.filter(v => v.id !== id);
    save(VEHICLE_KEY, vehicles);
    toast("Fahrzeug gelöscht 🗑️");

    renderCustomers();
    renderVehicles();
    renderAppts();
  }
});

// ===============================
// TERMINE (LocalStorage)
// ===============================
const APPT_KEY = "garage_appts_v1";
let appts = load(APPT_KEY);

// UI
const apptModal = $("#apptModal");
const apptList = $("#apptList");
const emptyAppts = $("#emptyAppts");
const apptFilter = $("#apptFilter");
const apptSearch = $("#apptSearch");

const apptCustomer = $("#apptCustomer");
const apptVehicle = $("#apptVehicle");

$("#newApptBtn").addEventListener("click", () => apptModal.classList.add("open"));
$("#closeApptModal").addEventListener("click", () => apptModal.classList.remove("open"));
apptModal.addEventListener("click", (e) => { if (e.target === apptModal) apptModal.classList.remove("open"); });

function refreshApptOptions() {
  if (!apptCustomer || !apptVehicle) return;

  apptCustomer.innerHTML =
    `<option value="">—</option>` +
    customers
      .slice().sort((a,b)=>a.name.localeCompare(b.name))
      .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");

  apptVehicle.innerHTML =
    `<option value="">—</option>` +
    vehicles
      .slice().sort((a,b)=> (a.plate||"").localeCompare(b.plate||""))
      .map(v => `<option value="${v.id}">${escapeHtml(v.plate)} • ${escapeHtml(customerNameById(v.customerId))}</option>`)
      .join("");
}

function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleString("de-CH", {
    weekday:"short", day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  });
}

function renderAppts() {
  const mode = apptFilter.value;
  const q = apptSearch.value.trim().toLowerCase();
  const now = Date.now();

  let shown = appts.slice();

  if (mode === "upcoming") shown = shown.filter(a => a.when >= now - 5*60*1000);
  if (mode === "past") shown = shown.filter(a => a.when < now - 5*60*1000);

  if (q) {
    shown = shown.filter(a => {
      const cName = a.customerId ? customerNameById(a.customerId) : "";
      const v = a.vehicleId ? vehicles.find(x=>x.id===a.vehicleId) : null;
      const plate = v?.plate || "";
      return (
        (a.title||"").toLowerCase().includes(q) ||
        (a.note||"").toLowerCase().includes(q) ||
        cName.toLowerCase().includes(q) ||
        plate.toLowerCase().includes(q)
      );
    });
  }

  shown.sort((a,b)=> a.when - b.when);

  apptList.innerHTML = "";
  if (shown.length === 0) {
    emptyAppts.style.display = "block";
    return;
  }
  emptyAppts.style.display = "none";

  shown.forEach(a => {
    const cName = a.customerId ? customerNameById(a.customerId) : "";
    const v = a.vehicleId ? vehicles.find(x=>x.id===a.vehicleId) : null;
    const plate = v?.plate || "";

    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="item-top">
        <strong>${escapeHtml(a.title)}</strong>
        <span class="badge">${fmtWhen(a.when)}</span>
      </div>
      <p>
        ${cName ? "👤 " + escapeHtml(cName) : ""}
        ${plate ? (cName ? " • " : "") + "🚗 " + escapeHtml(plate) : ""}
      </p>
      ${a.note ? `<p>${escapeHtml(a.note)}</p>` : ""}
      <div class="row" style="margin-top:10px;">
        <button class="btn" data-action="delete-appt" data-id="${a.id}">Löschen</button>
      </div>
    `;
    apptList.appendChild(li);
  });
}

apptFilter.addEventListener("change", renderAppts);
apptSearch.addEventListener("input", renderAppts);

$("#apptForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const whenStr = $("#apptWhen").value;
  const title = $("#apptTitle").value.trim();
  const note = $("#apptNote").value.trim();
  const customerId = apptCustomer.value || "";
  const vehicleId = apptVehicle.value || "";

  if (!whenStr || !title) return;

  const when = new Date(whenStr).getTime();

  appts.push({ id: uid(), when, title, note, customerId, vehicleId, createdAt: Date.now() });
  save(APPT_KEY, appts);
  toast("Termin gespeichert ✅");

  e.target.reset();
  apptModal.classList.remove("open");
  document.querySelector('[data-tab="calendar"]').click();
  renderAppts();
});

apptList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.action === "delete-appt") {
    const ok = confirm("Termin wirklich löschen?");
    if (!ok) return;

    appts = appts.filter(a => a.id !== btn.dataset.id);
    save(APPT_KEY, appts);
    toast("Termin gelöscht 🗑️");
    renderAppts();
  }
});

// --- Initial render ---
refreshCustomerOptions();
renderCustomers();
renderVehicles();
refreshApptOptions();

renderJobs();
renderAppts();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
