(function () {
  "use strict";
  var SCRIPT = document.currentScript;
  var ORIGIN = (SCRIPT && new URL(SCRIPT.src).origin) || window.location.origin;

  function mount(el) {
    if (el.dataset.pmformMounted === "1") return;
    el.dataset.pmformMounted = "1";
    var slug = el.getAttribute("data-pmform");
    if (!slug) return;
    var theme = el.getAttribute("data-pmform-theme") || "";
    var qs = theme ? "?embed=1&theme=" + encodeURIComponent(theme) : "?embed=1";

    var iframe = document.createElement("iframe");
    iframe.src = ORIGIN + "/f/" + encodeURIComponent(slug) + qs;
    iframe.title = "Request form";
    iframe.loading = "lazy";
    iframe.setAttribute("allow", "clipboard-write");
    iframe.style.cssText = "width:100%;border:0;display:block;min-height:480px;background:transparent;";
    el.appendChild(iframe);
    el.__pmformIframe = iframe;
  }

  function mountAll() {
    var nodes = document.querySelectorAll("[data-pmform]");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  window.addEventListener("message", function (e) {
    var d = e && e.data;
    if (!d || d.type !== "lovable-pm-form" || d.event !== "resize") return;
    var nodes = document.querySelectorAll("[data-pmform]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute("data-pmform") === d.slug && el.__pmformIframe) {
        el.__pmformIframe.style.height = Math.max(240, d.height + 16) + "px";
      }
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
})();
