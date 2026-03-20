const API_BASE = "https://cheery-camel-510.convex.site";
const CAMPAIGN_SLUG = "compute-cluster-fund";

function centsToUsd(cents) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "className") node.className = value;
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key === "style") node.setAttribute("style", value);
      else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

// ─── Meter ─────────────────────────────────────────────
function renderMeter(container, snapshot) {
  container.innerHTML = "";

  const progress = Math.min(
    (snapshot.campaign.fundedUsdCents / snapshot.campaign.fundingGoalUsdCents) * 100,
    100,
  );

  const block = el("div", { className: "progress-block" });
  const header = el("div", { className: "progress-header" },
    el("span", { className: "progress-raised" }, centsToUsd(snapshot.campaign.fundedUsdCents)),
    el("span", { className: "progress-goal" }, `of ${centsToUsd(snapshot.campaign.fundingGoalUsdCents)}`),
  );
  const bar = el("div", { className: "progress-bar" });
  const fill = el("div", { className: "progress-fill" });
  bar.appendChild(fill);
  block.append(header, bar);

  const milestonesEl = el("div", { className: "milestones" });
  for (const ms of [...snapshot.milestones].sort((a, b) => a.stepNumber - b.stepNumber)) {
    const reached = snapshot.campaign.fundedUsdCents >= ms.targetUsdCents;
    milestonesEl.appendChild(
      el("div", { className: reached ? "milestone reached" : "milestone" },
        el("div", { className: "milestone-amount" }, centsToUsd(ms.targetUsdCents)),
        el("div", { className: "milestone-title" }, ms.title),
      ),
    );
  }

  container.append(block, milestonesEl);
  requestAnimationFrame(() => {
    setTimeout(() => { fill.style.width = `${Math.max(progress, 0.2)}%`; }, 100);
  });
}

// ─── Donation stream ───────────────────────────────────
let donationsExpanded = false;
const DONATIONS_DEFAULT_LIMIT = 5;

function renderDonations(container, rows) {
  container.innerHTML = "";
  if (!rows.length) {
    container.appendChild(el("p", { style: "color: var(--text-muted); font-size: 14px;" }, "No donations yet. Be the first."));
    return;
  }

  const total = rows.length;
  const visible = donationsExpanded ? rows : rows.slice(0, DONATIONS_DEFAULT_LIMIT);
  const hasMore = total > DONATIONS_DEFAULT_LIMIT && !donationsExpanded;

  const header = el("div", { style: "display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;" },
    el("span", { style: "font-size: 12px; color: var(--text-muted);" }, `${total} donation${total === 1 ? "" : "s"}`),
  );
  container.appendChild(header);

  const list = el("ul", { className: "stream" });
  for (const row of visible) {
    list.appendChild(el("li", null,
      el("div", null,
        el("div", { className: "stream-who" }, row.donor || "anon"),
        el("div", { className: "stream-time" }, timeAgo(row.createdAt)),
      ),
      el("div", null,
        el("div", { className: "stream-amount" }, centsToUsd(row.grossUsdCents)),
        el("div", { className: "stream-rail" }, row.paymentRailCode.replaceAll("_", " ")),
      ),
    ));
  }
  container.appendChild(list);

  if (hasMore) {
    const moreBtn = el("button", {
      className: "see-more-btn",
      type: "button",
      onClick: () => {
        donationsExpanded = true;
        renderDonations(container, rows);
      },
    }, `See ${total - DONATIONS_DEFAULT_LIMIT} more`);
    container.appendChild(moreBtn);
  }

  if (donationsExpanded && total > DONATIONS_DEFAULT_LIMIT) {
    const lessBtn = el("button", {
      className: "see-more-btn",
      type: "button",
      style: "margin-top: 8px;",
      onClick: () => {
        donationsExpanded = false;
        renderDonations(container, rows);
      },
    }, "Show less");
    container.appendChild(lessBtn);
  }
}

// ─── Updates stream ────────────────────────────────────
let updatesExpanded = false;
const UPDATES_DEFAULT_LIMIT = 5;

function renderUpdates(container, rows) {
  container.innerHTML = "";
  if (!rows.length) return;

  const total = rows.length;
  const visible = updatesExpanded ? rows : rows.slice(0, UPDATES_DEFAULT_LIMIT);
  const hasMore = total > UPDATES_DEFAULT_LIMIT && !updatesExpanded;

  const header = el("div", { style: "display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;" },
    el("span", { style: "font-size: 12px; color: var(--text-muted);" }, `${total} update${total === 1 ? "" : "s"}`),
  );
  container.appendChild(header);

  const list = el("ul", { className: "stream" });
  for (const row of visible) {
    list.appendChild(el("li", { style: "flex-direction: column; align-items: flex-start;" },
      el("div", { className: "stream-type" }, `${row.type.replaceAll("_", " ")} · ${timeAgo(row.publishedAt)}`),
      el("div", { className: "stream-title" }, row.title),
      el("div", { className: "stream-summary" }, row.summary),
    ));
  }
  container.appendChild(list);

  if (hasMore) {
    const moreBtn = el("button", {
      className: "see-more-btn",
      type: "button",
      onClick: () => {
        updatesExpanded = true;
        renderUpdates(container, rows);
      },
    }, `See ${total - UPDATES_DEFAULT_LIMIT} more`);
    container.appendChild(moreBtn);
  }

  if (updatesExpanded && total > UPDATES_DEFAULT_LIMIT) {
    const lessBtn = el("button", {
      className: "see-more-btn",
      type: "button",
      style: "margin-top: 8px;",
      onClick: () => {
        updatesExpanded = false;
        renderUpdates(container, rows);
      },
    }, "Show less");
    container.appendChild(lessBtn);
  }
}

// ─── Donate form ───────────────────────────────────────
function renderDonate(container, snapshot, onComplete) {
  container.innerHTML = "";

  const allRails = snapshot.paymentRails;
  const cardRails = allRails.filter(r => r.kind === "card");
  const cryptoRails = allRails.filter(r => r.kind === "crypto");

  // Group crypto by chain
  const chains = {};
  for (const r of cryptoRails) {
    const chain = r.chain || "other";
    if (!chains[chain]) chains[chain] = [];
    chains[chain].push(r);
  }
  const chainOrder = ["base", "polygon", "optimism", "ethereum", "solana"];

  let selectedMethod = "card"; // "card" or "crypto"
  let selectedRailCode = cardRails[0]?.code ?? "stripe_card";
  let selectedChain = chainOrder[0];
  let currentAmount = 20;

  // ── Amount ──
  const amountInput = el("input", {
    className: "amount-input",
    type: "number",
    min: "1",
    step: "1",
    value: "20",
    placeholder: "0",
  });
  const amountDisplay = el("div", { className: "amount-display" },
    el("span", { className: "dollar" }, "$"),
    amountInput,
  );

  // ── Presets ──
  const presetsEl = el("div", { className: "presets" });
  const presetValues = [20, 50, 100, 500, 1000];
  let selectedPreset = 20;

  function redrawPresets() {
    presetsEl.innerHTML = "";
    for (const val of presetValues) {
      presetsEl.appendChild(
        el("button", {
          className: selectedPreset === val ? "active" : "",
          type: "button",
          onClick: () => {
            amountInput.value = String(val);
            currentAmount = val;
            selectedPreset = val;
            redrawPresets();
            updateCta();
          },
        }, `$${val}`),
      );
    }
  }
  redrawPresets();

  const customHint = el("p", { className: "custom-hint" }, "or type any amount above");

  amountInput.addEventListener("input", () => {
    currentAmount = Number.parseInt(amountInput.value, 10) || 0;
    selectedPreset = null;
    redrawPresets();
    updateCta();
  });

  // ── Method toggle: Card / Crypto ──
  const methodLabel = el("p", { className: "section-title" }, "Method");
  const methodToggle = el("div", { className: "method-toggle" });

  function redrawMethodToggle() {
    methodToggle.innerHTML = "";
    methodToggle.appendChild(el("button", {
      className: `method-btn${selectedMethod === "card" ? " active" : ""}`,
      type: "button",
      onClick: () => { selectedMethod = "card"; selectedRailCode = cardRails[0]?.code; redrawAll(); },
    }, "Card"));
    methodToggle.appendChild(el("button", {
      className: `method-btn${selectedMethod === "crypto" ? " active" : ""}`,
      type: "button",
      onClick: () => { selectedMethod = "crypto"; pickChain(selectedChain); redrawAll(); },
    }, "Crypto"));
  }

  // ── Chain selector (only for crypto) ──
  const chainSection = el("div");

  function pickChain(chain) {
    selectedChain = chain;
    const assets = chains[chain] || [];
    selectedRailCode = assets[0]?.code ?? selectedRailCode;
  }

  function redrawChainSection() {
    chainSection.innerHTML = "";
    if (selectedMethod !== "crypto") return;

    const chainLabel = el("p", { className: "section-title", style: "margin-top: 16px;" }, "Network");
    const chainBtns = el("div", { className: "rails" });
    for (const chain of chainOrder) {
      if (!chains[chain]) continue;
      const label = chain.charAt(0).toUpperCase() + chain.slice(1);
      chainBtns.appendChild(el("button", {
        className: `rail${selectedChain === chain ? " selected" : ""}`,
        type: "button",
        onClick: () => { pickChain(chain); redrawAll(); },
      }, label));
    }

    const assetLabel = el("p", { className: "section-title", style: "margin-top: 16px;" }, "Asset");
    const assetBtns = el("div", { className: "rails" });
    for (const r of (chains[selectedChain] || [])) {
      assetBtns.appendChild(el("button", {
        className: `rail${selectedRailCode === r.code ? " selected" : ""}`,
        type: "button",
        onClick: () => { selectedRailCode = r.code; redrawAll(); },
      }, r.assetSymbol));
    }

    chainSection.append(chainLabel, chainBtns, assetLabel, assetBtns);
  }

  // ── Form fields ──
  const nameInput = el("input", {
    type: "text",
    placeholder: "Name (optional, anonymous by default)",
    maxLength: "60",
  });
  const emailInput = el("input", {
    type: "email",
    placeholder: "Email (for receipt)",
    maxLength: "120",
  });

  // ── Result area (shows after submit) ──
  const resultArea = el("div", { className: "donate-result" });

  // ── CTA ──
  const cta = el("button", {
    className: "cta",
    type: "button",
    onClick: async () => {
      const amountUsd = Number.parseInt(amountInput.value, 10);
      if (!amountUsd || amountUsd <= 0) { amountInput.focus(); return; }

      cta.disabled = true;
      cta.textContent = "Processing...";
      resultArea.innerHTML = "";

      try {
        const payload = await fetchJson(`${API_BASE}/api/donation-intent`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            campaignSlug: CAMPAIGN_SLUG,
            amountUsd,
            paymentRailCode: selectedRailCode,
            donorName: nameInput.value.trim() || undefined,
            donorEmail: emailInput.value.trim() || undefined,
          }),
        });

        if (payload.stripe) {
          showStripeCheckout(resultArea, payload.stripe, amountUsd, onComplete);
        } else if (payload.crypto) {
          showCryptoInstructions(resultArea, payload.crypto, amountUsd, payload.receiptToken);
        }
      } catch (error) {
        resultArea.innerHTML = "";
        resultArea.appendChild(el("p", { className: "donate-error" },
          error instanceof Error ? error.message : "Something went wrong. Try again.",
        ));
        cta.disabled = false;
        updateCta();
      }
    },
  }, `Donate $${currentAmount}`);

  function updateCta() {
    if (!cta.disabled) {
      const methodSuffix = selectedMethod === "crypto" ? ` via ${selectedRailCode.split("_").pop().toUpperCase()}` : "";
      cta.textContent = `Donate $${currentAmount || 0}${methodSuffix}`;
    }
  }

  const note = el("p", { className: "form-note" }, "Card via Stripe. Crypto settled on-chain.");

  function redrawAll() {
    redrawMethodToggle();
    redrawChainSection();
    updateCta();
  }

  redrawAll();
  redrawPresets();

  container.append(
    amountDisplay, presetsEl, customHint,
    methodLabel, methodToggle,
    chainSection,
    nameInput, emailInput,
    cta, note, resultArea,
  );
}

// ─── Stripe checkout (inline) ──────────────────────────
function showStripeCheckout(container, stripeData, amountUsd, onComplete) {
  container.innerHTML = "";

  if (!window.Stripe) {
    // Load Stripe.js dynamically
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.onload = () => initStripeElements(container, stripeData, amountUsd, onComplete);
    document.head.appendChild(script);
  } else {
    initStripeElements(container, stripeData, amountUsd, onComplete);
  }
}

function initStripeElements(container, stripeData, amountUsd, onComplete) {
  container.innerHTML = "";

  const stripe = Stripe(stripeData.publishableKey);
  const elements = stripe.elements({
    clientSecret: stripeData.clientSecret,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#e8a44a",
        colorBackground: "#1c1b19",
        colorText: "#efece7",
        colorTextSecondary: "#a39c8f",
        colorTextPlaceholder: "#6b6861",
        colorDanger: "#c06454",
        borderRadius: "0px",
        fontFamily: "Geist, system-ui, sans-serif",
      },
      rules: {
        ".Input": {
          border: "1px solid #363330",
          backgroundColor: "#151413",
        },
        ".Input:focus": {
          border: "1px solid #c0b5a5",
          boxShadow: "none",
        },
      },
    },
  });

  const paymentEl = elements.create("payment", {
    layout: "tabs",
  });

  const mountPoint = el("div", { style: "margin-bottom: 16px;" });
  const payBtn = el("button", {
    className: "cta",
    type: "button",
    onClick: async () => {
      payBtn.disabled = true;
      payBtn.textContent = "Processing payment...";

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        statusMsg.textContent = error.message;
        statusMsg.style.color = "var(--red)";
        payBtn.disabled = false;
        payBtn.textContent = `Pay $${amountUsd}`;
      } else {
        // Poll for webhook to process and update the campaign total, then show confirmation
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try { await onComplete(); } catch {}
          if (attempts >= 10) {
            clearInterval(poll);
          }
        }, 2000);

        // Show confirmation immediately on the donate container (replaces entire form)
        const donateContainer = container.closest("#donate") || container;
        showConfirmation(donateContainer, amountUsd);
      }
    },
  }, `Pay $${amountUsd}`);

  const statusMsg = el("p", { className: "form-note", style: "margin-top: 10px;" });

  container.append(mountPoint, payBtn, statusMsg);
  paymentEl.mount(mountPoint);
}

// ─── Crypto instructions ───────────────────────────────
function showCryptoInstructions(container, cryptoData, amountUsd, receiptToken) {
  container.innerHTML = "";

  const chainName = cryptoData.chain.charAt(0).toUpperCase() + cryptoData.chain.slice(1);

  const box = el("div", { className: "crypto-result" },
    el("p", { className: "section-title" }, `Send on ${chainName}`),
    el("p", { className: "crypto-address" }, cryptoData.toAddress),
    el("button", {
      className: "copy-btn",
      type: "button",
      onClick: () => {
        navigator.clipboard.writeText(cryptoData.toAddress);
        copyBtn.textContent = "Copied";
        setTimeout(() => { copyBtn.textContent = "Copy address"; }, 2000);
      },
    }, "Copy address"),
    el("p", { className: "form-note", style: "margin-top: 12px;" },
      `Send $${amountUsd} equivalent. Your receipt token: ${receiptToken}`),
  );

  const copyBtn = box.querySelector(".copy-btn");
  container.appendChild(box);
}

// ─── Confirmation screen ──────────────────────────────
function showConfirmation(container, amountUsd) {
  container.innerHTML = "";

  const check = el("div", { className: "confirm-icon" },
    el("svg", { width: "48", height: "48", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
      el("polyline", { points: "20 6 9 17 4 12" }),
    ),
  );

  const box = el("div", { className: "confirm-box" },
    check,
    el("h2", { className: "confirm-title" }, "Thank you!"),
    el("p", { className: "confirm-amount" }, `$${amountUsd} received`),
    el("p", { className: "confirm-desc" }, "Your donation is being processed. You'll receive a receipt via email if one was provided."),
    el("button", {
      className: "cta",
      type: "button",
      style: "margin-top: 24px; background: var(--surface-overlay); color: var(--text-primary); border: 1px solid var(--border-default);",
      onClick: () => renderPage(),
    }, "Done"),
  );

  container.appendChild(box);
}

// ─── Load & render ─────────────────────────────────────
async function loadSnapshot() {
  return fetchJson(`${API_BASE}/api/campaign?slug=${encodeURIComponent(CAMPAIGN_SLUG)}`);
}

async function renderPage() {
  const meterEl = document.getElementById("meter");
  const donateEl = document.getElementById("donate");
  const updatesEl = document.getElementById("updates");
  const donationsEl = document.getElementById("donations");

  try {
    const snapshot = await loadSnapshot();
    renderMeter(meterEl, snapshot);
    renderDonate(donateEl, snapshot, renderPage);
    renderUpdates(updatesEl, snapshot.updates);
    renderDonations(donationsEl, snapshot.donations);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load live data";
    meterEl.innerHTML = "";
    donateEl.innerHTML = "";
    if (updatesEl) updatesEl.innerHTML = "";
    if (donationsEl) donationsEl.innerHTML = "";
    meterEl.appendChild(el("p", { style: "color: var(--text-muted)" }, `Live data unavailable: ${message}`));
  }
}

let pollTimer = null;

function startPolling(intervalMs = 15000) {
  stopPolling();
  pollTimer = setInterval(() => {
    loadSnapshot().then(snapshot => {
      const meterEl = document.getElementById("meter");
      const donationsEl = document.getElementById("donations");
      const updatesEl = document.getElementById("updates");
      if (meterEl) renderMeter(meterEl, snapshot);
      if (donationsEl) renderDonations(donationsEl, snapshot.donations);
      if (updatesEl) renderUpdates(updatesEl, snapshot.updates);
    }).catch(() => {});
  }, intervalMs);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

document.addEventListener("DOMContentLoaded", () => {
  renderPage().catch(console.error);
  startPolling();
});
