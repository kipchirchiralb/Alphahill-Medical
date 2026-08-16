/* Alpha Hill Medical Centre — dashboard behaviour.
   Confirmation prompts, flash popups, and the mobile nav drawer.
   No tracking, no network calls. */
(function () {
  "use strict";

  document.addEventListener("submit", function (event) {
    var submitter = event.submitter;
    var message =
      (submitter && submitter.getAttribute("data-confirm")) ||
      event.target.getAttribute("data-confirm");

    if (message && !window.confirm(message)) {
      event.preventDefault();
    }
  });

  var toast = document.getElementById("dash-toast");
  var closeToast = function () {
    if (toast) toast.hidden = true;
  };
  if (toast) {
    var ok = document.getElementById("dash-toast-ok");
    if (ok) {
      ok.addEventListener("click", closeToast);
      ok.focus();
    }
    toast.addEventListener("click", function (event) {
      if (event.target === toast) closeToast();
    });
  }

  /* Mobile sidebar drawer — only active below 960px. -------------------- */
  var toggle = document.querySelector(".dash-menu-toggle");
  var sidebar = document.getElementById("dashboard-sidebar");
  var backdrop = document.getElementById("dashboard-backdrop");
  var mq = window.matchMedia("(max-width: 960px)");

  function isMobileNav() {
    return mq.matches;
  }

  function setNavOpen(open) {
    if (!toggle || !sidebar) return;
    if (!isMobileNav()) open = false;

    sidebar.classList.toggle("is-open", open);
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("dash-nav-open", open);
    document.documentElement.classList.toggle("dash-nav-open", open);

    if (isMobileNav()) {
      sidebar.setAttribute("aria-hidden", open ? "false" : "true");
    } else {
      sidebar.removeAttribute("aria-hidden");
    }

    if (backdrop) backdrop.classList.toggle("is-visible", open);
  }

  function closeNav() {
    setNavOpen(false);
  }

  if (toggle && sidebar) {
    setNavOpen(false);

    toggle.addEventListener("click", function () {
      setNavOpen(!sidebar.classList.contains("is-open"));
    });

    sidebar.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeNav();
    });

    if (backdrop) {
      backdrop.addEventListener("click", closeNav);
    }

    var onBreakpoint = function () {
      if (!isMobileNav()) closeNav();
      else if (!sidebar.classList.contains("is-open")) setNavOpen(false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onBreakpoint);
    else if (mq.addListener) mq.addListener(onBreakpoint);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (document.body.classList.contains("dash-nav-open")) {
      closeNav();
      return;
    }
    closeToast();
  });
})();
