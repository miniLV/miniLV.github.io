(function () {
  var header = document.querySelector("[data-site-header]");
  var toggle = document.querySelector("[data-nav-toggle]");
  var drawer = document.querySelector("[data-nav-drawer]");

  function syncHeader() {
    if (!header) {
      return;
    }

    if (window.scrollY > 8) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }
  }

  function closeDrawer() {
    if (!toggle || !drawer) {
      return;
    }

    toggle.setAttribute("aria-expanded", "false");
    drawer.classList.remove("is-open");
  }

  if (toggle && drawer) {
    toggle.addEventListener("click", function () {
      var isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
      drawer.classList.toggle("is-open", !isOpen);
    });

    document.addEventListener("click", function (event) {
      if (!drawer.contains(event.target) && !toggle.contains(event.target)) {
        closeDrawer();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 768) {
        closeDrawer();
      }
    });
  }

  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });
})();
