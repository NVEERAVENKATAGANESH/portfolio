// app.js

// ──────────────────────────────────────────────────────────
// Helper: Debounce
// ──────────────────────────────────────────────────────────
const debounce = (fn, ms = 50) => {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
};

// ──────────────────────────────────────────────────────────
// 1) THEME TOGGLER
// ──────────────────────────────────────────────────────────
const initTheme = () => {
  const toggle = document.getElementById("theme-toggle");
  const saved  = localStorage.getItem("theme") || "light";
  document.body.setAttribute("data-theme", saved);
  toggle.checked = saved === "dark";

  toggle.addEventListener("change", () => {
    const theme = toggle.checked ? "dark" : "light";
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  });
};

// ──────────────────────────────────────────────────────────
// 2) TYPED.JS HERO EFFECT
// ──────────────────────────────────────────────────────────
const initTyped = () => {
  if (window.Typed) {
    new Typed("#typed", {
      strings: ["Web Developer", "Data Enthusiast", "Creative Coder", "Event Coordinator"],
      typeSpeed: 20,
      backSpeed: 20,
      backDelay: 2000,
      loop: true
    });
  }
};

// ──────────────────────────────────────────────────────────
// 3) SCROLL PROGRESS BAR
// ──────────────────────────────────────────────────────────
const initScrollBar = () => {
  const bar = document.getElementById("scrollBar");
  window.addEventListener("scroll", debounce(() => {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    bar.style.width = `${(scrollTop / (scrollHeight - clientHeight)) * 100}%`;
  }, 50));
};

// ──────────────────────────────────────────────────────────
// 4) BACK-TO-TOP BUTTON
// ──────────────────────────────────────────────────────────
const initBackToTop = () => {
  const btn = document.getElementById("backToTop");
  window.addEventListener("scroll", debounce(() => {
    btn.style.display = window.scrollY > 300 ? "block" : "none";
  }, 50));
  btn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );
};

// ──────────────────────────────────────────────────────────
// 5) SIDEBAR TOGGLE & CONTENT MARGIN
// ──────────────────────────────────────────────────────────
const initSidebar = () => {
  const sbToggle = document.getElementById("sidebarToggle");
  const sidebar  = document.getElementById("sidebar");
  const main     = document.querySelector("main.content");
  const adjust   = () => {
    main.style.marginLeft = sidebar.classList.contains("translate-on")
      ? `${sidebar.offsetWidth}px`
      : "0";
  };
  sbToggle.addEventListener("click", () => {
    sidebar.classList.toggle("translate-on");
    adjust();
  });
  window.addEventListener("resize", adjust);
};

// ──────────────────────────────────────────────────────────
// 6) CERTIFICATE MODAL (Bootstrap)
// ──────────────────────────────────────────────────────────
const initCertificateModal = () => {
  const certModal = document.getElementById("certificateModal");
  if (!certModal) return;
  certModal.addEventListener("show.bs.modal", ev => {
    const btn = ev.relatedTarget;
    document.getElementById("certificatePreviewImage").src =
      btn.dataset.certificate;
    document.querySelector("#certificateModal .certificate-name").textContent =
      btn.dataset.certificateName;
  });
};

// ──────────────────────────────────────────────────────────
// 7) CHATBOT TOGGLE
// ──────────────────────────────────────────────────────────
const initChatbot = () => {
  const chatBtn = document.getElementById("chatbotBtn");
  const chatMod = document.getElementById("chatbotModal");
  chatBtn.addEventListener("click", () => chatMod.classList.toggle("show"));
};

// ──────────────────────────────────────────────────────────
// 13) SKILLS MODULE: Toggle + Animated Charts
// ──────────────────────────────────────────────────────────

/** Pill toggle: slides the pill & filters .skill-card by data-cat */
const initSkills = () => {
  const toggle = document.querySelector('.skills-toggle');
  if (!toggle) return;

  const buttons = Array.from(toggle.querySelectorAll('.toggle-btn'));
  const cards   = Array.from(document.querySelectorAll('.skill-card'));

  // tell CSS how many pills there are
  toggle.style.setProperty('--count', buttons.length);
  // start on “All”
  toggle.style.setProperty('--pill-index', 0);

  buttons.forEach((btn, idx) => {
    btn.setAttribute('aria-selected', idx === 0);

    btn.addEventListener('click', () => {
      // slide the pill
      toggle.style.setProperty('--pill-index', idx);
      // highlight selected
      buttons.forEach(b => b.setAttribute('aria-selected', 'false'));
      btn.setAttribute('aria-selected', 'true');
      // filter cards
      const cat = btn.dataset.cat;
      cards.forEach(card => {
        const show = cat === 'all' || card.dataset.cat === cat;
        card.classList.toggle('d-none', !show);
      });
    });
  });
};

/** Animate each .skill-chart from 0 → its parent card’s data-value, and update the % text */
const initSkillCharts = () => {
  document.querySelectorAll('.skill-chart').forEach(chart => {
    // find the enclosing card and its data-value
    const card = chart.closest('.skill-card');
    const pct  = card ? parseFloat(card.dataset.value) : 0;

    // reset so CSS transition will fire
    chart.style.setProperty('--pct', 0);

    // slight delay to kick off the transition
    setTimeout(() => {
      chart.style.setProperty('--pct', pct);
      // update the text inside .skill-value
      const valEl = card.querySelector('.skill-value');
      if (valEl) valEl.textContent = pct + '%';
    }, 100);
  });
};



// ──────────────────────────────────────────────────────────
// 9) PROJECT SEARCH & FILTER
// ──────────────────────────────────────────────────────────
const initProjectFilter = () => {
  const searchInput  = document.getElementById("projectSearch");
  const filterSelect = document.getElementById("projectFilter");
  const sortSelect   = document.getElementById("projectSort");
  const container    = document.getElementById("projectGallery");
  const cards        = Array.from(document.querySelectorAll(".project-card"));
  const noMsg        = document.getElementById("noProjectsMsg");

  const applyFilter = () => {
    const term      = searchInput.value.trim().toLowerCase();
    const cat       = filterSelect.value;
    let visibleCount = 0;

    // 1) Show/hide based on search + filter
    cards.forEach(card => {
      const title = card.querySelector(".card-title").textContent.toLowerCase();
      const desc  = card.querySelector(".card-text").textContent.toLowerCase();
      const matchesSearch = !term || title.includes(term) || desc.includes(term);
      const matchesCat    = cat === "all" || card.dataset.category === cat;
      const ok = matchesSearch && matchesCat;

      card.style.display = ok ? "" : "none";
      visibleCount += ok ? 1 : 0;
    });

    // 2) Sort the visible cards
    const visibleCards = cards.filter(c => c.style.display !== "none");
    if (sortSelect.value === "az") {
      visibleCards.sort((a, b) =>
        a.querySelector(".card-title").textContent.localeCompare(
          b.querySelector(".card-title").textContent
        )
      );
    } else if (sortSelect.value === "za") {
      visibleCards.sort((a, b) =>
        b.querySelector(".card-title").textContent.localeCompare(
          a.querySelector(".card-title").textContent
        )
      );
    }

    // Re-append in new order
    visibleCards.forEach(c => container.appendChild(c));

    // 3) Toggle no–results message
    noMsg.style.display = visibleCount ? "none" : "block";
  };

  // Event hooks
  searchInput.addEventListener("input", debounce(applyFilter, 100));
  filterSelect.addEventListener("change", applyFilter);
  sortSelect.addEventListener("change", applyFilter);

  // Initial run
  applyFilter();
};


// ──────────────────────────────────────────────────────────
// 10) SIDEBAR ACTIVE LINK HIGHLIGHT
// ──────────────────────────────────────────────────────────
const initActiveLink = () => {
  const links = document.querySelectorAll(".sidebar-link");
  const highlight = () => {
    const y = window.scrollY;
    links.forEach(a => {
      const sec = document.querySelector(a.getAttribute("href"));
      a.classList.toggle("active-link",
        sec &&
        sec.offsetTop <= y + 100 &&
        sec.offsetTop + sec.offsetHeight > y + 100
      );
    });
  };
  window.addEventListener("scroll", highlight);
  highlight();
};

// ──────────────────────────────────────────────────────────
// 11) TIMELINE TABS & HEIGHT ADJUST + ENTRY ANIMATION
// ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".timeline-toggle");
  const buttons = toggle.querySelectorAll(".toggle-btn");
  const sections = {
    education: document.querySelector(".section-education"),
    experience: document.querySelector(".section-experience")
  };

  function showSection(name) {
    // 1) Update toggle pill position
    toggle.dataset.active = name;
    toggle.style.setProperty(
      "--pill-left",
      name === "education" ? "0%" : "50%"
    );
    // 2) Update aria-selected and styling
    buttons.forEach(btn => {
      const isActive = btn.dataset.section === name;
      btn.setAttribute("aria-selected", isActive);
    });
    // 3) Show/hide sections & animate items
    Object.entries(sections).forEach(([key, el]) => {
      el.classList.toggle("d-none", key !== name);
      if (key === name) {
        el.querySelectorAll(".timeline-item").forEach((item, i) => {
          item.classList.remove("visible");
          setTimeout(() => item.classList.add("visible"), i * 150);
        });
      }
    });
  }

  // Hook up clicks
  buttons.forEach(btn =>
    btn.addEventListener("click", () => showSection(btn.dataset.section))
  );

  // Init
  showSection(toggle.dataset.active);
});




// ──────────────────────────────────────────────────────────
// 12) PWA SERVICE WORKER
// ──────────────────────────────────────────────────────────
const initServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () =>
      navigator.serviceWorker
               .register("/service-worker.js")
               .catch(err => console.log("SW registration failed:", err))
    );
  }
};

// ──────────────────────────────────────────────────────────
// Initialize everything on DOM ready
// ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTyped();
  initScrollBar();
  initBackToTop();
  initSidebar();
  initCertificateModal();
  initChatbot();
  initSkills();
  initSkillCharts();
  initProjectFilter();
  initActiveLink();
  initTimeline();
  initServiceWorker();
});

