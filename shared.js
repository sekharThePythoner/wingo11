// Wingo 11 - Shared Navigation, Auth Guard & UI Controller
import { initAuthListener, loginWithGoogle, logoutUser, auth } from "./firebase-config.js";
import { sound } from "./audio.js";

export let currentUser = null;
export let currentAuthUser = null;

// Toast Notification Manager
export function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icons = {
    success: "✅",
    error: "❌",
    info: "ℹ️"
  };
  toast.innerHTML = `<span>${icons[type] || "✨"}</span> <div>${message}</div>`;
  container.appendChild(toast);

  if (type === "success") sound.playCoin();
  if (type === "error") sound.playExplosion();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Generate shared navigation bar HTML (Desktop Top Bar + Mobile Bottom Bar)
export function setupNavbar(activePage = "") {
  const navContainer = document.getElementById("app-header");
  if (!navContainer) return;

  navContainer.innerHTML = `
    <!-- Top Sticky Header -->
    <nav class="navbar">
      <a href="index.html" class="nav-brand">
        <div class="brand-icon">👑</div>
        <div>
          <div class="brand-text">Wingo 11</div>
        </div>
        <span class="brand-badge">PRO</span>
      </a>

      <!-- Desktop Links -->
      <ul class="nav-links">
        <li><a href="index.html" class="${activePage === 'home' ? 'active' : ''}">🎮 Arena</a></li>
        <li><a href="deposit.html" class="${activePage === 'deposit' ? 'active' : ''}">💳 Deposit</a></li>
        <li><a href="withdraw.html" class="${activePage === 'withdraw' ? 'active' : ''}">💸 Withdraw</a></li>
        <li><a href="gift.html" class="${activePage === 'gift' ? 'active' : ''}">🎁 Gift</a></li>
        <li><a href="help.html" class="${activePage === 'help' ? 'active' : ''}">💬 Help</a></li>
      </ul>

      <!-- Right Header Actions -->
      <div class="nav-actions">
        <!-- Balance Chip -->
        <div class="balance-pill" id="nav-balance-pill" style="display: none;">
          <span style="font-size: 0.8rem; opacity: 0.8;">₹</span><span id="nav-balance-val">0.00</span>
          <a href="deposit.html" class="add-fund-btn" id="nav-add-btn" title="Deposit Money">+</a>
        </div>

        <!-- Profile Dropdown -->
        <div class="profile-container" id="nav-profile-container" style="display: none; position: relative;">
          <div class="profile-btn" id="nav-profile-btn">
            <img src="" alt="PFP" class="profile-avatar" id="nav-pfp-img">
            <span class="profile-uid" id="nav-uid-badge">W11-XXXXXX</span>
            <span style="font-size: 0.65rem; color: #94a3b8;">▼</span>
          </div>

          <div class="dropdown-menu" id="nav-profile-dropdown">
            <div style="padding: 0.6rem 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.08);">
              <div id="drop-display-name" style="font-weight: 700; color: #fff; font-size: 0.95rem;">Player</div>
              <div id="drop-game-uid" style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent-gold);">W11-000000</div>
            </div>
            <a href="Account.html" class="dropdown-item">👤 Account & Profile</a>
            <a href="deposit.html" class="dropdown-item">💳 Deposit Funds</a>
            <a href="withdraw.html" class="dropdown-item">💸 Withdraw Winnings</a>
            <a href="gift.html" class="dropdown-item">🎁 Send / Claim Gifts</a>
            <a href="help.html" class="dropdown-item">💬 Help & Support</a>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item danger" id="drop-logout-btn">🚪 Sign Out</button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Mobile Bottom App Bar -->
    <div class="mobile-bottom-nav">
      <a href="index.html" class="mobile-nav-item ${activePage === 'home' ? 'active' : ''}">
        <span class="nav-icon">🎮</span>
        <span class="nav-label">Games</span>
      </a>
      <a href="deposit.html" class="mobile-nav-item ${activePage === 'deposit' ? 'active' : ''}">
        <span class="nav-icon">💳</span>
        <span class="nav-label">Deposit</span>
      </a>
      <a href="withdraw.html" class="mobile-nav-item ${activePage === 'withdraw' ? 'active' : ''}">
        <span class="nav-icon">💸</span>
        <span class="nav-label">Withdraw</span>
      </a>
      <a href="gift.html" class="mobile-nav-item ${activePage === 'gift' ? 'active' : ''}">
        <span class="nav-icon">🎁</span>
        <span class="nav-label">Gifts</span>
      </a>
      <a href="Account.html" class="mobile-nav-item ${activePage === 'account' ? 'active' : ''}">
        <span class="nav-icon">👤</span>
        <span class="nav-label">Account</span>
      </a>
    </div>
  `;

  // Attach event handlers
  const profileBtn = document.getElementById("nav-profile-btn");
  const dropdown = document.getElementById("nav-profile-dropdown");
  const logoutBtn = document.getElementById("drop-logout-btn");

  if (profileBtn && dropdown) {
    profileBtn.onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
    };

    document.addEventListener("click", () => {
      dropdown.classList.remove("show");
    });
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      sound.playClick();
      await logoutUser();
      window.location.replace("auth.html");
    };
  }
}

// Subscribe and enforce authentication redirect
export function startAuthWatcher(onUserUpdated = null) {
  const isAuthPage = window.location.pathname.endsWith("auth.html");

  initAuthListener((userProfile, authUser) => {
    currentUser = userProfile;
    currentAuthUser = authUser;

    // Redirection Rule: If visitor is NOT signed in and NOT on auth.html -> redirect to auth.html immediately!
    if (!authUser || !userProfile) {
      if (!isAuthPage) {
        window.location.replace("auth.html");
        return;
      }
    } else {
      // If signed in and on auth.html -> redirect to dashboard
      if (isAuthPage) {
        window.location.replace("index.html");
        return;
      }
    }

    const balancePill = document.getElementById("nav-balance-pill");
    const profileContainer = document.getElementById("nav-profile-container");
    const balanceVal = document.getElementById("nav-balance-val");
    const pfpImg = document.getElementById("nav-pfp-img");
    const uidBadge = document.getElementById("nav-uid-badge");
    const dropName = document.getElementById("drop-display-name");
    const dropUid = document.getElementById("drop-game-uid");

    if (userProfile && authUser) {
      if (balancePill) balancePill.style.display = "flex";
      if (profileContainer) profileContainer.style.display = "block";

      if (balanceVal) balanceVal.textContent = parseFloat(userProfile.balance || 0).toFixed(2);
      if (pfpImg) pfpImg.src = userProfile.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${userProfile.uid}`;
      if (uidBadge) uidBadge.textContent = userProfile.gameUid || "W11-USER";
      if (dropName) dropName.textContent = userProfile.displayName || "Player";
      if (dropUid) dropUid.textContent = userProfile.gameUid || "";
    }

    if (typeof onUserUpdated === "function") {
      onUserUpdated(userProfile, authUser);
    }
  });
}
