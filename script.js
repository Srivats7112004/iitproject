// Global variables
let isCalculating = false;
let emissionsChart = null;

// Theme management
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const body = document.documentElement;

// Initialize theme
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

// Set theme
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

// Toggle theme
function toggleTheme() {
    const isLight = body.classList.contains('light-mode');
    setTheme(isLight ? 'dark' : 'light');
}

// Default emission factors
// Units: g CO₂ per kWh (converted from your sheet's kg/kWh × 1000)
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
  "Tamil Nadu": 1463,   // sheet label was "Tamilnadu"
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
const defaultFuelEmissionFactor = {
    petrol: 2271,
    diesel: 2653
};

// DOM elements
const form = document.getElementById('emissionsForm');
const resultsSection = document.getElementById('resultsSection');
const submitBtn = form.querySelector('.submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const loadingSpinner = submitBtn.querySelector('.loading-spinner');

// Form inputs
const stateInput = document.getElementById('state');
const vehicleTypeInput = document.getElementById('vehicleType');
const yearInput = document.getElementById('year');
const distanceInput = document.getElementById('distance');
const efficiencyInput = document.getElementById('efficiency');
const evEfficiencyInput = document.getElementById('evEfficiency');
const fuelTypeInput = document.getElementById('fuelType');

// Result elements
const resultsTable = document.getElementById('resultsTable').querySelector('tbody');
const savingsMessage = document.getElementById('savingsMessage');

// Enhanced particle system
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 15;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Loading animation
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

// Main calculation function
function calculateEmissions(input) {
    // State EF in g/kWh
    const stateEF = defaultStateEmissionFactor[input.state] || INDIA_AVG_G_PER_KWH_2024;

    // EV efficiency must be kWh/km. If a user enters Wh/km (e.g., 120), auto-convert.
    let evEffKWhPerKm = Number(input.evEfficiency);
    if (!Number.isFinite(evEffKWhPerKm) || evEffKWhPerKm <= 0) evEffKWhPerKm = 0;
    if (evEffKWhPerKm > 5) { // heuristic: >5 is unlikely for kWh/km, assume Wh/km
        evEffKWhPerKm = evEffKWhPerKm / 1000;
    }

    // EV emissions
    const evPerKm = evEffKWhPerKm * stateEF;               // g/km
    const annualDistanceKm = (Number(input.distance) || 0)*365;  // expected: ANNUAL km
    const annualEvG  = evPerKm * annualDistanceKm;         // g/year (your formula)
    const annualEvKg = annualEvG / 1000;                   // keep kg for UI compatibility

    // Petrol emissions (km/l to g/km), keep your 1.15 factor
    const petrolEffKmPerL = input.vehicleType === "bus" ? 0 : Number(input.efficiency);
    const petrol_g_per_km = petrolEffKmPerL > 0
        ? (1 / petrolEffKmPerL) * defaultFuelEmissionFactor.petrol * 1.15
        : 0;
    const annualPetrolG  = petrol_g_per_km * annualDistanceKm;
    const annualPetrolKg = annualPetrolG / 1000;

    // Diesel emissions (km/l to g/km), bus default = 2.6 km/l
    const dieselEffKmPerL = input.vehicleType === "bus" ? 2.6 : Number(input.efficiency);
    const diesel_g_per_km = dieselEffKmPerL > 0
        ? (1 / dieselEffKmPerL) * defaultFuelEmissionFactor.diesel * 1.15
        : 0;
    const annualDieselG  = diesel_g_per_km * annualDistanceKm;
    const annualDieselKg = annualDieselG / 1000;

    const results = [
        { label: "EV",     gPerKm: evPerKm,        annualG: annualEvG,      annualKg: annualEvKg },
        { label: "Petrol", gPerKm: petrol_g_per_km, annualG: annualPetrolG, annualKg: annualPetrolKg },
        { label: "Diesel", gPerKm: diesel_g_per_km, annualG: annualDieselG, annualKg: annualDieselKg }
    ];

    // Savings vs selected fuel, based on per-km emissions (consistent comparison)
    const ref = input.fuelType === "petrol" ? petrol_g_per_km : diesel_g_per_km;
    const reduction = ref > 0 ? ((ref - evPerKm) / ref) * 100 : 0;
    const savingsMsg = reduction > 0
        ? `Switching to EV reduces CO₂/km by ${reduction.toFixed(0)}% compared to ${input.fuelType}.`
        : `EV emissions are not lower than ${input.fuelType} for this configuration.`;

    return { results, savings: savingsMsg };
}

// Display results with chart and table
function displayResults(calculationResults) {
    const { results, savings } = calculationResults;
    
    // Update table
    resultsTable.innerHTML = '';
    results.forEach(result => {
        const row = resultsTable.insertRow();
        row.innerHTML = `
            <td>${result.label}</td>
            <td>${result.gPerKm.toFixed(2)}</td>
            <td>${result.annualKg.toFixed(2)}</td>
        `;
    });

    // Update savings message
    savingsMessage.textContent = savings;

    // Create/update chart
    const ctx = document.getElementById('emissionsChart').getContext('2d');
    
    if (emissionsChart) {
        emissionsChart.destroy();
    }

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
                backgroundColor: [
                    '#ffd600',  // EV - Yellow
                    '#333333',  // Petrol - Dark
                    '#666666'   // Diesel - Gray
                ],
                borderColor: '#000000',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: gridColor
                    }
                },
                x: {
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: gridColor
                    }
                }
            }
        }
    });

    // Show results section with animation
    resultsSection.style.display = 'block';
    resultsSection.style.opacity = '0';
    resultsSection.style.transform = 'translateY(30px)';
    
    setTimeout(() => {
        resultsSection.style.transition = 'all 0.6s ease';
        resultsSection.style.opacity = '1';
        resultsSection.style.transform = 'translateY(0)';
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

// Form validation
function validateForm() {
    const requiredFields = [stateInput, vehicleTypeInput, yearInput, distanceInput, efficiencyInput, evEfficiencyInput, fuelTypeInput];
    
    for (let field of requiredFields) {
        if (!field.value || (field.type === 'number' && parseFloat(field.value) <= 0)) {
            field.focus();
            showNotification('Please fill in all required fields with valid values.', 'error');
            return false;
        }
    }
    return true;
}

// Get form data
function getFormData() {
    return {
        state: stateInput.value,
        vehicleType: vehicleTypeInput.value,
        year: yearInput.value,
        distance: parseFloat(distanceInput.value),
        efficiency: parseFloat(efficiencyInput.value),
        evEfficiency: parseFloat(evEfficiencyInput.value),
        fuelType: fuelTypeInput.value
    };
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (isCalculating) return;
    
    if (!validateForm()) return;
    
    setCalculatingState(true);
    
    try {
        // Simulate calculation delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const formData = getFormData();
        const results = calculateEmissions(formData);
        
        displayResults(results);
        showNotification('Calculation completed successfully!', 'success');
        
    } catch (error) {
        console.error('Calculation error:', error);
        showNotification('There was an error calculating emissions. Please try again.', 'error');
    } finally {
        setCalculatingState(false);
    }
}

// Show notification
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

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    createParticles();
    form.addEventListener('submit', handleFormSubmit);
    themeToggle.addEventListener('click', toggleTheme);
    
    // Add hover effects to cards
    const cards = document.querySelectorAll('.calculator-card, .chart-card, .table-card, .savings-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
});
function populateStates() {
  const stateSelect = document.getElementById('state');
  // Remove existing options except the first placeholder
  stateSelect.length = 1;

  Object.keys(defaultStateEmissionFactor)
    .sort((a, b) => a.localeCompare(b))
    .forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      stateSelect.appendChild(opt);
    });
}

document.addEventListener('DOMContentLoaded', populateStates);