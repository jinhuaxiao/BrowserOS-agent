

// ========== Theme Toggle ==========
(function initTheme() {
  const toggle = document.querySelector("[data-theme-toggle]");
  const root = document.documentElement;
  let theme = matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  root.setAttribute("data-theme", theme);

  if (toggle) {
    updateToggleIcon(toggle, theme);
    toggle.addEventListener("click", function () {
      theme = theme === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", theme);
      updateToggleIcon(toggle, theme);
      // Re-render charts with new theme colors
      if (currentView === "detail" && currentCompany) {
        renderDetailView(currentCompany);
      } else if (currentView === "compare" && activeComparison) {
        renderComparisonChart(activeComparison);
      }
    });
  }

  function updateToggleIcon(btn, t) {
    btn.setAttribute(
      "aria-label",
      "Switch to " + (t === "dark" ? "light" : "dark") + " mode"
    );
    btn.innerHTML =
      t === "dark"
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
})();

// ========== State ==========
let companiesData = [];
let currentView = "overview"; // 'overview' | 'detail' | 'compare'
let currentCompany = null;
let activeComparison = null;
let activeSector = "all";
let chartInstances = [];

const countryFlags = {
  US: "\u{1F1FA}\u{1F1F8}",
  TW: "\u{1F1F9}\u{1F1FC}",
  SA: "\u{1F1F8}\u{1F1E6}",
  KR: "\u{1F1F0}\u{1F1F7}",
  CN: "\u{1F1E8}\u{1F1F3}",
  NL: "\u{1F1F3}\u{1F1F1}",
  CH: "\u{1F1E8}\u{1F1ED}",
  GB: "\u{1F1EC}\u{1F1E7}",
  FR: "\u{1F1EB}\u{1F1F7}",
  JP: "\u{1F1EF}\u{1F1F5}",
};

const sectorColors = {
  Technology: "var(--color-accent-blue)",
  Semiconductors: "var(--color-accent-purple)",
  Finance: "var(--color-accent-teal)",
  Healthcare: "var(--color-accent-rose)",
  Energy: "var(--color-accent-orange)",
  Retail: "var(--color-accent-amber)",
  "Automotive/Energy": "var(--color-accent-orange)",
  Automotive: "var(--color-accent-orange)",
  Conglomerate: "var(--color-text-muted)",
  "Consumer Goods": "var(--color-accent-amber)",
  Luxury: "var(--color-accent-purple)",
  "Industrials/Defense": "var(--color-text-muted)",
  Industrials: "var(--color-text-muted)",
  Entertainment: "var(--color-accent-rose)",
};

// ========== Load Data ==========
async function loadData() {
  try {
    const res = await fetch("./data.json");
    companiesData = await res.json();
    init();
  } catch (err) {
    document.getElementById("companiesGrid").innerHTML =
      '<p style="color:var(--color-error);">Failed to load data.</p>';
  }
}

function init() {
  renderOverview();
  setupSearch();
  setupFilters();
  setupNavigation();
}

// ========== Navigation ==========
function setupNavigation() {
  document.getElementById("backBtn").addEventListener("click", function () {
    showView("overview");
  });
  document.getElementById("logoBtn").addEventListener("click", function () {
    showView("overview");
  });
  document.getElementById("compareBtn").addEventListener("click", function () {
    if (currentView === "compare") {
      showView("overview");
    } else {
      showView("compare");
      renderCompareView();
    }
  });
}

function showView(view) {
  destroyCharts();
  currentView = view;

  document.querySelectorAll(".view").forEach(function (v) {
    v.classList.remove("active");
  });
  document.getElementById(view + "View").classList.add("active");

  const backBtn = document.getElementById("backBtn");
  const compareBtn = document.getElementById("compareBtn");

  backBtn.style.display = view === "overview" ? "none" : "flex";
  compareBtn.classList.toggle("active", view === "compare");
}

// ========== Search ==========
function setupSearch() {
  const input = document.getElementById("searchInput");
  const results = document.getElementById("searchResults");

  input.addEventListener("input", function () {
    const q = input.value.toLowerCase().trim();
    if (q.length < 1) {
      results.classList.remove("active");
      return;
    }

    const matches = companiesData.filter(function (c) {
      return (
        c.company.toLowerCase().includes(q) ||
        (c.ticker && c.ticker.toLowerCase().includes(q)) ||
        (c.sector && c.sector.toLowerCase().includes(q))
      );
    });

    if (matches.length === 0) {
      results.classList.remove("active");
      return;
    }

    results.innerHTML = matches
      .slice(0, 8)
      .map(function (c) {
        return (
          '<div class="search-result-item" data-company="' +
          c.company +
          '">' +
          '<span class="search-result-rank">#' +
          c.rank +
          "</span>" +
          '<span class="search-result-name">' +
          c.company +
          "</span>" +
          '<span class="search-result-ticker">' +
          (c.ticker || "") +
          "</span>" +
          "</div>"
        );
      })
      .join("");

    results.classList.add("active");

    results.querySelectorAll(".search-result-item").forEach(function (item) {
      item.addEventListener("click", function () {
        var name = item.getAttribute("data-company");
        var company = companiesData.find(function (c) {
          return c.company === name;
        });
        if (company) {
          currentCompany = company;
          showView("detail");
          renderDetailView(company);
        }
        results.classList.remove("active");
        input.value = "";
      });
    });
  });

  document.addEventListener("click", function (e) {
    if (!document.getElementById("searchWrapper").contains(e.target)) {
      results.classList.remove("active");
    }
  });
}

// ========== Filters ==========
function setupFilters() {
  document.querySelectorAll(".filter-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      document.querySelectorAll(".filter-chip").forEach(function (c) {
        c.classList.remove("active");
      });
      chip.classList.add("active");
      activeSector = chip.getAttribute("data-sector");
      renderOverview();
    });
  });
}

// ========== Overview Rendering ==========
function renderOverview() {
  var grid = document.getElementById("companiesGrid");
  var filtered = companiesData;

  var mainSectors = [
    "Technology",
    "Semiconductors",
    "Finance",
    "Healthcare",
    "Energy",
    "Retail",
  ];

  if (activeSector !== "all") {
    if (activeSector === "other") {
      filtered = companiesData.filter(function (c) {
        return !mainSectors.includes(c.sector);
      });
    } else {
      filtered = companiesData.filter(function (c) {
        return c.sector === activeSector;
      });
    }
  }

  grid.innerHTML = filtered
    .map(function (c) {
      var metricsPreview = c.metrics
        .slice(0, 3)
        .map(function (m) {
          var latest =
            m.data.length > 0 ? m.data[m.data.length - 1].value : null;
          var formatted = latest !== null ? formatValue(latest, m.unit) : "N/A";
          return (
            '<div class="card-metric-row">' +
            '<span class="card-metric-name" title="' +
            escapeHtml(m.name) +
            '">' +
            truncate(m.name, 30) +
            "</span>" +
            '<span class="card-metric-value">' +
            formatted +
            "</span>" +
            "</div>"
          );
        })
        .join("");

      var extraCount =
        c.metrics.length > 3 ? c.metrics.length - 3 + " more metrics" : "";

      return (
        '<div class="company-card" data-company="' +
        c.company +
        '">' +
        '<div class="card-top">' +
        '<span class="card-rank">#' +
        c.rank +
        "</span>" +
        '<span class="card-sector">' +
        (c.sector || "") +
        "</span>" +
        "</div>" +
        '<div class="card-company">' +
        (countryFlags[c.country] || "") +
        " " +
        c.company +
        "</div>" +
        '<div class="card-ticker">' +
        (c.ticker || "") +
        "</div>" +
        '<div class="card-mcap">' +
        '<span class="card-mcap-value">' +
        (c.marketCap || "") +
        "</span>" +
        '<span class="card-mcap-label">Market Cap</span>' +
        "</div>" +
        '<div class="card-metrics">' +
        metricsPreview +
        (extraCount
          ? '<div class="card-metric-count">' + extraCount + "</div>"
          : "") +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  grid.querySelectorAll(".company-card").forEach(function (card) {
    card.addEventListener("click", function () {
      var name = card.getAttribute("data-company");
      var company = companiesData.find(function (c) {
        return c.company === name;
      });
      if (company) {
        currentCompany = company;
        showView("detail");
        renderDetailView(company);
      }
    });
  });
}

// ========== Detail View ==========
function renderDetailView(company) {
  destroyCharts();
  var header = document.getElementById("detailHeader");
  var grid = document.getElementById("chartsGrid");

  header.innerHTML =
    '<div class="detail-company-info">' +
    "<h1>" +
    (countryFlags[company.country] || "") +
    " " +
    company.company +
    "</h1>" +
    '<div class="detail-meta">' +
    metaItem("Ticker", company.ticker || "N/A") +
    metaItem("Market Cap", company.marketCap || "N/A") +
    metaItem("Sector", company.sector || "N/A") +
    metaItem("Rank", "#" + company.rank) +
    "</div>" +
    "</div>";

  if (company.metrics.length === 0) {
    grid.innerHTML =
      '<div class="compare-empty"><p>No charted metrics available for this company.</p></div>';
    return;
  }

  grid.innerHTML = company.metrics
    .map(function (m, i) {
      var growth = calcGrowth(m.data);
      var growthClass = growth >= 0 ? "positive" : "negative";
      var growthStr =
        growth !== null
          ? (growth >= 0 ? "+" : "") + growth.toFixed(1) + "% total"
          : "";

      return (
        '<div class="chart-card">' +
        '<div class="chart-title">' +
        escapeHtml(m.name) +
        "</div>" +
        '<div class="chart-unit">' +
        escapeHtml(m.unit) +
        "</div>" +
        '<div class="chart-container"><canvas id="chart-' +
        i +
        '"></canvas></div>' +
        '<div class="chart-footer">' +
        '<span class="chart-growth ' +
        growthClass +
        '">' +
        growthStr +
        "</span>" +
        '<button class="chart-compare-btn" data-metric="' +
        escapeHtml(m.name) +
        '">Compare across companies</button>' +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  // Render charts
  var style = getComputedStyle(document.documentElement);
  company.metrics.forEach(function (m, i) {
    var canvas = document.getElementById("chart-" + i);
    if (!canvas || m.data.length === 0) return;

    var labels = m.data.map(function (d) {
      return d.year;
    });
    var values = m.data.map(function (d) {
      return d.value;
    });

    var chartColor = style.getPropertyValue("--chart-1").trim();
    var textColor = style.getPropertyValue("--color-text").trim();
    var mutedColor = style.getPropertyValue("--color-text-muted").trim();
    var dividerColor = style.getPropertyValue("--color-divider").trim();

    var chart = new Chart(canvas, {
      type: values.length <= 3 ? "bar" : "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: m.name,
            data: values,
            borderColor: chartColor,
            backgroundColor:
              values.length <= 3 ? chartColor + "cc" : chartColor + "18",
            borderWidth: 2.5,
            fill: values.length > 3,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: chartColor,
            pointBorderColor:
              style.getPropertyValue("--color-surface").trim(),
            pointBorderWidth: 2,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor:
              style.getPropertyValue("--color-surface").trim(),
            titleColor: textColor,
            bodyColor: textColor,
            borderColor: dividerColor,
            borderWidth: 1,
            padding: 12,
            titleFont: { family: "Inter", weight: "600" },
            bodyFont: { family: "JetBrains Mono" },
            callbacks: {
              label: function (ctx) {
                return formatValue(ctx.parsed.y, m.unit);
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: mutedColor, font: { family: "JetBrains Mono", size: 11 } },
            border: { color: dividerColor },
          },
          y: {
            grid: { color: dividerColor + "60" },
            ticks: {
              color: mutedColor,
              font: { family: "JetBrains Mono", size: 11 },
              callback: function (v) {
                return formatCompact(v);
              },
            },
            border: { display: false },
            beginAtZero: shouldBeginAtZero(values),
          },
        },
        animation: { duration: 700, easing: "easeOutQuart" },
      },
    });
    chartInstances.push(chart);
  });

  // Compare buttons
  grid.querySelectorAll(".chart-compare-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var metricName = btn.getAttribute("data-metric");
      showView("compare");
      renderCompareView();
      selectComparison(metricName);
    });
  });
}

function metaItem(label, value) {
  return (
    '<div class="detail-meta-item">' +
    '<span class="detail-meta-label">' +
    label +
    "</span>" +
    '<span class="detail-meta-value">' +
    value +
    "</span>" +
    "</div>"
  );
}

// ========== Compare View ==========
function renderCompareView() {
  var sidebar = document.getElementById("compareSidebar");

  // Find comparable metrics (same metric name across multiple companies)
  var metricMap = {};
  companiesData.forEach(function (c) {
    c.metrics.forEach(function (m) {
      var normalized = normalizeMetricName(m.name);
      if (!metricMap[normalized]) {
        metricMap[normalized] = { name: m.name, unit: m.unit, companies: [] };
      }
      metricMap[normalized].companies.push({
        company: c.company,
        ticker: c.ticker,
        data: m.data,
      });
    });
  });

  // Also create comparison groups for related metrics
  var compareGroups = buildCompareGroups(metricMap);

  sidebar.innerHTML = compareGroups
    .map(function (g) {
      return (
        '<button class="compare-category" data-group="' +
        escapeHtml(g.id) +
        '">' +
        escapeHtml(g.label) +
        '<span class="compare-category-count">' +
        g.count +
        " cos</span>" +
        "</button>"
      );
    })
    .join("");

  sidebar.querySelectorAll(".compare-category").forEach(function (btn) {
    btn.addEventListener("click", function () {
      sidebar.querySelectorAll(".compare-category").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      var groupId = btn.getAttribute("data-group");
      var group = compareGroups.find(function (g) {
        return g.id === groupId;
      });
      if (group) {
        activeComparison = group;
        renderComparisonChart(group);
      }
    });
  });

  // If we have a pre-selected metric, select it
  if (activeComparison) {
    var target = sidebar.querySelector(
      '[data-group="' + activeComparison.id + '"]'
    );
    if (target) {
      target.click();
    }
  }
}

function selectComparison(metricName) {
  var sidebar = document.getElementById("compareSidebar");
  var normalized = normalizeMetricName(metricName);

  // Try exact match first
  var btn = Array.from(sidebar.querySelectorAll(".compare-category")).find(
    function (b) {
      return (
        normalizeMetricName(b.getAttribute("data-group")).indexOf(
          normalized.substring(0, 15)
        ) >= 0
      );
    }
  );

  if (btn) {
    btn.click();
  }
}

function buildCompareGroups(metricMap) {
  var groups = [];
  // Define comparison categories with keyword matching
  var categories = [
    {
      id: "daily_users_dau",
      label: "Daily Active Users",
      keywords: ["daily active", "dau"],
    },
    {
      id: "monthly_users_mau",
      label: "Monthly Active Users",
      keywords: ["monthly active", "mau", "wechat"],
    },
    {
      id: "subscribers",
      label: "Subscribers / Members",
      keywords: [
        "subscriber",
        "members",
        "membership",
        "paid household",
        "game pass",
        "prime member",
      ],
    },
    {
      id: "data_center_regions",
      label: "Data Center Regions/Zones",
      keywords: ["data center", "availability zone", "cloud region", "oci region"],
    },
    {
      id: "revenue_datacenter",
      label: "Data Center / Cloud Revenue",
      keywords: ["data center revenue", "cloud revenue", "aws", "azure"],
    },
    {
      id: "ai_revenue",
      label: "AI Revenue",
      keywords: ["ai revenue", "ai semiconductor", "ai chip", "ai accelerator"],
    },
    {
      id: "market_share_memory",
      label: "Memory Market Share (DRAM/NAND)",
      keywords: ["dram market share", "nand market share", "memory market share"],
    },
    {
      id: "oil_production",
      label: "Oil & Gas Production",
      keywords: [
        "production",
        "daily oil",
        "crude oil",
        "barrels",
        "mmboe",
        "permian",
      ],
    },
    {
      id: "ev_deliveries",
      label: "Vehicle Deliveries",
      keywords: [
        "deliveries",
        "vehicles sold",
        "shipments",
        "units sold",
        "smartphone ship",
      ],
    },
    {
      id: "energy_storage",
      label: "Energy Storage / Renewable",
      keywords: [
        "energy storage",
        "gwh",
        "supercharger",
        "renewable",
        "carbon capture",
      ],
    },
    {
      id: "rd_spending",
      label: "R&D Spending",
      keywords: ["r&d", "research and development"],
    },
    {
      id: "drug_revenue",
      label: "Key Drug / Product Revenue",
      keywords: [
        "keytruda",
        "humira",
        "skyrizi",
        "oncology",
        "pharmaceutical",
      ],
    },
    {
      id: "transactions",
      label: "Payment Transactions Processed",
      keywords: [
        "transactions processed",
        "payment volume",
        "gross dollar volume",
        "switched transaction",
      ],
    },
    {
      id: "stores_branches",
      label: "Stores / Branches / Warehouses",
      keywords: [
        "store count",
        "warehouse",
        "branch",
        "fulfillment center",
      ],
    },
    {
      id: "backlog",
      label: "Order Backlog",
      keywords: ["backlog", "order book"],
    },
    {
      id: "total_assets",
      label: "Total Assets (Banks)",
      keywords: ["total asset"],
    },
    {
      id: "digital_users",
      label: "Digital / Online Users",
      keywords: [
        "digital active",
        "digital user",
        "online",
        "github",
        "linkedin",
        "developer",
      ],
    },
    {
      id: "installed_base",
      label: "Installed Base / Active Devices",
      keywords: ["installed base", "active device", "alexa", "connected machine"],
    },
    {
      id: "capex",
      label: "Capital Expenditure",
      keywords: ["capex", "capital expenditure"],
    },
    {
      id: "euv_systems",
      label: "EUV / Semiconductor Equipment",
      keywords: ["euv", "wafer", "advanced node", "foundry"],
    },
  ];

  categories.forEach(function (cat) {
    var matchedCompanies = [];
    var seenCompanies = {};

    companiesData.forEach(function (c) {
      c.metrics.forEach(function (m) {
        var mLower = m.name.toLowerCase();
        var isMatch = cat.keywords.some(function (kw) {
          return mLower.includes(kw);
        });
        if (isMatch && !seenCompanies[c.company] && m.data.length >= 2) {
          seenCompanies[c.company] = true;
          matchedCompanies.push({
            company: c.company,
            ticker: c.ticker,
            metricName: m.name,
            unit: m.unit,
            data: m.data,
          });
        }
      });
    });

    if (matchedCompanies.length >= 2) {
      groups.push({
        id: cat.id,
        label: cat.label,
        count: matchedCompanies.length,
        companies: matchedCompanies,
      });
    }
  });

  // Sort by count descending
  groups.sort(function (a, b) {
    return b.count - a.count;
  });

  return groups;
}

function renderComparisonChart(group) {
  destroyCharts();
  var main = document.getElementById("compareMain");

  main.innerHTML =
    '<div class="compare-chart-title">' +
    escapeHtml(group.label) +
    "</div>" +
    '<div class="compare-chart-subtitle">' +
    group.count +
    " companies compared</div>" +
    '<div class="compare-chart-wrapper"><canvas id="compareChart"></canvas></div>';

  var canvas = document.getElementById("compareChart");
  var style = getComputedStyle(document.documentElement);
  var textColor = style.getPropertyValue("--color-text").trim();
  var mutedColor = style.getPropertyValue("--color-text-muted").trim();
  var dividerColor = style.getPropertyValue("--color-divider").trim();

  var chartColors = [
    style.getPropertyValue("--chart-1").trim(),
    style.getPropertyValue("--chart-2").trim(),
    style.getPropertyValue("--chart-3").trim(),
    style.getPropertyValue("--chart-4").trim(),
    style.getPropertyValue("--chart-5").trim(),
    style.getPropertyValue("--chart-6").trim(),
    style.getPropertyValue("--chart-7").trim(),
    style.getPropertyValue("--chart-8").trim(),
  ];

  // Collect all years
  var allYears = {};
  group.companies.forEach(function (c) {
    c.data.forEach(function (d) {
      allYears[d.year] = true;
    });
  });
  var years = Object.keys(allYears)
    .map(Number)
    .sort(function (a, b) {
      return a - b;
    });

  var datasets = group.companies.map(function (c, i) {
    var color = chartColors[i % chartColors.length];
    var dataMap = {};
    c.data.forEach(function (d) {
      dataMap[d.year] = d.value;
    });

    return {
      label: c.company + (c.ticker ? " (" + c.ticker + ")" : ""),
      data: years.map(function (y) {
        return dataMap[y] !== undefined ? dataMap[y] : null;
      }),
      borderColor: color,
      backgroundColor: color + "20",
      borderWidth: 2.5,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: color,
      pointBorderColor: style.getPropertyValue("--color-surface").trim(),
      pointBorderWidth: 2,
      spanGaps: true,
    };
  });

  var unit = group.companies[0] ? group.companies[0].unit : "";

  var chart = new Chart(canvas, {
    type: "line",
    data: { labels: years, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: textColor,
            padding: 16,
            usePointStyle: true,
            pointStyle: "circle",
            font: { family: "Inter", size: 12 },
          },
        },
        tooltip: {
          backgroundColor:
            style.getPropertyValue("--color-surface").trim(),
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: dividerColor,
          borderWidth: 1,
          padding: 12,
          titleFont: { family: "Inter", weight: "600" },
          bodyFont: { family: "JetBrains Mono", size: 12 },
          callbacks: {
            label: function (ctx) {
              if (ctx.parsed.y === null) return null;
              return (
                " " + ctx.dataset.label + ": " + formatValue(ctx.parsed.y, unit)
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: mutedColor, font: { family: "JetBrains Mono", size: 11 } },
          border: { color: dividerColor },
        },
        y: {
          grid: { color: dividerColor + "60" },
          ticks: {
            color: mutedColor,
            font: { family: "JetBrains Mono", size: 11 },
            callback: function (v) {
              return formatCompact(v);
            },
          },
          border: { display: false },
        },
      },
      animation: { duration: 800, easing: "easeOutQuart" },
    },
  });
  chartInstances.push(chart);
}

// ========== Utility Functions ==========
function destroyCharts() {
  chartInstances.forEach(function (c) {
    c.destroy();
  });
  chartInstances = [];
}

function formatValue(val, unit) {
  if (val === null || val === undefined) return "N/A";
  var u = (unit || "").toLowerCase();

  if (u.includes("%") || u.includes("percent") || u.includes("share") || u.includes("rate") || u.includes("growth")) {
    return val.toFixed(1) + "%";
  }
  if (u.includes("trillion")) {
    return "$" + val.toFixed(2) + "T";
  }
  if (u.includes("billion") || u.includes("usd b") || u.includes("$ b")) {
    if (val >= 1000) return "$" + (val / 1000).toFixed(2) + "T";
    return "$" + val.toFixed(1) + "B";
  }
  if (u.includes("million") || u.includes("usd m")) {
    if (val >= 1000) return "$" + (val / 1000).toFixed(1) + "B";
    return "$" + val.toFixed(0) + "M";
  }

  // Large numbers
  if (val >= 1000000) return (val / 1000000).toFixed(1) + "M";
  if (val >= 1000) return (val / 1000).toFixed(1) + "K";
  if (val >= 100) return val.toFixed(0);
  if (val >= 10) return val.toFixed(1);
  return val.toFixed(2);
}

function formatCompact(val) {
  if (val >= 1000000000) return (val / 1000000000).toFixed(1) + "B";
  if (val >= 1000000) {
    var mVal = val / 1000000;
    return (mVal >= 10 ? mVal.toFixed(0) : mVal.toFixed(1)) + "M";
  }
  if (val >= 1000) {
    var kVal = val / 1000;
    return (kVal >= 10 ? kVal.toFixed(0) : kVal.toFixed(1)) + "K";
  }
  if (val >= 100) return val.toFixed(0);
  if (val >= 1) return val.toFixed(1);
  return val.toFixed(2);
}

function calcGrowth(data) {
  if (!data || data.length < 2) return null;
  var first = data[0].value;
  var last = data[data.length - 1].value;
  if (first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

function shouldBeginAtZero(values) {
  var min = Math.min.apply(null, values);
  var max = Math.max.apply(null, values);
  if (max === 0) return true;
  return min / max > 0.3;
}

function normalizeMetricName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str || ""));
  return div.innerHTML;
}

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.substring(0, len) + "\u2026" : str;
}

// ========== Start ==========
loadData();
