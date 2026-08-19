/* Runs before the page paints so CSS can tell a scripted browser from a plain
   one (html.js gates the scroll-reveal animations). Kept in its own file
   because the public Content-Security-Policy allows script-src 'self' only —
   an inline <script> here would be blocked and never run. */
document.documentElement.classList.add("js");
