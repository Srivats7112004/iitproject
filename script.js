// =====================
// Globals
// =====================
let isCalculating = false;
let emissionsChart = null;
let yearsChart = null;

// Theme management
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const body = document.documentElement;

// DOM elements
const form = document.getElementById('emissionsForm');
const resultsSection = document.getElementById('resultsSection');
const submitBtn = form.querySelector('.submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const loadingSpinner = submitBtn.querySelector('.loading-spinner');

// Form inputs
const stateInput = document.getElementById('state');
const vehicleTypeInput = document.getElementById('vehicleType');
const scenarioYearInput = document.getElementById('scenarioYear'); // drives EF
const distanceInput = document.getElementById('distance');
const efficiencyInput = document.getElementById('efficiency');
const evEfficiencyInput = document.getElementById('evEfficiency');
const fuelTypeInput = document.getElementById('fuelType');

// Result elements
const resultsTable = document.getElementById('resultsTable').querySelector('tbody');
const savingsMessage = document.getElementById('savingsMessage');
const runMetaEl = document.getElementById('runMeta');

// =====================
// Theme
// =====================
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
}
function setTheme(theme) {
  if (theme === 'light') {
    body.classList.add('light-mode');
    body.classList.remove('dark-mode');
    themeIcon.textContent = '🌙';
    localStorage.setItem('theme', 'light');
  } else {
    body.classList.add('dark-mode');
    body.classList.remove('light-mode');
    themeIcon.textContent = '☀️';
    localStorage.setItem('theme', 'dark');
  }
}
function toggleTheme() {
  const isLight = body.classList.contains('light-mode');
  setTheme(isLight ? 'dark' : 'light');
  refreshChartsTheme();
}

// =====================
// Particles (visual)
// =====================
function createParticles() {
  const particlesContainer = document.getElementById('particles');
  if (!particlesContainer) return;
  for (let i = 0; i < 15; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 15 + 's';
    p.style.animationDuration = (15 + Math.random() * 10) + 's';
    particlesContainer.appendChild(p);
  }
}

// =====================
// Loading button state
// =====================
function setCalculatingState(calculating) {
  isCalculating = calculating;
  if (calculating) {
    btnText.style.display = 'none';
    loadingSpinner.style.display = 'inline-block';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
  } else {
    loadingSpinner.style.display = 'none';
    btnText.style.display = 'inline';
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
  }
}

// =====================
// Emission data
// =====================

// India average fallback (g/kWh)
const INDIA_AVG_G_PER_KWH_2024 = 1327;

// 2025 baseline (g CO2/kWh) = your 2024 sheet column ×1000
const defaultStateEmissionFactor = {
  "Andaman & Nicobar Islands": 119,
  "Andhra Pradesh": 1323,
  "Arunachal Pradesh": 36,
  "Assam": 1178,
  "Bihar": 1614,
  "Chhattisgarh": 1488,
  "Goa": 144,
  "Gujarat": 1764,
  "Haryana": 1836,
  "Himachal Pradesh": 35,
  "Jharkhand": 1424,
  "Karnataka": 1319,
  "Kerala": 55,
  "Madhya Pradesh": 1428,
  "Maharashtra": 1612,
  "Manipur": 45,
  "Meghalaya": 35,
  "Mizoram": 41,
  "Nagaland": 40,
  "Odisha": 1453,
  "Punjab": 1479,
  "Rajasthan": 1280,
  "Sikkim": 37,
  "Tamil Nadu": 1463,
  "Telangana": 1385,
  "Tripura": 1114,
  "Uttar Pradesh": 1439,
  "Uttarakhand": 85,
  "West Bengal": 1432,
  "Chandigarh": 146,
  "Dadra & Nagar Haveli": 141,
  "Daman & Diu": 140,
  "Delhi": 862,
  "Jammu & Kashmir": 56,
  "Lakshadweep": 146,
  "Ladakh": 41,
  "Puducherry": 934
};

// Multi-year EF maps
const stateEF_2025 = defaultStateEmissionFactor;
let stateEF_2030 = {};
let stateEF_2050 = {};
// 2070 = 0 for all states (requested)
const ZERO_FOR_ALL_STATES = Object.keys(defaultStateEmissionFactor)
  .reduce((acc, k) => (acc[k] = 0, acc), {});

const stateEmissionFactorsByYear = {
  "2025": stateEF_2025,
  "2030": stateEF_2030,
  "2050": stateEF_2050,
  "2070": ZERO_FOR_ALL_STATES
};

// Consistent order to paste 2030/2050 lists
const STATES_UTS_ORDER = [
  "Andaman & Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar",
  "Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Chandigarh","Dadra & Nagar Haveli","Daman & Diu","Delhi",
  "Jammu & Kashmir","Lakshadweep","Ladakh","Puducherry"
];

// Load 2030 values (kg/kWh list in order) → g/kWh map
function apply2030ValuesKgPerKWh(listInKgPerKWh) {
  const map = {};
  const n = Math.min(listInKgPerKWh.length, STATES_UTS_ORDER.length);
  for (let i = 0; i < n; i++) {
    const kg = Number(listInKgPerKWh[i]);
    if (Number.isFinite(kg)) map[STATES_UTS_ORDER[i]] = Math.round(kg * 1000);
  }
  stateEF_2030 = map;
  stateEmissionFactorsByYear["2030"] = stateEF_2030;
}

// Load 2050 values (kg/kWh list in order) → g/kWh map
function apply2050ValuesKgPerKWh(listInKgPerKWh) {
  const map = {};
  const n = Math.min(listInKgPerKWh.length, STATES_UTS_ORDER.length);
  for (let i = 0; i < n; i++) {
    const kg = Number(listInKgPerKWh[i]);
    if (Number.isFinite(kg)) map[STATES_UTS_ORDER[i]] = Math.round(kg * 1000);
  }
  stateEF_2050 = map;
  stateEmissionFactorsByYear["2050"] = stateEF_2050;
}

// NOTE: Paste your 2030 and 2050 values (kg/kWh) below in the exact order above and uncomment.
// apply2030ValuesKgPerKWh([ /* 37 kg/kWh values for 2030 in order */ ]);
// apply2050ValuesKgPerKWh([ /* 37 kg/kWh values for 2050 in order */ ]);

// Fuel EFs (g/L)
const defaultFuelEmissionFactor = {
  petrol: 2271,
  diesel: 2653
};

// =====================
// Helpers
// =====================
function normalizeScenarioYear(raw) {
  const y = String(raw || '').trim();
  return (y === '2030' || y === '2050' || y === '2070') ? y : '2025';
}
function getStateEF(state, year) {
  const y = normalizeScenarioYear(year);
  const map = stateEmissionFactorsByYear[y];
  const ef = map && map[state];
  if (ef != null) return ef;
  // fallback to 2025 value for that state, else India average
  return stateEF_2025[state] ?? INDIA_AVG_G_PER_KWH_2024;
}
// EV kWh/km (auto-convert Wh/km if value > 5)
function normalizeEvEffKWhPerKm(raw) {
  let e = Number(raw);
  if (!Number.isFinite(e) || e <= 0) return 0;
  return e > 5 ? e / 1000 : e;
}

// =====================
// Validation & Form data
// =====================
function validateForm() {
  const requiredFields = [
    stateInput, vehicleTypeInput, scenarioYearInput,
    distanceInput, efficiencyInput, evEfficiencyInput, fuelTypeInput
  ];
  for (let field of requiredFields) {
    if (!field.value || (field.type === 'number' && parseFloat(field.value) <= 0)) {
      field.focus();
      showNotification('Please fill in all required fields with valid values.', 'error');
      return false;
    }
  }
  return true;
}
function getFormData() {
  return {
    state: stateInput.value,
    vehicleType: vehicleTypeInput.value,
    scenarioYear: normalizeScenarioYear(scenarioYearInput.value),
    distance: parseFloat(distanceInput.value),                // daily km
    efficiency: parseFloat(efficiencyInput.value),            // km/L
    evEfficiency: parseFloat(evEfficiencyInput.value),        // kWh/km (or Wh/km)
    fuelType: fuelTypeInput.value
  };
}

// =====================
// Core calculations
// =====================
function calculateEmissions(input) {
  const stateEF = getStateEF(input.state, input.scenarioYear);
  const evEffKWhPerKm = normalizeEvEffKWhPerKm(input.evEfficiency);
  const annualDistanceKm = (Number(input.distance) || 0) * 365;

  // EV
  const evPerKm = evEffKWhPerKm * stateEF;       // g/km
  const annualEvG  = evPerKm * annualDistanceKm; // g/yr
  const annualEvKg = annualEvG / 1000;

  // Petrol
  const petrolEffKmPerL = input.vehicleType === "bus" ? 0 : Number(input.efficiency);
  const petrol_g_per_km = petrolEffKmPerL > 0
    ? (1 / petrolEffKmPerL) * defaultFuelEmissionFactor.petrol * 1.15
    : 0;
  const annualPetrolG  = petrol_g_per_km * annualDistanceKm;
  const annualPetrolKg = annualPetrolG / 1000;

  // Diesel (bus default if not provided)
  const dieselEffKmPerL = input.vehicleType === "bus"
    ? (Number(input.efficiency) > 0 ? Number(input.efficiency) : 2.6)
    : Number(input.efficiency);
  const diesel_g_per_km = dieselEffKmPerL > 0
    ? (1 / dieselEffKmPerL) * defaultFuelEmissionFactor.diesel * 1.15
    : 0;
  const annualDieselG  = diesel_g_per_km * annualDistanceKm;
  const annualDieselKg = annualDieselG / 1000;

  const results = [
    { label: "EV",     gPerKm: evPerKm,         annualG: annualEvG,      annualKg: annualEvKg },
    { label: "Petrol", gPerKm: petrol_g_per_km, annualG: annualPetrolG,  annualKg: annualPetrolKg },
    { label: "Diesel", gPerKm: diesel_g_per_km, annualG: annualDieselG,  annualKg: annualDieselKg }
  ];

  const ref = input.fuelType === "petrol" ? petrol_g_per_km : diesel_g_per_km;
  const reduction = ref > 0 ? ((ref - evPerKm) / ref) * 100 : 0;
  const savingsMsg = reduction > 0
    ? `Switching to EV reduces CO₂/km by ${reduction.toFixed(0)}% compared to ${input.fuelType}.`
    : `EV emissions are not lower than ${input.fuelType} for this configuration.`;

  return { results, savings: savingsMsg };
}

// =====================
// Results rendering
// =====================
function displayResults(calculationResults) {
  const { results, savings } = calculationResults;

  // Table
  resultsTable.innerHTML = '';
  results.forEach(result => {
    const row = resultsTable.insertRow();
    row.innerHTML = `
      <td>${result.label}</td>
      <td>${result.gPerKm.toFixed(2)}</td>
      <td>${result.annualKg.toFixed(2)}</td>
    `;
  });

  // Savings
  savingsMessage.textContent = savings;

  // Run summary
  const inputNow = getFormData();
  if (runMetaEl) {
    runMetaEl.textContent =
      `State: ${inputNow.state} | Scenario: ${inputNow.scenarioYear} | Daily: ${distanceInput.value} km | ` +
      `ICE: ${efficiencyInput.value} km/L | EV: ${evEfficiencyInput.value} kWh/km`;
  }

  // Tech comparison chart
  const techCanvas = document.getElementById('emissionsChart');
  if (techCanvas) {
    const ctx = techCanvas.getContext('2d');
    if (emissionsChart) emissionsChart.destroy();

    const isLightMode = body.classList.contains('light-mode');
    const textColor = isLightMode ? '#2c2c2c' : '#fffbe5';
    const gridColor = isLightMode ? '#dee2e6' : '#333333';

    emissionsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: results.map(r => r.label),
        datasets: [{
          label: 'CO₂ Emissions (g/km)',
          data: results.map(r => r.gPerKm),
          backgroundColor: ['#ffd600', '#333333', '#666666'],
          borderColor: '#000000',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
          x: { ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    });
  }

  // Year comparison chart (2025 / 2030 / 2050 / 2070)
  const yearsCanvas = document.getElementById('yearsChart');
  if (yearsCanvas) {
    const evEffKWhPerKm = normalizeEvEffKWhPerKm(inputNow.evEfficiency);
    const years = ['2025', '2030', '2050', '2070'];

    const evByYear = years.map(y => evEffKWhPerKm * getStateEF(inputNow.state, y));

    const petrolRow = results.find(r => r.label === 'Petrol');
    const dieselRow = results.find(r => r.label === 'Diesel');
    const petrolKm = petrolRow ? petrolRow.gPerKm : 0;
    const dieselKm = dieselRow ? dieselRow.gPerKm : 0;

    const petrolByYear = years.map(() => petrolKm); // unchanged across years
    const dieselByYear = years.map(() => dieselKm); // unchanged across years

    if (yearsChart) yearsChart.destroy();

    const isLightMode = body.classList.contains('light-mode');
    const textColor = isLightMode ? '#2c2c2c' : '#fffbe5';
    const gridColor = isLightMode ? '#dee2e6' : '#333333';

    const ctxYears = yearsCanvas.getContext('2d');
    yearsChart = new Chart(ctxYears, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          { label: 'EV (g/km)',     data: evByYear,     backgroundColor: '#ffd600', borderColor: '#000', borderWidth: 2 },
          { label: 'Petrol (g/km)', data: petrolByYear, backgroundColor: '#333333', borderColor: '#000', borderWidth: 2 },
          { label: 'Diesel (g/km)', data: dieselByYear, backgroundColor: '#666666', borderColor: '#000', borderWidth: 2 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
          x: { ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    });
  }

  // Reveal results
  resultsSection.style.display = 'block';
  resultsSection.style.opacity = '0';
  resultsSection.style.transform = 'translateY(30px)';
  setTimeout(() => {
    resultsSection.style.transition = 'all 0.6s ease';
    resultsSection.style.opacity = '1';
    resultsSection.style.transform = 'translateY(0)';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// Refresh chart colors after theme toggle
function refreshChartsTheme() {
  const isLightMode = body.classList.contains('light-mode');
  const textColor = isLightMode ? '#2c2c2c' : '#fffbe5';
  const gridColor = isLightMode ? '#dee2e6' : '#333333';

  [emissionsChart, yearsChart].forEach(ch => {
    if (!ch) return;
    ch.options.plugins.legend.labels.color = textColor;
    ch.options.scales.x.ticks.color = textColor;
    ch.options.scales.y.ticks.color = textColor;
    ch.options.scales.x.grid.color = gridColor;
    ch.options.scales.y.grid.color = gridColor;
    ch.update();
  });
}

// =====================
// Form handling
// =====================
function recalcAndDisplayIfVisible() {
  if (resultsSection.style.display !== 'none' && !isCalculating) {
    const data = getFormData();
    const results = calculateEmissions(data);
    displayResults(results);
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  if (isCalculating) return;
  if (!validateForm()) return;

  setCalculatingState(true);
  try {
    await new Promise(resolve => setTimeout(resolve, 400));
    const formData = getFormData();
    const results = calculateEmissions(formData);
    displayResults(results);
    showNotification(`Calculated for ${formData.state} (Scenario ${formData.scenarioYear}).`, 'success');
  } catch (err) {
    console.error('Calculation error:', err);
    showNotification('There was an error calculating emissions. Please try again.', 'error');
  } finally {
    setCalculatingState(false);
  }
}

// Auto-update graphs when Scenario Year changes (no need to press Calculate again)
scenarioYearInput?.addEventListener('change', recalcAndDisplayIfVisible);
stateInput?.addEventListener('change', recalcAndDisplayIfVisible);

// =====================
// Notifications
// =====================
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '1rem 1.5rem',
    borderRadius: '0.5rem',
    color: '#000000',
    fontWeight: '600',
    zIndex: '1000',
    opacity: '0',
    transform: 'translateX(100%)',
    transition: 'all 0.3s ease-out',
    maxWidth: '400px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
  });

  if (type === 'success') {
    notification.style.background = '#ffd600';
  } else if (type === 'error') {
    notification.style.background = '#ff6b6b';
    notification.style.color = '#ffffff';
  } else {
    notification.style.background = '#ffd600';
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 50);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// =====================
// Init
// =====================
document.addEventListener('DOMContentLoaded', function () {
  initializeTheme();
  createParticles();
  form.addEventListener('submit', handleFormSubmit);
  themeToggle.addEventListener('click', toggleTheme);

  const cards = document.querySelectorAll('.calculator-card, .chart-card, .table-card, .savings-card');
  cards.forEach(card => {
    card.addEventListener('mouseenter', function () {
      this.style.transform = 'translateY(-5px)';
    });
    card.addEventListener('mouseleave', function () {
      this.style.transform = 'translateY(0)';
    });
  });
});
apply2030ValuesKgPerKWh([
  // Andaman & Nicobar Islands
  0,
  // Andhra Pradesh → Puducherry (in order)
  0.898423256, 0, 0.921635988, 0.966367855, 0.972706993, 0,
  1.033086489, 1.026880955, 0, 0.955981736, 0.878828836, 0,
  0.956050356, 1.027170656, 0, 0, 0, 0,
  0.910898989, 0.944724643, 0.8891024, 0, 0.917677072,
  0.933219905, 0.911475381, 0.939734867, 0.53709137, 0.96330823,
  0, 0, 0.868101399, 0, 0, 0, 0.88065996
]);
apply2050ValuesKgPerKWh([
  // Andaman & Nicobar Islands
  0,
  // Andhra Pradesh → Puducherry (in order)
  0.588059, 0, 0.603253, 0.632532, 0.636681, 0,
  0.676202, 0.67214, 0, 0.625734, 0.575233, 0,
  0.625778, 0.67233, 0, 0, 0, 0,
  0.596225, 0.618365, 0.581958, 0, 0.600661,
  0.610835, 0.596602, 0.615099, 0.351551, 0.630529,
  0, 0, 0.568212, 0, 0, 0, 0.576432
]);
