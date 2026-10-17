(function () {
  var STORAGE_KEY = "theme";
  var header = document.querySelector("[data-site-header]");
  var toggle = document.querySelector("[data-nav-toggle]");
  var drawer = document.querySelector("[data-nav-drawer]");
  var themeToggle = document.querySelector("[data-theme-toggle]");
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function readStoredTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        return stored;
      }
    } catch (error) {
      // ignore
    }
    return null;
  }

  function currentTheme() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") {
      return attr;
    }
    return systemTheme();
  }

  function applyTheme(theme, persist) {
    var next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);

    if (themeMeta) {
      themeMeta.setAttribute("content", next === "dark" ? "#191815" : "#faf9f5");
    }

    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        next === "dark" ? "切换浅色模式" : "切换深色模式"
      );
      themeToggle.setAttribute(
        "title",
        next === "dark" ? "切换到浅色" : "切换到深色"
      );
    }

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (error) {
        // ignore
      }
    }
  }

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

  // Honor stored choice, else system preference (FOUC script may already set attr).
  var storedTheme = readStoredTheme();
  applyTheme(storedTheme || currentTheme() || systemTheme(), false);

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
    });
  }

  if (window.matchMedia) {
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function () {
      if (!readStoredTheme()) {
        applyTheme(systemTheme(), false);
      }
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(onChange);
    }
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
