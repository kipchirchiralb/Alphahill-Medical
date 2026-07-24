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

  /* Review form (front-end only demo) ----------------------------------- */
  var reviewForm = document.getElementById("review-form");
  if (reviewForm) {
    reviewForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("review-status");
      var rating = reviewForm.querySelector("input[name='rating']:checked");
      var name = (reviewForm.querySelector("#rev-name") || {}).value || "";
      if (!rating) {
        if (status) {
          status.textContent = "Please select a star rating before submitting.";
          status.className = "form-status";
          status.style.color = "var(--red)";
        }
        return;
      }
      if (status) {
        status.style.color = "";
        status.textContent =
          "Thank you" +
          (name ? ", " + name.split(" ")[0] : "") +
          "! Your review has been received. We truly appreciate your feedback — it helps us keep improving our care.";
        status.className = "form-status ok";
      }
      reviewForm.reset();
    });
  }

  /* Hero Slideshow ----------------------------------------------------- */
  var slides = document.querySelectorAll(".hero-slide");
  var dots = document.querySelectorAll(".slider-dots .dot");
  var prevBtn = document.querySelector(".slider-control.prev");
  var nextBtn = document.querySelector(".slider-control.next");
  var currentSlide = 0;
  var slideTimer = null;
  var slideInterval = 5500;

  function showSlide(index) {
    if (slides.length === 0) return;
    var nextIndex = index;
    if (index < 0) {
      nextIndex = slides.length - 1;
    } else if (index >= slides.length) {
      nextIndex = 0;
    }

    slides[currentSlide].classList.remove("active");
    slides[currentSlide].setAttribute("aria-hidden", "true");
    if (dots.length > currentSlide) {
      dots[currentSlide].classList.remove("active");
      dots[currentSlide].setAttribute("aria-selected", "false");
    }

    slides[nextIndex].classList.add("active");
    slides[nextIndex].removeAttribute("aria-hidden");
    if (dots.length > nextIndex) {
      dots[nextIndex].classList.add("active");
      dots[nextIndex].setAttribute("aria-selected", "true");
    }

    currentSlide = nextIndex;
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }

  function prevSlide() {
    showSlide(currentSlide - 1);
  }

  function startAutoplay() {
    stopAutoplay();
    if (slides.length > 1) {
      slideTimer = setInterval(nextSlide, slideInterval);
    }
  }

  function stopAutoplay() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = null;
    }
  }

  if (slides.length > 0) {
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        prevSlide();
        startAutoplay();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        nextSlide();
        startAutoplay();
      });
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        showSlide(i);
        startAutoplay();
      });
    });

    var heroSection = document.querySelector(".hero");
    if (heroSection) {
      heroSection.addEventListener("mouseenter", stopAutoplay);
      heroSection.addEventListener("mouseleave", startAutoplay);
      heroSection.addEventListener("focusin", stopAutoplay);
      heroSection.addEventListener("focusout", startAutoplay);

      heroSection.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") {
          prevSlide();
          startAutoplay();
        } else if (e.key === "ArrowRight") {
          nextSlide();
          startAutoplay();
        }
      });
    }

    startAutoplay();
  }
})();
