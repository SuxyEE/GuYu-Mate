const SITE_CONFIG = {
  github: "https://github.com/SuxyEE/GuYu-Mate",
  version: "1.1.0",
};

const CHANGELOG = [
  {
    version: "1.1.0",
    date: "2026-03-03",
    changes: [
      "修复 507 处中文翻译截断问题",
      "新增 Skills 推荐弹窗，支持多选一键安装开发者技能",
      "Claude Code 插件联动默认开启",
      "官网下载链接跳转至 GitHub Releases",
      "新增 obra/superpowers、VoltAgent 等默认 Skill 仓库",
      "macOS Node.js 安装支持 ARM64 架构与原生密码弹窗",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-01",
    changes: [
      "新增 GuYu Mate 官网与下载中心",
      "优化一键安装体验，自动检测 Node.js",
      "完善供应商与 MCP 管理流程",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-01-18",
    changes: [
      "新增 Skills 管理面板与仓库扫描",
      "支持自定义 API 端点与快速切换",
      "修复 macOS 启动配置异常",
    ],
  },
  {
    version: "0.8.0",
    date: "2025-12-30",
    changes: [
      "发布 MCP 服务器统一管理",
      "优化配置回写机制与备份策略",
      "性能与稳定性提升",
    ],
  },
];

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

const navLinks = document.getElementById("navLinks");
const navToggle = document.getElementById("navToggle");
const navbar = document.getElementById("navbar");

const canvas = document.getElementById("bgCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

const state = {
  particles: [],
  orbs: [],
  width: 0,
  height: 0,
  dpr: window.devicePixelRatio || 1,
  animationId: null,
};

const lerp = (start, end, amount) => start + (end - start) * amount;

const mixColor = (amount) => {
  const accent = { r: 34, g: 197, b: 94 };
  const white = { r: 241, g: 245, b: 249 };
  return {
    r: Math.round(lerp(white.r, accent.r, amount)),
    g: Math.round(lerp(white.g, accent.g, amount)),
    b: Math.round(lerp(white.b, accent.b, amount)),
  };
};

const resizeCanvas = () => {
  if (!canvas || !ctx) return;
  state.dpr = window.devicePixelRatio || 1;
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = state.width * state.dpr;
  canvas.height = state.height * state.dpr;
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
};

const createParticle = () => {
  const colorMix = Math.random() * 0.6 + 0.2;
  const rgb = mixColor(colorMix);
  return {
    x: Math.random() * state.width,
    y: Math.random() * state.height,
    radius: Math.random() * 4 + 2,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    opacity: Math.random() * 0.3 + 0.1,
    rgb,
  };
};

const createOrb = () => {
  const colorMix = Math.random() * 0.4 + 0.4;
  const rgb = mixColor(colorMix);
  return {
    x: Math.random() * state.width,
    y: Math.random() * state.height,
    radius: Math.random() * 60 + 60,
    vx: (Math.random() - 0.5) * 0.05,
    vy: (Math.random() - 0.5) * 0.05,
    opacity: Math.random() * 0.03 + 0.03,
    rgb,
  };
};

const initParticles = () => {
  state.particles = Array.from({ length: 36 }, createParticle);
  state.orbs = Array.from({ length: 4 }, createOrb);
};

const wrap = (item) => {
  if (item.x < -item.radius) item.x = state.width + item.radius;
  if (item.x > state.width + item.radius) item.x = -item.radius;
  if (item.y < -item.radius) item.y = state.height + item.radius;
  if (item.y > state.height + item.radius) item.y = -item.radius;
};

const drawGlow = (item) => {
  if (!ctx) return;
  const gradient = ctx.createRadialGradient(
    item.x,
    item.y,
    0,
    item.x,
    item.y,
    item.radius,
  );
  gradient.addColorStop(0, `rgba(255, 255, 255, ${item.opacity})`);
  gradient.addColorStop(
    0.4,
    `rgba(${item.rgb.r}, ${item.rgb.g}, ${item.rgb.b}, ${item.opacity})`,
  );
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
  ctx.fill();
};

const renderBackground = (animate) => {
  if (!ctx) return;
  ctx.clearRect(0, 0, state.width, state.height);

  state.orbs.forEach((orb) => {
    drawGlow(orb);
    if (animate) {
      orb.x += orb.vx;
      orb.y += orb.vy;
      wrap(orb);
    }
  });

  state.particles.forEach((particle) => {
    drawGlow(particle);
    if (animate) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      wrap(particle);
    }
  });
};

const animateBackground = () => {
  renderBackground(true);
  state.animationId = requestAnimationFrame(animateBackground);
};

const setupBackground = () => {
  if (!canvas || !ctx) return;
  resizeCanvas();
  initParticles();
  if (prefersReducedMotion.matches) {
    renderBackground(false);
    return;
  }
  cancelAnimationFrame(state.animationId);
  animateBackground();
};

const setNavState = () => {
  if (!navbar) return;
  if (window.scrollY > 50) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
};

const setupReveal = () => {
  const items = document.querySelectorAll("[data-reveal]");
  if (!items.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );

  items.forEach((item) => observer.observe(item));
};

const setupActiveLinks = () => {
  const sections = document.querySelectorAll("section[id]");
  const links = document.querySelectorAll(".nav-link");
  if (!sections.length || !links.length) return;

  const linkMap = new Map();
  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (href.startsWith("#")) {
      linkMap.set(href.slice(1), link);
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((link) => link.classList.remove("active"));
          const activeLink = linkMap.get(entry.target.id);
          if (activeLink) activeLink.classList.add("active");
        }
      });
    },
    { rootMargin: "-40% 0px -40% 0px", threshold: 0.1 },
  );

  sections.forEach((section) => observer.observe(section));
};

const renderChangelog = () => {
  const container = document.getElementById("changelogList");
  if (!container) return;
  container.innerHTML = "";

  CHANGELOG.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "cl-item";

    const version = document.createElement("div");
    version.className = "cl-ver";
    version.textContent = `v${entry.version}`;

    const date = document.createElement("div");
    date.className = "cl-date";
    date.textContent = entry.date;

    const body = document.createElement("div");
    body.className = "cl-body";
    const list = document.createElement("ul");

    entry.changes.forEach((change) => {
      const li = document.createElement("li");
      li.textContent = change;
      list.appendChild(li);
    });

    body.appendChild(list);
    item.appendChild(version);
    item.appendChild(date);
    item.appendChild(body);
    container.appendChild(item);
  });
};

const joinUrl = (...parts) => {
  return parts
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0) return part.replace(/\/$/, "");
      return part.replace(/^\//, "").replace(/\/$/, "");
    })
    .join("/");
};

const setDownloadLinks = () => {
  const releasesUrl = `${SITE_CONFIG.github}/releases`;
  const latestUrl = `${releasesUrl}/latest`;
  const byId = (id) => document.getElementById(id);

  // 所有平台下载按钮都跳转到 GitHub Releases 最新版页面
  const dlButtons = ["dlMsi", "dlZip", "dlMac", "dlDeb", "dlAppImg"];
  dlButtons.forEach((id) => {
    const el = byId(id);
    if (el) {
      el.href = latestUrl;
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
  });

  // 导航栏 GitHub 链接
  const ghLink = byId("navGithub");
  if (ghLink) ghLink.href = SITE_CONFIG.github;
};

const setVersionText = () => {
  const heroVersion = document.getElementById("heroVersion");
  const latestVersion = document.getElementById("latestVersion");
  if (heroVersion) {
    heroVersion.textContent = `v${SITE_CONFIG.version} · Windows / macOS / Linux`;
  }
  if (latestVersion) {
    latestVersion.textContent = `最新版本 v${SITE_CONFIG.version}`;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setNavState();
  renderChangelog();
  setDownloadLinks();
  setVersionText();
  setupReveal();
  setupActiveLinks();
  setupBackground();
});

window.addEventListener("scroll", setNavState);
window.addEventListener("resize", () => {
  resizeCanvas();
  if (prefersReducedMotion.matches) {
    renderBackground(false);
  }
});

prefersReducedMotion.addEventListener("change", setupBackground);

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
}
