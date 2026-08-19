/* Alpha Hill Medical Centre — shared interactions
   Kept small, dependency-free and progressive: the site works fully without JS. */
(function () {
  "use strict";

  /* Mobile navigation toggle -------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");

  function setNavOpen(open) {
    if (!toggle || !links) return;
    links.classList.toggle("open", open);
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeNav() {
    setNavOpen(false);
  }

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      setNavOpen(!links.classList.contains("open"));
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
    document.addEventListener("click", function (e) {
      if (!links.classList.contains("open")) return;
      if (toggle.contains(e.target) || links.contains(e.target)) return;
      closeNav();
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

  /* Form submissions ----------------------------------------------------
     Every public form posts JSON to the API and reports the outcome in its
     own status paragraph. Submissions land in the staff dashboard. */

  function setStatus(el, message, state) {
    if (!el) return;
    el.textContent = message;
    el.className = state === "ok" ? "form-status ok" : "form-status";
    el.style.color = state === "error" ? "var(--red)" : "";
  }

  function firstName(value) {
    return value ? " " + String(value).trim().split(/\s+/)[0] : "";
  }

  function ensureToast() {
    var root = document.getElementById("site-toast");
    if (root) return root;

    root = document.createElement("div");
    root.id = "site-toast";
    root.className = "site-toast";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "site-toast-title");
    root.setAttribute("aria-describedby", "site-toast-text");
    root.innerHTML =
      '<div class="site-toast__card">' +
      '<div class="site-toast__icon" aria-hidden="true"></div>' +
      '<h2 id="site-toast-title"></h2>' +
      '<p id="site-toast-text"></p>' +
      '<button type="button" class="btn btn--primary" id="site-toast-ok">OK</button>' +
      "</div>";
    document.body.appendChild(root);

    var close = function () {
      root.hidden = true;
      document.body.style.overflow = "";
    };

    root.querySelector("#site-toast-ok").addEventListener("click", close);
    root.addEventListener("click", function (event) {
      if (event.target === root) close();
    });
    document.addEventListener("keydown", function (event) {
      if (!root.hidden && event.key === "Escape") close();
    });

    return root;
  }

  function showToast(type, title, message) {
    var root = ensureToast();
    var card = root.querySelector(".site-toast__card");
    var icon = root.querySelector(".site-toast__icon");
    card.className =
      "site-toast__card site-toast__card--" +
      (type === "error" ? "error" : "success");
    icon.innerHTML =
      type === "error"
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 14h-2v-2h2Zm0-4h-2V7h2Z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.2 14.2-4.2-4.2 1.4-1.4 2.8 2.8 6-6 1.4 1.4Z"/></svg>';
    root.querySelector("#site-toast-title").textContent = title;
    root.querySelector("#site-toast-text").textContent = message;
    root.hidden = false;
    document.body.style.overflow = "hidden";
    root.querySelector("#site-toast-ok").focus();
  }

  /**
   * Wires a form to an API endpoint.
   *
   * options.validate returns an error string to block submission.
   * options.success builds the thank-you message from the submitted data.
   */
  function wireForm(formId, statusId, endpoint, options) {
    var formEl = document.getElementById(formId);
    if (!formEl) return;

    var statusEl = document.getElementById(statusId);
    var opts = options || {};

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();

      var data = {};
      new FormData(formEl).forEach(function (value, key) {
        data[key] = value;
      });

      if (opts.validate) {
        var problem = opts.validate(data, formEl);
        if (problem) {
          setStatus(statusEl, problem, "error");
          showToast("error", "Please check the form", problem);
          return;
        }
      }

      var button = formEl.querySelector("button[type='submit']");
      var originalLabel = button ? button.textContent : "";
      if (button) {
        button.disabled = true;
        button.textContent = opts.busyLabel || "Sending…";
      }
      setStatus(statusEl, "Sending…", "");

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(function (response) {
          return response.json().then(function (payload) {
            return { ok: response.ok, payload: payload };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            throw new Error(
              result.payload.error || "Something went wrong. Please try again."
            );
          }
          var okMessage = opts.success(data);
          setStatus(statusEl, okMessage, "ok");
          formEl.reset();
          showToast("success", "Thank you", okMessage);
        })
        .catch(function (error) {
          var failMessage =
            error.message ||
            "We could not send your message. Please try again, or call +254 722 865 459.";
          setStatus(statusEl, failMessage, "error");
          showToast("error", "Something went wrong", failMessage);
        })
        .finally(function () {
          if (button) {
            button.disabled = false;
            button.textContent = originalLabel;
          }
        });
    });
  }

  wireForm("enquiry-form", "form-status", "/api/enquiries", {
    validate: function (data) {
      if ((!data.full_name || !data.full_name.trim()) && (!data.name || !data.name.trim()))
        return "Please enter your name.";
      if (!data.phone || !data.phone.trim())
        return "Please enter a phone number so we can reach you.";
      if (!data.message || !data.message.trim())
        return "Please write a short message.";
      return null;
    },
    success: function (data) {
      return (
        "Thank you" +
        firstName(data.full_name || data.name) +
        "! Your enquiry has been received. We will contact you shortly. For emergencies call +254 722 865 459."
      );
    },
  });

  wireForm("review-form", "review-status", "/api/feedback", {
    busyLabel: "Submitting…",
    validate: function (data) {
      if (!data.rating) return "Please select a star rating before submitting.";
      if (!data.name || !data.name.trim()) return "Please enter your name.";
      if (!data.message || !data.message.trim())
        return "Please write your review before submitting.";
      return null;
    },
    success: function (data) {
      return (
        "Thank you" +
        firstName(data.name) +
        "! Your review has been received and will be published once our team has read it. We truly appreciate your feedback."
      );
    },
  });

  wireForm("career-form", "career-status", "/api/career-applications", {
    busyLabel: "Submitting…",
    validate: function (data) {
      if (!data.full_name || !data.full_name.trim())
        return "Please enter your full name.";
      if (!data.phone || !data.phone.trim()) return "Please enter your phone number.";
      if (!data.email || !data.email.trim()) return "Please enter your email address.";
      if (!data.opportunity_type)
        return "Please choose the type of opportunity you are applying for.";
      if (!data.position || !data.position.trim())
        return "Please tell us the position or field you are applying for.";
      return null;
    },
    success: function (data) {
      return (
        "Thank you" +
        firstName(data.full_name) +
        "! Your application has been received. Our human resource team will be in touch if you are shortlisted."
      );
    },
  });

  wireForm("appointment-form", "appointment-status", "/api/appointments", {
    busyLabel: "Requesting…",
    validate: function (data) {
      if (!data.patient_name || !data.patient_name.trim())
        return "Please enter the patient's name.";
      if (!data.phone || !data.phone.trim()) return "Please enter a phone number.";
      if (!data.date_preferred) return "Please choose a preferred date.";
      if (!data.time_preferred) return "Please choose a preferred time.";
      if (!data.service) return "Please select the service you need.";
      return null;
    },
    success: function (data) {
      return (
        "Thank you" +
        firstName(data.patient_name) +
        "! Your appointment request has been received. Our team will call you to confirm the time."
      );
    },
  });

  wireForm("subscribe-form", "subscribe-status", "/api/subscribe", {
    busyLabel: "Subscribing…",
    validate: function (data) {
      if (!data.email || !data.email.trim())
        return "Please enter your email address.";
      return null;
    },
    success: function () {
      return "Thank you for subscribing — watch out for our next update.";
    },
  });

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
    if (
      slides.length > 1 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
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

      var swipeSurface = document.querySelector(".hero-slider") || heroSection;
      var swipeStartX = null;
      var swipeStartY = null;
      var swipeMoved = false;
      var swipeThreshold = 36;

      function swipeDelta(touch) {
        return {
          dx: touch.clientX - swipeStartX,
          dy: touch.clientY - swipeStartY,
        };
      }

      function endSwipe(dx, dy) {
        swipeStartX = null;
        swipeStartY = null;
        if (Math.abs(dx) >= swipeThreshold && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) nextSlide();
          else prevSlide();
        }
        startAutoplay();
      }

      swipeSurface.addEventListener(
        "touchstart",
        function (e) {
          if (e.changedTouches.length !== 1) return;
          swipeStartX = e.changedTouches[0].clientX;
          swipeStartY = e.changedTouches[0].clientY;
          swipeMoved = false;
          stopAutoplay();
        },
        { passive: true }
      );

      swipeSurface.addEventListener(
        "touchmove",
        function (e) {
          if (swipeStartX === null) return;
          var delta = swipeDelta(e.changedTouches[0]);
          if (Math.abs(delta.dx) > 8 && Math.abs(delta.dx) > Math.abs(delta.dy)) {
            swipeMoved = true;
            if (e.cancelable) e.preventDefault();
          }
        },
        { passive: false }
      );

      swipeSurface.addEventListener(
        "touchend",
        function (e) {
          if (swipeStartX === null) return;
          var delta = swipeDelta(e.changedTouches[0]);
          endSwipe(delta.dx, delta.dy);
        },
        { passive: true }
      );

      swipeSurface.addEventListener("touchcancel", function () {
        swipeStartX = null;
        swipeStartY = null;
        swipeMoved = false;
        startAutoplay();
      });

      swipeSurface.addEventListener(
        "click",
        function (e) {
          if (!swipeMoved) return;
          swipeMoved = false;
          e.preventDefault();
          e.stopPropagation();
        },
        true
      );
    }

    startAutoplay();
  }

  /* Cookie consent ------------------------------------------------------ */
  var consentForm = document.getElementById("cookie-consent-form");
  var cookieBanner = document.getElementById("cookie-banner");
  if (consentForm && cookieBanner) {
    var pathField = document.getElementById("cookie-path");
    if (pathField) pathField.value = window.location.pathname || "/";

    var hasConsentCookie = function () {
      var cookies = document.cookie ? document.cookie.split(";") : [];
      for (var i = 0; i < cookies.length; i++) {
        if (cookies[i].trim().indexOf("ahmc_consent=") === 0) return true;
      }
      return false;
    };

    // Shown straight away: a delayed banner is missed by anyone who reads one
    // page and leaves, so the choice is never really offered.
    if (!hasConsentCookie()) {
      cookieBanner.hidden = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          cookieBanner.classList.add("is-in");
        });
      });
    }

    consentForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var submitter = e.submitter;
      var choice = submitter && submitter.value ? submitter.value : "accepted";

      fetch("/api/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          choice: choice,
          path: window.location.pathname || "/",
        }),
      })
        .then(function (response) {
          return response.json().then(function (payload) {
            return { ok: response.ok, payload: payload };
          });
        })
        .then(function (result) {
          if (!result.ok || !result.payload.success) {
            throw new Error("Could not save cookie choice");
          }
          cookieBanner.classList.remove("is-in");
          cookieBanner.hidden = true;
        })
        .catch(function () {
          showToast(
            "error",
            "Please try again",
            "We could not save your cookie choice. Please tap Accept or Decline again."
          );
        });
    });
  }
})();
