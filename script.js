/* ============================================================
   Evrix — Interações & Microinterações
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 1. Navbar: efeito ao rolar ---------- */
  const navbar = document.getElementById("navbar");
  const onScroll = () => {
    if (window.scrollY > 24) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 2. Menu mobile ---------- */
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
    navLinks.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => navLinks.classList.remove("open"));
    });
  }

  /* ---------- 3. Reveal ao rolar (IntersectionObserver) ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("visible"));
  }

  /* ---------- 4. Mockup: gráfico de analytics gerado via JS ---------- */
  const chart = document.getElementById("heroChart");
  if (chart) {
    const bars = 14;
    for (let i = 0; i < bars; i++) {
      const bar = document.createElement("div");
      bar.className = "chart-bar";
      // altura pseudo-aleatória porém estável
      const h = 30 + Math.round(Math.abs(Math.sin(i * 1.3) * 55) + Math.random() * 20);
      bar.style.height = h + "%";
      bar.style.animationDelay = (i * 0.07).toFixed(2) + "s";
      // tooltip simples no hover
      bar.title = "Dia " + (i + 1) + " — " + (h * 12000).toLocaleString("pt-BR") + " views";
      chart.appendChild(bar);
    }
  }

  /* ---------- 5. Contadores animados das métricas ---------- */
  const counters = document.querySelectorAll(".metric-value[data-count]");
  const animateCount = (el) => {
    const target = parseFloat(el.getAttribute("data-count")) || 0;
    const prefix = el.getAttribute("data-prefix") || "";
    const suffix = el.getAttribute("data-suffix") || "";
    const duration = 1800;
    const start = performance.now();
    const format = (n) => {
      if (target >= 1000000) {
        return (n / 1000000).toFixed(1).replace(".", ",") + "M";
      }
      if (target >= 1000) {
        return Math.floor(n).toLocaleString("pt-BR");
      }
      return Math.floor(n).toString();
    };
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = target * eased;
      el.textContent = prefix + format(current) + suffix;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = prefix + format(target) + suffix;
      }
    };
    requestAnimationFrame(tick);
  };

  if ("IntersectionObserver" in window && counters.length) {
    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((el) => countObserver.observe(el));
  } else {
    counters.forEach(animateCount);
  }

  /* ---------- 6. Parallax suave nos elementos marcados ---------- */
  const parallaxEls = document.querySelectorAll(".parallax");
  if (parallaxEls.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            const y = window.scrollY;
            parallaxEls.forEach((el) => {
              const speed = parseFloat(el.getAttribute("data-speed")) || 0.05;
              el.style.transform = "translateY(" + (y * speed).toFixed(1) + "px)";
            });
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true }
    );
  }

  /* ---------- 7. Card de rede: troca de cor de glow ao hover ---------- */
  document.querySelectorAll(".network-card").forEach((card) => {
    const logo = card.querySelector(".network-logo");
    if (!logo) return;
    const color = window.getComputedStyle(logo).color;
    card.addEventListener("mouseenter", () => {
      card.style.boxShadow = "0 26px 50px rgba(0,0,0,0.4), 0 0 30px " + color;
      card.style.borderColor = color;
    });
    card.addEventListener("mouseleave", () => {
      card.style.boxShadow = "";
      card.style.borderColor = "";
    });
  });
})();
