/* Alpha Hill Medical Centre — shared interactions
   Kept small, dependency-free and progressive: the site works fully without JS. */
(function () {
  "use strict";

  /* Mobile navigation toggle -------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    // Close the menu after choosing a destination (mobile)
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* Sticky header shadow on scroll -------------------------------------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("scrolled", window.scrollY > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Scroll-reveal animation --------------------------------------------- */
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("in");
    });
  }

  /* Current year in footer ---------------------------------------------- */
  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* Enquiry form (front-end only demo) ---------------------------------- */
  var form = document.getElementById("enquiry-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("form-status");
      var name = (form.querySelector("#name") || {}).value || "";
      if (status) {
        status.textContent =
          "Thank you" +
          (name ? ", " + name.split(" ")[0] : "") +
          "! Your enquiry has been received. We will contact you shortly. For emergencies call +254 722 865 459.";
        status.className = "form-status ok";
      }
      form.reset();
    });
  }
})();
