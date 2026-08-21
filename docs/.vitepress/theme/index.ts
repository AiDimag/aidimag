import DefaultTheme from "vitepress/theme";
import Layout from "./Layout.vue";
import "./custom.css";
import { onMounted } from "vue";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default {
  extends: DefaultTheme,
  Layout,
  setup() {
    onMounted(() => {
      const consent = localStorage.getItem("aidimag-cookie-consent");
      if (!consent) {
        showCookieBanner();
      } else if (consent === "accepted") {
        enableAnalytics();
      }
      setupDiagramLightbox();
    });
  },
};

function showCookieBanner() {
  const banner = document.createElement("div");
  banner.id = "cookie-consent-banner";
  banner.innerHTML = `
    <div style="position: fixed; bottom: 0; left: 0; right: 0; background: hsl(222 47% 8%); border-top: 1px solid hsl(217 33% 16%); padding: 1rem 1.5rem; z-index: 9999; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; box-shadow: 0 -4px 24px rgba(0,0,0,0.3);">
      <div style="flex: 1; min-width: 250px;">
        <p style="margin: 0; color: hsl(210 40% 98%); font-size: 0.9375rem; line-height: 1.5;">
          We use cookies to improve your experience and analyze site traffic. By clicking "Accept", you consent to our use of cookies.
          <a href="/privacy" style="color: #60a5fa; text-decoration: underline; margin-left: 0.25rem;">Learn more</a>
        </p>
      </div>
      <div style="display: flex; gap: 0.75rem; flex-shrink: 0;">
        <button id="cookie-decline" style="padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid hsl(217 33% 16%); background: transparent; color: hsl(215 20% 65%); font-weight: 500; cursor: pointer; font-size: 0.875rem; transition: all 0.15s;">
          Decline
        </button>
        <button id="cookie-accept" style="padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; font-size: 0.875rem; transition: all 0.15s; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
          Accept
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById("cookie-accept")?.addEventListener("click", () => {
    localStorage.setItem("aidimag-cookie-consent", "accepted");
    enableAnalytics();
    banner.remove();
  });

  document.getElementById("cookie-decline")?.addEventListener("click", () => {
    localStorage.setItem("aidimag-cookie-consent", "declined");
    banner.remove();
  });

  const acceptBtn = document.getElementById("cookie-accept");
  const declineBtn = document.getElementById("cookie-decline");
  
  acceptBtn?.addEventListener("mouseenter", () => {
    acceptBtn.style.background = "#1d4ed8";
  });
  acceptBtn?.addEventListener("mouseleave", () => {
    acceptBtn.style.background = "#2563eb";
  });

  declineBtn?.addEventListener("mouseenter", () => {
    declineBtn.style.borderColor = "hsl(217 33% 25%)";
    declineBtn.style.color = "hsl(210 40% 98%)";
  });
  declineBtn?.addEventListener("mouseleave", () => {
    declineBtn.style.borderColor = "hsl(217 33% 16%)";
    declineBtn.style.color = "hsl(215 20% 65%)";
  });
}

function enableAnalytics() {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("consent", "update", {
      analytics_storage: "granted",
    });
  }
}

function setupDiagramLightbox() {
  if (typeof window === "undefined") return;

  function openLightbox(src: string, alt: string) {
    const overlay = document.createElement("div");
    overlay.id = "dim-lightbox";
    overlay.innerHTML = `
      <div class="dim-lightbox-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:2rem;cursor:zoom-out;">
        <button class="dim-lightbox-close" aria-label="Close" style="position:fixed;top:1.5rem;right:1.5rem;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.2s;backdrop-filter:blur(4px);">&times;</button>
        <img src="${src}" alt="${alt}" style="max-width:none;max-height:95vh;border-radius:12px;box-shadow:0 8px 48px rgba(0,0,0,0.5);object-fit:contain;transform:scale(1.15);transform-origin:center;" />
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const close = () => {
      overlay.remove();
      document.body.style.overflow = "";
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || (e.target as HTMLElement).classList.contains("dim-lightbox-backdrop") || (e.target as HTMLElement).classList.contains("dim-lightbox-close")) {
        close();
      }
    });

    document.addEventListener("keydown", function escHandler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", escHandler);
      }
    });
  }

  function attachListeners() {
    // Auto-tag screenshot images with dim-screenshot class for zoom + lightbox
    document.querySelectorAll(".vp-doc img[src*='/screenshots/']:not(.dim-diagram):not(.dim-screenshot)").forEach((img) => {
      img.classList.add("dim-screenshot");
    });
    document.querySelectorAll("img.dim-diagram, img.dim-screenshot").forEach((img) => {
      if (img.getAttribute("data-lightbox-attached")) return;
      img.setAttribute("data-lightbox-attached", "true");
      img.addEventListener("click", () => {
        const src = img.getAttribute("src") || "";
        const alt = img.getAttribute("alt") || "";
        openLightbox(src, alt);
      });
    });
  }

  attachListeners();

  // Re-attach on route changes (SPA navigation)
  const observer = new MutationObserver(() => attachListeners());
  observer.observe(document.body, { childList: true, subtree: true });
}

