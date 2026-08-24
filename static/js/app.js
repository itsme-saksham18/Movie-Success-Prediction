// CineMetrics AI - Modern Frontend Application Script
let selectedGenres = new Set(['Action', 'Adventure']);
let currentTab = 'predict';
let lastPrediction = null;
let whatIfTimeout = null;
let searchTimeout = null;
let charts = {};

let explorerState = {
  query: '',
  genre: 'All',
  sortBy: 'Revenue (Millions)',
  sortOrder: 'desc',
  page: 1,
  totalPages: 1
};

document.addEventListener('DOMContentLoaded', () => {
  initGenres();
  initExplorerGenreOptions();
  initAutocomplete();
  initInitialValues();
  fetchExplorerMovies(1);
});

// Tab Switching
function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
  const activePane = document.getElementById(`tab-content-${tabId}`);
  if (activePane) activePane.classList.remove('hidden');

  // Update Nav Buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.className = 'nav-btn px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-800/50';
  });
  const activeBtn = document.getElementById(`nav-${tabId}`);
  if (activeBtn) {
    activeBtn.className = 'nav-btn px-4 py-2 text-sm font-medium rounded-lg transition-all text-white bg-brand-600 shadow-md shadow-brand-600/30';
  }

  // Trigger chart renders
  if (tabId === 'analytics') {
    setTimeout(initAnalyticsCharts, 100);
  } else if (tabId === 'whatif') {
    setTimeout(initWhatIfChart, 100);
    runWhatIfLive();
  } else if (tabId === 'model') {
    setTimeout(initModelCharts, 100);
  }
}

// Genre Multi-Select Pills
function initGenres() {
  const container = document.getElementById('genre-pills-container');
  if (!container || !window.APP_METADATA) return;

  const genres = window.APP_METADATA.all_genres || [
    'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 'Drama', 'Family', 
    'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'
  ];

  container.innerHTML = '';
  genres.forEach(g => {
    const isSelected = selectedGenres.has(g);
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `genre-pill px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
      isSelected 
        ? 'active bg-brand-600 text-white border-brand-400 shadow-md shadow-brand-600/30' 
        : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800'
    }`;
    pill.textContent = g;
    pill.onclick = () => toggleGenre(g, pill);
    container.appendChild(pill);
  });

  updateGenreCounter();
}

function toggleGenre(genre, btn) {
  if (selectedGenres.has(genre)) {
    if (selectedGenres.size > 1) {
      selectedGenres.delete(genre);
      btn.className = 'genre-pill px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-slate-900/80 text-slate-300 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800';
    }
  } else {
    if (selectedGenres.size < 4) {
      selectedGenres.add(genre);
      btn.className = 'genre-pill active px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-brand-600 text-white border-brand-400 shadow-md shadow-brand-600/30';
    }
  }
  updateGenreCounter();
}

function updateGenreCounter() {
  const el = document.getElementById('genre-selected-count');
  if (el) el.textContent = `${selectedGenres.size} selected`;
}

// Sliders Synchronizers
function updateRatingDisplay(val) {
  const v = parseFloat(val).toFixed(1);
  const valEl = document.getElementById('rating-val');
  const badgeEl = document.getElementById('rating-badge');
  if (valEl) valEl.textContent = v;

  if (badgeEl) {
    if (v >= 8.0) {
      badgeEl.textContent = 'Universal Acclaim';
      badgeEl.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else if (v >= 7.0) {
      badgeEl.textContent = 'Highly Rated';
      badgeEl.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
    } else if (v >= 6.0) {
      badgeEl.textContent = 'Moderate';
      badgeEl.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30';
    } else {
      badgeEl.textContent = 'Critical Flop';
      badgeEl.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30';
    }
  }
}

function updateMetascoreDisplay(val) {
  const el = document.getElementById('metascore-val');
  if (el) el.textContent = val;
}

function updateRuntimeDisplay(val) {
  const m = parseInt(val);
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  const valEl = document.getElementById('runtime-val');
  const fmtEl = document.getElementById('runtime-formatted');
  if (valEl) valEl.textContent = `${m} min`;
  if (fmtEl) fmtEl.textContent = `${hrs}h ${mins}m`;
}

function updateVotesDisplay(val) {
  const el = document.getElementById('votes-val');
  if (el) el.textContent = parseInt(val).toLocaleString();
}

function setVotes(val) {
  const slider = document.getElementById('input-votes');
  if (slider) {
    slider.value = val;
    updateVotesDisplay(val);
  }
}

function initInitialValues() {
  updateRatingDisplay(8.4);
  updateMetascoreDisplay(76);
  updateRuntimeDisplay(148);
  updateVotesDisplay(650000);
}

// Preset Loader
function loadPreset(presetId) {
  if (!window.APP_PRESETS) return;
  const p = window.APP_PRESETS.find(x => x.id === presetId);
  if (!p) return;

  const d = p.data;
  document.getElementById('input-title').value = d.title;
  document.getElementById('input-year').value = d.year || 2025;
  document.getElementById('input-director').value = d.director;
  document.getElementById('input-actors').value = (d.actors || []).join(', ');

  document.getElementById('input-rating').value = d.rating;
  updateRatingDisplay(d.rating);

  document.getElementById('input-metascore').value = d.metascore;
  updateMetascoreDisplay(d.metascore);

  document.getElementById('input-runtime').value = d.runtime;
  updateRuntimeDisplay(d.runtime);

  document.getElementById('input-votes').value = d.votes;
  updateVotesDisplay(d.votes);

  selectedGenres = new Set(d.genres);
  initGenres();

  handlePredictionSubmit(new Event('submit'));
}

function resetForm() {
  document.getElementById('input-title').value = 'New Film Project';
  document.getElementById('input-director').value = '';
  document.getElementById('input-actors').value = '';
  document.getElementById('input-rating').value = 7.0;
  document.getElementById('input-metascore').value = 60;
  document.getElementById('input-runtime').value = 115;
  document.getElementById('input-votes').value = 150000;
  selectedGenres = new Set(['Drama']);
  initGenres();
  initInitialValues();
  document.getElementById('results-active').classList.add('hidden');
  document.getElementById('results-empty').classList.remove('hidden');
}

﻿// Prediction API Submission & Rendering
async function handlePredictionSubmit(e) {
  if (e) e.preventDefault();

  const title = document.getElementById('input-title').value.trim();
  const year = parseInt(document.getElementById('input-year').value) || 2025;
  const director = document.getElementById('input-director').value.trim();
  const actorsStr = document.getElementById('input-actors').value.trim();
  const actors = actorsStr ? actorsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  const rating = parseFloat(document.getElementById('input-rating').value);
  const metascore = parseFloat(document.getElementById('input-metascore').value);
  const runtime = parseFloat(document.getElementById('input-runtime').value);
  const votes = parseInt(document.getElementById('input-votes').value);

  const payload = {
    title: title || 'Untitled Project',
    genres: Array.from(selectedGenres),
    director: director,
    actors: actors,
    runtime: runtime,
    rating: rating,
    metascore: metascore,
    votes: votes,
    year: year
  };

  const btn = document.getElementById('btn-submit');
  const originalBtnHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-lg"></i> <span>Computing Ensemble Prediction...</span>`;

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (json.status === 'success') {
      lastPrediction = json.data;
      renderPredictionResults(json.data);
    } else {
      alert('Error predicting movie success: ' + (json.detail || 'Unknown error'));
    }
  } catch (err) {
    console.error('Prediction request failed:', err);
    alert('Prediction failed. Please ensure the backend server is running.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalBtnHTML;
  }
}

function renderPredictionResults(data) {
  document.getElementById('results-empty').classList.add('hidden');
  const activePane = document.getElementById('results-active');
  activePane.classList.remove('hidden');

  // Animate Revenue Count-Up
  animateRevenue(data.predicted_revenue);

  // Confidence Interval
  document.getElementById('res-ci-range').textContent = `$${data.confidence_interval.lower}M - $${data.confidence_interval.upper}M`;

  // Tier Badge
  const badgeEl = document.getElementById('res-tier-badge');
  badgeEl.textContent = data.success_tier.toUpperCase();
  badgeEl.className = `px-3.5 py-1 rounded-full text-xs font-black tracking-wider uppercase border shadow-lg ${data.tier_badge}`;

  // Viability Score
  document.getElementById('res-viability-score').textContent = data.success_score;
  const bar = document.getElementById('res-viability-bar');
  bar.style.width = `${data.success_score}%`;

  // Tier text & confidence
  document.getElementById('res-tier-text').textContent = data.success_tier;
  const primaryProb = data.tier_probabilities[data.success_tier] || 75;
  document.getElementById('res-tier-prob').textContent = `Confidence: ${primaryProb}%`;

  // Tier Probabilities Progress Bars
  const probsContainer = document.getElementById('tier-probs-bars');
  probsContainer.innerHTML = '';
  const tierColors = {
    'Blockbuster': 'from-amber-500 to-amber-400 text-amber-300',
    'Hit': 'from-emerald-500 to-emerald-400 text-emerald-300',
    'Moderate': 'from-blue-500 to-blue-400 text-blue-300',
    'Flop / Niche': 'from-rose-500 to-rose-400 text-rose-300'
  };

  Object.entries(data.tier_probabilities).forEach(([tierName, prob]) => {
    const color = tierColors[tierName] || 'from-indigo-500 to-indigo-400 text-indigo-300';
    const row = document.createElement('div');
    row.className = 'space-y-1';
    row.innerHTML = `
      <div class="flex justify-between text-[11px] font-semibold text-slate-300">
        <span>${tierName}</span>
        <span class="font-mono">${prob}%</span>
      </div>
      <div class="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
        <div class="bg-gradient-to-r ${color} h-full rounded-full transition-all duration-700" style="width: ${prob}%"></div>
      </div>
    `;
    probsContainer.appendChild(row);
  });

  // AI Verdict
  document.getElementById('res-verdict-text').textContent = data.verdict;

  // Key Revenue Drivers
  const impactsContainer = document.getElementById('res-impacts-list');
  impactsContainer.innerHTML = '';
  data.feature_impacts.forEach(imp => {
    const isPos = imp.impact === 'positive';
    const isNeg = imp.impact === 'negative';
    const iconClass = isPos ? 'fa-arrow-trend-up text-emerald-400' : (isNeg ? 'fa-arrow-trend-down text-rose-400' : 'fa-minus text-slate-400');
    const borderClass = isPos ? 'border-emerald-500/20 bg-emerald-500/5' : (isNeg ? 'border-rose-500/20 bg-rose-500/5' : 'border-slate-800 bg-slate-900/40');
    
    const card = document.createElement('div');
    card.className = `p-3 rounded-xl border ${borderClass} flex items-start gap-3 transition-all`;
    card.innerHTML = `
      <div class="mt-0.5 w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center text-xs">
        <i class="fa-solid ${iconClass}"></i>
      </div>
      <div class="flex-1">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-200">${imp.factor}</span>
          <span class="text-[10px] font-mono font-bold ${isPos ? 'text-emerald-400' : (isNeg ? 'text-rose-400' : 'text-slate-400')}">${imp.magnitude}</span>
        </div>
        <p class="text-[11px] text-slate-400 mt-0.5">${imp.description}</p>
      </div>
    `;
    impactsContainer.appendChild(card);
  });

  // Historical Comparables Cards
  const compContainer = document.getElementById('res-comparables-list');
  compContainer.innerHTML = '';
  data.comparables.forEach(c => {
    const card = document.createElement('div');
    card.className = 'p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3';
    card.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h4 class="text-xs font-bold text-slate-100 truncate">${c.title}</h4>
          <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">${c.year}</span>
        </div>
        <div class="text-[11px] text-slate-400 truncate mt-0.5">Dir: ${c.director} &bull; ${c.genre}</div>
      </div>
      <div class="text-right flex-shrink-0">
        <div class="text-xs font-bold text-emerald-400 font-mono">$${c.revenue_millions.toFixed(1)}M</div>
        <div class="text-[10px] text-brand-300 font-mono">${c.similarity_pct}% match</div>
      </div>
    `;
    compContainer.appendChild(card);
  });

  // Sync to What-If baseline
  syncWhatIfBase(data);
}

function animateRevenue(targetVal) {
  const el = document.getElementById('res-revenue-val');
  let current = 0;
  const steps = 30;
  const inc = targetVal / steps;
  const timer = setInterval(() => {
    current += inc;
    if (current >= targetVal) {
      current = targetVal;
      clearInterval(timer);
    }
    el.textContent = current.toFixed(2);
  }, 15);
}

// What-If Simulation
function syncWhatIfBase(data) {
  const s = data.input_summary;
  document.getElementById('whatif-rating').value = s.rating;
  document.getElementById('whatif-meta').value = s.metascore;
  document.getElementById('whatif-votes').value = s.votes;
  document.getElementById('whatif-runtime').value = s.runtime;

  document.getElementById('whatif-rating-val').textContent = s.rating.toFixed(1);
  document.getElementById('whatif-meta-val').textContent = s.metascore;
  document.getElementById('whatif-votes-val').textContent = s.votes.toLocaleString();
  document.getElementById('whatif-runtime-val').textContent = `${s.runtime} min`;

  document.getElementById('whatif-base-rev').textContent = `$${data.predicted_revenue.toFixed(2)}M`;
  document.getElementById('whatif-base-tier').textContent = `Tier: ${data.success_tier}`;
}

function runWhatIfLive() {
  if (!lastPrediction) return;

  const simRating = parseFloat(document.getElementById('whatif-rating').value);
  const simMeta = parseFloat(document.getElementById('whatif-meta').value);
  const simVotes = parseInt(document.getElementById('whatif-votes').value);
  const simRuntime = parseFloat(document.getElementById('whatif-runtime').value);

  document.getElementById('whatif-rating-val').textContent = simRating.toFixed(1);
  document.getElementById('whatif-meta-val').textContent = simMeta;
  document.getElementById('whatif-votes-val').textContent = simVotes.toLocaleString();
  document.getElementById('whatif-runtime-val').textContent = `${simRuntime} min`;

  if (whatIfTimeout) clearTimeout(whatIfTimeout);
  whatIfTimeout = setTimeout(async () => {
    const payload = {
      base_input: {
        title: lastPrediction.title,
        genres: lastPrediction.input_summary.genres,
        director: lastPrediction.input_summary.director,
        actors: lastPrediction.input_summary.actors,
        runtime: lastPrediction.input_summary.runtime,
        rating: lastPrediction.input_summary.rating,
        metascore: lastPrediction.input_summary.metascore,
        votes: lastPrediction.input_summary.votes,
        year: lastPrediction.input_summary.year
      },
      variations: {
        rating: simRating,
        metascore: simMeta,
        votes: simVotes,
        runtime: simRuntime
      }
    };

    try {
      const res = await fetch('/api/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.status === 'success') {
        const d = json.data;
        document.getElementById('whatif-sim-rev').textContent = `$${d.simulated_prediction.predicted_revenue.toFixed(2)}M`;
        document.getElementById('whatif-sim-tier').textContent = `Tier: ${d.simulated_prediction.success_tier}`;
        
        const delta = d.delta_revenue;
        const deltaEl = document.getElementById('whatif-delta-rev');
        const badgeEl = document.getElementById('whatif-delta-badge');
        
        if (delta >= 0) {
          deltaEl.textContent = `+$${delta.toFixed(2)}M`;
          deltaEl.className = 'text-3xl font-black font-mono mt-0.5 text-emerald-400';
          badgeEl.textContent = `+${d.percentage_change}%`;
          badgeEl.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono';
        } else {
          deltaEl.textContent = `-$${Math.abs(delta).toFixed(2)}M`;
          deltaEl.className = 'text-3xl font-black font-mono mt-0.5 text-rose-400';
          badgeEl.textContent = `${d.percentage_change}%`;
          badgeEl.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono';
        }

        updateWhatIfSensitivityChart(simRating, d.simulated_prediction.predicted_revenue);
      }
    } catch (e) {
      console.error('What-If simulation failed:', e);
    }
  }, 120);
}

function initWhatIfChart() {
  const ctx = document.getElementById('whatif-chart');
  if (!ctx) return;
  if (charts['whatif']) charts['whatif'].destroy();

  const labels = ['5.0', '6.0', '7.0', '8.0', '9.0', '9.5'];
  const data = [25, 45, 80, 150, 240, 310];

  charts['whatif'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Projected Revenue ($M)',
        data: data,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#818cf8',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

function updateWhatIfSensitivityChart(currentRating, currentRev) {
  if (!charts['whatif']) return;
  const ratings = [5.0, 6.0, 7.0, 8.0, 8.5, 9.0, 9.5];
  const slope = currentRev / Math.max(1, currentRating);
  const projections = ratings.map(r => Math.max(5, (r * slope * (r/currentRating)).toFixed(1)));

  charts['whatif'].data.labels = ratings.map(r => r.toFixed(1));
  charts['whatif'].data.datasets[0].data = projections;
  charts['whatif'].update();
}

// Box Office Analytics Charts
function initAnalyticsCharts() {
  if (!window.APP_METADATA) return;
  const meta = window.APP_METADATA;

  // 1. Genre Chart
  const ctxGenre = document.getElementById('chart-genres');
  if (ctxGenre && !charts['genres']) {
    const topGenres = (meta.genre_stats || []).slice(0, 8);
    charts['genres'] = new Chart(ctxGenre, {
      type: 'bar',
      data: {
        labels: topGenres.map(g => g.genre),
        datasets: [{
          label: 'Avg Revenue ($M)',
          data: topGenres.map(g => g.avg_revenue),
          backgroundColor: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  // 2. Tier Distribution Doughnut
  const ctxTier = document.getElementById('chart-tiers');
  if (ctxTier && !charts['tiers']) {
    const tiers = meta.tier_distribution || { 'Blockbuster': 155, 'Hit': 308, 'Moderate': 247, 'Flop': 290 };
    charts['tiers'] = new Chart(ctxTier, {
      type: 'doughnut',
      data: {
        labels: Object.keys(tiers),
        datasets: [{
          data: Object.values(tiers),
          backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#f43f5e'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }
        }
      }
    });
  }

  // 3. Top Directors Horizontal Bar
  const ctxDir = document.getElementById('chart-directors');
  if (ctxDir && !charts['directors']) {
    const topDirs = (meta.top_directors || []).slice(0, 8);
    charts['directors'] = new Chart(ctxDir, {
      type: 'bar',
      data: {
        labels: topDirs.map(d => d.name),
        datasets: [{
          label: 'Historical Avg Revenue ($M)',
          data: topDirs.map(d => d.avg_revenue),
          backgroundColor: '#06b6d4',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
        }
      }
    });
  }

  // 4. Rating vs Revenue Scatter
  const ctxScatter = document.getElementById('chart-scatter');
  if (ctxScatter && !charts['scatter']) {
    const scatterData = [
      {x: 6.2, y: 45}, {x: 7.1, y: 110}, {x: 8.1, y: 333}, {x: 8.8, y: 450},
      {x: 7.5, y: 220}, {x: 6.5, y: 70}, {x: 8.3, y: 290}, {x: 5.8, y: 18},
      {x: 7.9, y: 350}, {x: 6.9, y: 140}, {x: 8.5, y: 520}, {x: 6.0, y: 35},
      {x: 7.4, y: 160}, {x: 8.2, y: 380}, {x: 6.7, y: 95}, {x: 7.7, y: 240}
    ];
    charts['scatter'] = new Chart(ctxScatter, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Movie Gross vs Rating',
          data: scatterData,
          backgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'IMDb Rating', color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          y: { title: { display: true, text: 'Revenue ($M)', color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }
}

// Model Benchmarks Charts
function initModelCharts() {
  if (!window.APP_METADATA) return;
  const ctxImp = document.getElementById('chart-importances');
  if (ctxImp && !charts['importances']) {
    const imps = (window.APP_METADATA.feature_importances || []).slice(0, 8);
    charts['importances'] = new Chart(ctxImp, {
      type: 'bar',
      data: {
        labels: imps.map(i => i.feature),
        datasets: [{
          label: 'Importance Weight (%)',
          data: imps.map(i => i.importance),
          backgroundColor: '#818cf8',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
        }
      }
    });
  }
}

// Movie Dataset Explorer
function initExplorerGenreOptions() {
  const sel = document.getElementById('explorer-genre');
  if (!sel || !window.APP_METADATA) return;
  window.APP_METADATA.all_genres.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    sel.appendChild(opt);
  });
}

function debounceSearch() {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchExplorerMovies(1);
  }, 300);
}

async function fetchExplorerMovies(page = 1) {
  explorerState.page = page;
  explorerState.query = document.getElementById('explorer-search')?.value.trim() || '';
  explorerState.genre = document.getElementById('explorer-genre')?.value || 'All';
  explorerState.sortBy = document.getElementById('explorer-sort')?.value || 'Revenue (Millions)';

  const params = new URLSearchParams({
    query: explorerState.query,
    genre: explorerState.genre,
    sort_by: explorerState.sortBy,
    sort_order: 'desc',
    page: page,
    per_page: 12
  });

  try {
    const res = await fetch(`/api/movies?${params.toString()}`);
    const json = await res.json();
    if (json.status === 'success') {
      renderExplorerGrid(json.data);
    }
  } catch (err) {
    console.error('Failed to load movies:', err);
  }
}

function renderExplorerGrid(data) {
  const grid = document.getElementById('explorer-grid');
  grid.innerHTML = '';

  data.movies.forEach(m => {
    const tierColor = m.Success_Tier === 'Blockbuster' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : (m.Success_Tier === 'Hit' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : (m.Success_Tier === 'Moderate' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'));

    const card = document.createElement('div');
    card.className = 'glass-card rounded-xl p-4 border border-slate-800 hover:border-slate-700 cursor-pointer flex flex-col justify-between transition-all';
    card.onclick = () => openMovieModal(m);
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">#${m.Rank} &bull; ${m.Year}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${tierColor}">${m.Success_Tier}</span>
        </div>
        <h4 class="text-sm font-bold text-white line-clamp-1">${m.Title}</h4>
        <div class="text-xs text-slate-400 mt-1 line-clamp-1">Dir: ${m.Director}</div>
        <div class="text-[11px] text-slate-500 mt-0.5 line-clamp-1">${m.Genre}</div>
      </div>
      <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
        <div>
          <div class="text-[10px] text-slate-400">Revenue</div>
          <div class="text-xs font-bold text-emerald-400 font-mono">$${parseFloat(m['Revenue (Millions)']).toFixed(1)}M</div>
        </div>
        <div class="text-right">
          <div class="text-[10px] text-slate-400">IMDb / Meta</div>
          <div class="text-xs font-bold text-amber-400 font-mono">${m.Rating} <span class="text-slate-500">/ ${parseInt(m.Metascore)}</span></div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Pagination Info
  const pageInfo = document.getElementById('explorer-page-info');
  pageInfo.textContent = `Showing page ${data.page} of ${data.total_pages} (${data.total} total movies)`;
  document.getElementById('explorer-prev-btn').disabled = data.page <= 1;
  document.getElementById('explorer-next-btn').disabled = data.page >= data.total_pages;
  explorerState.totalPages = data.total_pages;
}

function prevPage() {
  if (explorerState.page > 1) fetchExplorerMovies(explorerState.page - 1);
}
function nextPage() {
  if (explorerState.page < explorerState.totalPages) fetchExplorerMovies(explorerState.page + 1);
}

// Modal View
function openMovieModal(m) {
  const modal = document.getElementById('movie-modal');
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">#${m.Rank} &bull; ${m.Year}</span>
      <span class="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">${m['Runtime (Minutes)']} min</span>
    </div>
    <h2 class="text-2xl font-extrabold text-white">${m.Title}</h2>
    <div class="text-xs text-brand-400 font-semibold mt-1">${m.Genre}</div>
    <p class="text-xs text-slate-300 mt-4 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">${m.Description || 'No description available.'}</p>
    
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
      <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
        <div class="text-[10px] text-slate-400">Revenue</div>
        <div class="text-sm font-bold text-emerald-400 font-mono">$${parseFloat(m['Revenue (Millions)']).toFixed(1)}M</div>
      </div>
      <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
        <div class="text-[10px] text-slate-400">IMDb Rating</div>
        <div class="text-sm font-bold text-amber-400 font-mono">${m.Rating} / 10</div>
      </div>
      <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
        <div class="text-[10px] text-slate-400">Metascore</div>
        <div class="text-sm font-bold text-indigo-400 font-mono">${parseInt(m.Metascore)} / 100</div>
      </div>
      <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
        <div class="text-[10px] text-slate-400">Audience Votes</div>
        <div class="text-sm font-bold text-cyan-400 font-mono">${parseInt(m.Votes).toLocaleString()}</div>
      </div>
    </div>

    <div class="mt-4 text-xs text-slate-400 space-y-1">
      <div><strong>Director:</strong> ${m.Director}</div>
      <div><strong>Cast:</strong> ${m.Actors}</div>
    </div>
  `;
  modal.classList.remove('hidden');
}

function closeMovieModal() {
  document.getElementById('movie-modal').classList.add('hidden');
}

// Autocomplete logic
function initAutocomplete() {
  const dirInput = document.getElementById('input-director');
  const dirBox = document.getElementById('director-suggestions');
  const actorInput = document.getElementById('input-actors');
  const actorBox = document.getElementById('actor-suggestions');

  if (dirInput && dirBox) {
    dirInput.addEventListener('input', async (e) => {
      const q = e.target.value.trim();
      if (q.length < 2) { dirBox.classList.add('hidden'); return; }
      const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.data && json.data.directors.length > 0) {
        dirBox.innerHTML = json.data.directors.map(d => `<div class="px-3 py-2 text-xs text-slate-200 hover:bg-brand-600 hover:text-white cursor-pointer transition-colors" onclick="selectDirector('${d}')">${d}</div>`).join('');
        dirBox.classList.remove('hidden');
      } else {
        dirBox.classList.add('hidden');
      }
    });
  }

  if (actorInput && actorBox) {
    actorInput.addEventListener('input', async (e) => {
      const raw = e.target.value;
      const parts = raw.split(',');
      const q = parts[parts.length - 1].trim();
      if (q.length < 2) { actorBox.classList.add('hidden'); return; }
      const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.data && json.data.actors.length > 0) {
        actorBox.innerHTML = json.data.actors.map(a => `<div class="px-3 py-2 text-xs text-slate-200 hover:bg-brand-600 hover:text-white cursor-pointer transition-colors" onclick="selectActor('${a}')">${a}</div>`).join('');
        actorBox.classList.remove('hidden');
      } else {
        actorBox.classList.add('hidden');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!dirInput.contains(e.target)) dirBox?.classList.add('hidden');
    if (!actorInput.contains(e.target)) actorBox?.classList.add('hidden');
  });
}

function selectDirector(name) {
  document.getElementById('input-director').value = name;
  document.getElementById('director-suggestions').classList.add('hidden');
}

function selectActor(name) {
  const input = document.getElementById('input-actors');
  const parts = input.value.split(',').map(s => s.trim()).filter(Boolean);
  parts.pop();
  parts.push(name);
  input.value = parts.join(', ');
  document.getElementById('actor-suggestions').classList.add('hidden');
}

