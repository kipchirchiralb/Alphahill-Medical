/* Alpha Hill Medical Centre — dashboard behaviour.
   Confirmation prompts only; no tracking, no network calls. */
(function () {
  "use strict";

  document.addEventListener("submit", function (event) {
    // A prompt can be attached to the form itself or to the button that
    // submitted it, so destructive actions can be confirmed individually.
    var submitter = event.submitter;
    var message =
      (submitter && submitter.getAttribute("data-confirm")) ||
      event.target.getAttribute("data-confirm");

    if (message && !window.confirm(message)) {
      event.preventDefault();
    }
  });
})();
