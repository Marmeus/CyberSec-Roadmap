(function () {
  var state = {
    source: null,
    levels: [],
    domains: [],
    domainById: {},
    certs: [],
    certById: {},
    query: "",
    domain: "all",
    level: "all",
    mobileDomain: "network",
    mobile: false,
    route: { name: "chart" },
    selectedId: null
  };

  var ALSO_TITLE = "Also placed here";
  var ALSO_NOTE = "These certifications are drawn across this domain on the source chart.";

  var main = document.getElementById("main");
  var searchInput = document.getElementById("search");
  var domainSelect = document.getElementById("domain");
  var domainField = document.getElementById("domain-field");
  var levelSelect = document.getElementById("level");
  var countEl = document.getElementById("count");
  var tabsEl = document.getElementById("tabs");
  var navEl = document.getElementById("domain-nav");
  var detail = document.getElementById("detail");
  var backdrop = document.getElementById("backdrop");
  var lastFocus = null;
  var hlock = false;

  function el(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value == null || value === false) return;
        if (key === "class") node.className = value;
        else node.setAttribute(key, String(value));
      });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(function (item) { append(node, item); });
      return;
    }
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  function parseRoute() {
    var hash = (location.hash || "#/").replace(/^#/, "");
    var match = hash.match(/^\/area\/([a-z0-9-]+)\/?$/);
    if (match && state.domainById[match[1]]) return { name: "area", id: match[1] };
    return { name: "chart" };
  }

  function levelLabel(id) {
    var level = state.levels.find(function (item) { return item.id === id; });
    return level ? level.label : id;
  }

  function findById(list, id) {
    if (!list || !id) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function sectionOf(cert) {
    return findById((state.domainById[cert.domain] || {}).sections, cert.section);
  }

  function subsectionOf(cert) {
    var section = sectionOf(cert);
    return section ? findById(section.subsections, cert.subsection) : null;
  }

  function paint(cert) {
    var domain = state.domainById[cert.domain] || { color: "#444", ink: "#fff" };
    var sub = subsectionOf(cert) || sectionOf(cert);
    return {
      color: (sub && sub.color) || domain.color,
      ink: (sub && sub.ink) || domain.ink
    };
  }

  function belongs(cert, domainId) {
    return cert.domain === domainId || (cert.crossDomain && cert.domains.indexOf(domainId) !== -1);
  }

  function haystack(cert) {
    var domain = state.domainById[cert.domain];
    var section = sectionOf(cert);
    var sub = subsectionOf(cert);
    return [
      cert.abbreviation,
      cert.name,
      domain ? domain.title : "",
      domain ? domain.shortTitle : "",
      section ? section.title : "",
      sub ? sub.title : "",
      (cert.details || []).join(" ")
    ].join(" ").toLowerCase();
  }

  function matchesFilters(cert) {
    if (state.level !== "all" && cert.level !== state.level) return false;
    var query = state.query.trim().toLowerCase();
    if (!query) return true;
    return haystack(cert).indexOf(query) !== -1;
  }

  function byPosition(a, b) {
    return a.row - b.row || a.column - b.column || a.abbreviation.localeCompare(b.abbreviation);
  }

  function certsInDomain(domainId) {
    return state.certs.filter(function (cert) {
      return belongs(cert, domainId) && matchesFilters(cert);
    });
  }

  function openDetail(id, opener) {
    var cert = state.certById[id];
    if (!cert) return;
    state.selectedId = id;
    lastFocus = opener || document.activeElement;
    var domain = state.domainById[cert.domain];
    var section = sectionOf(cert);
    var sub = subsectionOf(cert);
    document.getElementById("detail-kicker").textContent = levelLabel(cert.level);
    document.getElementById("detail-title").textContent = cert.abbreviation;
    document.getElementById("detail-name").textContent = cert.name;

    var meta = document.getElementById("detail-meta");
    meta.replaceChildren();
    addMeta(meta, "Domain", domain ? domain.title : cert.domain);
    if (domain && domain.sections.length > 1 && section) addMeta(meta, "Section", section.title);
    if (sub) addMeta(meta, "Subsection", sub.title);
    addMeta(meta, "Level", levelLabel(cert.level));
    if (cert.crossDomain) {
      var others = cert.domains.filter(function (domainId) { return domainId !== cert.domain; })
        .map(function (domainId) {
          return state.domainById[domainId] ? state.domainById[domainId].shortTitle : domainId;
        });
      addMeta(meta, "Also in", others.join(", "));
    }

    var lines = document.getElementById("detail-lines");
    lines.replaceChildren();
    (cert.details || []).forEach(function (line) {
      lines.append(el("li", null, line));
    });

    var linkHost = document.getElementById("detail-link");
    linkHost.replaceChildren();
    if (cert.url && /^https?:\/\//i.test(cert.url)) {
      linkHost.append(el("a", { href: cert.url, target: "_blank", rel: "noopener noreferrer" }, "Official certification page"));
    }
    if (domain) {
      if (linkHost.childNodes.length) linkHost.append(document.createTextNode(" · "));
      linkHost.append(el("a", { href: "#/area/" + domain.id }, domain.shortTitle + " area"));
    }

    detail.hidden = false;
    backdrop.hidden = false;
    setPressed(id);
    document.getElementById("detail-close").focus();
  }

  function addMeta(list, term, value) {
    list.append(el("dt", null, term), el("dd", null, value));
  }

  function closeDetail() {
    if (detail.hidden) return;
    state.selectedId = null;
    detail.hidden = true;
    backdrop.hidden = true;
    setPressed(null);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function setPressed(id) {
    document.querySelectorAll("[data-cert]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-cert") === id ? "true" : "false");
    });
  }

  function makeCertButton(cert, className, extra) {
    var colors = paint(cert);
    var button = el("button", {
      type: "button",
      class: className + (cert.crossDomain ? " is-cross" : ""),
      "data-cert": cert.id,
      "aria-pressed": cert.id === state.selectedId ? "true" : "false",
      "aria-label": cert.abbreviation + ", " + cert.name + ", " + levelLabel(cert.level)
    });
    button.style.background = colors.color;
    button.style.color = colors.ink;
    extra(button, cert);
    return button;
  }

  function chip(cert) {
    return makeCertButton(cert, "chip", function (button, item) {
      button.textContent = item.abbreviation;
    });
  }

  function card(cert) {
    return makeCertButton(cert, "card", function (button, item) {
      button.append(
        el("span", { class: "card-abbr" }, item.abbreviation),
        el("span", { class: "card-name" }, item.name)
      );
    });
  }

  // Groups an area's certifications by level, then by section.
  // Certifications from other areas that are drawn into this one go in "Also placed here".
  function levelBlocks(domain, certs) {
    var native = certs.filter(function (cert) { return cert.domain === domain.id; });
    var visitors = certs.filter(function (cert) { return cert.domain !== domain.id; });
    return state.levels.map(function (level) {
      var blocks = domain.sections.map(function (section) {
        return {
          id: section.id,
          title: section.title,
          note: domain.sections.length > 1 ? section.description : "",
          certs: native.filter(function (cert) {
            return cert.level === level.id && cert.section === section.id;
          }).sort(byPosition)
        };
      }).filter(function (block) { return block.certs.length; });
      var spans = visitors.filter(function (cert) { return cert.level === level.id; }).sort(byPosition);
      if (spans.length) {
        blocks.push({ id: "also", title: ALSO_TITLE, note: ALSO_NOTE, certs: spans });
      }
      return { level: level, blocks: blocks };
    }).filter(function (group) { return group.blocks.length; });
  }

  // One column per section. Certifications with no subsection are listed by level.
  // Each subsection comes next, with Expert, Intermediate, and Beginner inside it.
  function renderSectionRow(domain, groups, buttonFor) {
    var columns = domain.sections.map(function (section) {
      return { id: section.id, title: section.title, note: section.description || "", subsections: section.subsections || [] };
    });
    columns.push({ id: "also", title: ALSO_TITLE, note: ALSO_NOTE, subsections: [] });

    var row = el("div", { class: "section-row" });
    columns.forEach(function (column) {
      var certs = [];
      groups.forEach(function (group) {
        group.blocks.forEach(function (block) {
          if (block.id === column.id) certs = certs.concat(block.certs);
        });
      });
      if (!certs.length) return;
      var col = el("section", { class: "section-col" });
      col.append(el("h3", null, column.title));
      if (column.note && domain.sections.length > 1) {
        col.append(el("p", { class: "section-note" }, column.note));
      }
      var known = column.subsections.map(function (sub) { return sub.id; });
      appendLevels(col, certs.filter(function (cert) {
        return known.indexOf(cert.subsection) === -1;
      }), buttonFor);
      column.subsections.forEach(function (sub) {
        var inSub = certs.filter(function (cert) { return cert.subsection === sub.id; });
        if (!inSub.length) return;
        col.append(el("h4", { class: "subsection-title" }, sub.title));
        appendLevels(col, inSub, buttonFor, "h5");
      });
      row.append(col);
    });
    return row;
  }

  function appendLevels(parent, certs, buttonFor, tag) {
    state.levels.forEach(function (level) {
      var inLevel = certs.filter(function (cert) { return cert.level === level.id; }).sort(byPosition);
      if (!inLevel.length) return;
      parent.append(el(tag || "h4", null, level.label), certGroup(inLevel, buttonFor));
    });
  }

  function certGroup(certs, buttonFor) {
    var wrap = el("div", { class: buttonFor === chip ? "chips" : "cards" });
    certs.forEach(function (cert) { wrap.append(buttonFor(cert)); });
    return wrap;
  }

  function renderColumn(domain, certs) {
    var column = el("section", { class: "column" });
    column.style.setProperty("--bar", domain.color);
    var title = el("h2", { class: "column-title" }, el("a", {
      href: "#/area/" + domain.id,
      title: domain.title
    }, domain.shortTitle));
    column.append(title);
    var groups = levelBlocks(domain, certs);
    if (!groups.length) {
      column.append(el("p", { class: "empty" }, "Nothing matches."));
      return column;
    }
    column.append(renderSectionRow(domain, groups, chip));
    return column;
  }

  function renderBoard(list) {
    var shown = state.domain === "all"
      ? state.domains
      : state.domains.filter(function (domain) { return domain.id === state.domain; });
    var board = el("div", { class: "board" });
    shown.forEach(function (domain) {
      var certs = list.filter(function (cert) { return belongs(cert, domain.id); });
      board.append(renderColumn(domain, certs));
    });
    return board;
  }

  function renderArea(domain, certs) {
    var article = el("article", { class: "area" });
    article.style.setProperty("--bar", domain.color);
    article.append(
      el("p", { class: "area-kicker" }, "Area"),
      el("p", { class: "description" }, domain.description)
    );
    var groups = levelBlocks(domain, certs);
    if (!groups.length) {
      article.append(el("p", { class: "empty" }, "No certifications match these filters."));
      return article;
    }
    var inner = el("div", { class: "area-band-inner" });
    inner.append(
      el("h2", { class: "column-title" }, domain.title),
      renderSectionRow(domain, groups, card)
    );
    article.append(el("div", { class: "area-band" }, inner));
    return article;
  }

  function lede() {
    var page = state.source && state.source.page;
    var text = "Eight cybersecurity domains, read from the expert end of the chart down to beginner. ";
    var node = el("p", { class: "lede" }, text);
    return node;
  }

  function renderNav() {
    var links = [el("a", { href: "#/" }, "Overview")];
    if (state.route.name === "chart") links[0].setAttribute("aria-current", "page");
    state.domains.forEach(function (domain) {
      var link = el("a", { href: "#/area/" + domain.id }, domain.shortTitle);
      link.style.setProperty("--bar", domain.color);
      if (state.route.name === "area" && state.route.id === domain.id) {
        link.setAttribute("aria-current", "page");
      }
      links.push(link);
    });
    navEl.replaceChildren.apply(navEl, links);
  }

  function renderTabs() {
    var show = state.mobile && state.route.name === "chart";
    tabsEl.hidden = !show;
    domainField.hidden = state.mobile || state.route.name === "area";
    if (!show) {
      tabsEl.replaceChildren();
      return;
    }
    tabsEl.replaceChildren.apply(tabsEl, state.domains.map(function (domain) {
      var selected = domain.id === state.mobileDomain;
      var button = el("button", {
        type: "button",
        class: "tab",
        role: "tab",
        "aria-selected": selected ? "true" : "false",
        id: "tab-" + domain.id
      }, domain.shortTitle);
      button.style.setProperty("--bar", domain.color);
      button.addEventListener("click", function () {
        state.mobileDomain = domain.id;
        render();
      });
      return button;
    }));
  }

  function updateCount(matched, total, label) {
    var text = "Showing " + matched + " of " + total;
    countEl.textContent = label ? text + " in " + label : text + " certifications";
  }

  function render() {
    state.route = parseRoute();
    renderNav();
    renderTabs();
    var title = "Security Certification Roadmap";
    main.replaceChildren(lede());

    if (state.route.name === "area") {
      var area = state.domainById[state.route.id];
      document.title = area.shortTitle + " · " + title;
      var inArea = certsInDomain(area.id);
      var areaTotal = state.certs.filter(function (cert) { return belongs(cert, area.id); }).length;
      updateCount(inArea.length, areaTotal, area.shortTitle);
      main.append(renderArea(area, inArea));
    } else if (state.mobile) {
      document.title = title;
      var mobileDomain = state.domainById[state.mobileDomain] || state.domains[0];
      state.mobileDomain = mobileDomain.id;
      var mobileCerts = certsInDomain(mobileDomain.id);
      var mobileTotal = state.certs.filter(function (cert) { return belongs(cert, mobileDomain.id); }).length;
      updateCount(mobileCerts.length, mobileTotal, mobileDomain.shortTitle);
      main.append(renderArea(mobileDomain, mobileCerts));
    } else {
      document.title = title;
      var matched = state.certs.filter(matchesFilters);
      if (state.domain === "all") updateCount(matched.length, state.certs.length);
      else {
        var selected = state.domainById[state.domain];
        var selectedMatch = matched.filter(function (cert) { return belongs(cert, state.domain); });
        var selectedTotal = state.certs.filter(function (cert) { return belongs(cert, state.domain); }).length;
        updateCount(selectedMatch.length, selectedTotal, selected ? selected.shortTitle : "");
        matched = selectedMatch;
      }
      main.append(renderBoard(matched));
    }
    var legend = "A double border means the certification is also drawn into another domain.";
    if (state.route.name === "chart" && !state.mobile) {
      legend += " Choose a domain name to open its sections.";
    }
    main.append(el("p", { class: "legend" }, legend));
    updateHScroll();

    if (state.selectedId && !document.querySelector('[data-cert="' + state.selectedId + '"]')) {
      state.selectedId = null;
      detail.hidden = true;
      backdrop.hidden = true;
    } else {
      setPressed(state.selectedId);
    }
  }

  function hscrollTarget() {
    return document.querySelector(".board") || document.querySelector(".area-band");
  }

  function updateHScroll() {
    var bar = document.getElementById("hscroll");
    var inner = document.getElementById("hscroll-inner");
    var target = hscrollTarget();
    if (!bar || !inner) return;
    if (!target) {
      bar.hidden = true;
      return;
    }
    inner.style.width = target.scrollWidth + "px";
    bar.hidden = target.scrollWidth <= target.clientWidth + 1;
    if (!target._hbound) {
      target.addEventListener("scroll", function () {
        if (hlock) return;
        hlock = true;
        bar.scrollLeft = target.scrollLeft;
        hlock = false;
      });
      target._hbound = true;
    }
    hlock = true;
    bar.scrollLeft = target.scrollLeft;
    hlock = false;
  }

  function bind() {
    searchInput.addEventListener("input", function () {
      state.query = searchInput.value;
      render();
    });
    domainSelect.addEventListener("change", function () {
      state.domain = domainSelect.value;
      render();
    });
    levelSelect.addEventListener("change", function () {
      state.level = levelSelect.value;
      render();
    });
    main.addEventListener("click", function (event) {
      var button = event.target.closest("[data-cert]");
      if (!button || !main.contains(button)) return;
      openDetail(button.getAttribute("data-cert"), button);
    });
    document.getElementById("detail-close").addEventListener("click", closeDetail);
    backdrop.addEventListener("click", closeDetail);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeDetail();
      if (event.key !== "Tab" || detail.hidden) return;
      var focusable = detail.querySelectorAll("button, a");
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    window.addEventListener("hashchange", render);
    window.addEventListener("resize", updateHScroll);
    var hbar = document.getElementById("hscroll");
    hbar.addEventListener("scroll", function () {
      if (hlock) return;
      var target = hscrollTarget();
      if (!target) return;
      hlock = true;
      target.scrollLeft = hbar.scrollLeft;
      hlock = false;
    });
    var media = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 900px)") : null;
    state.mobile = !!(media && media.matches);
    if (media && media.addEventListener) {
      media.addEventListener("change", function (event) {
        state.mobile = event.matches;
        render();
      });
    }
  }

  function fillFilters() {
    var options = [el("option", { value: "all" }, "All domains")];
    state.domains.forEach(function (domain) {
      options.push(el("option", { value: domain.id }, domain.title));
    });
    domainSelect.replaceChildren.apply(domainSelect, options);
    state.levels.forEach(function (level) {
      levelSelect.append(el("option", { value: level.id }, level.label));
    });
  }

  function fail(message) {
    main.replaceChildren(el("p", { class: "loading" }, message));
  }

  fetch("data/domains.json")
    .then(function (response) { if (!response.ok) throw new Error("domains"); return response.json(); })
    .then(function (domainsDoc) {
      return fetch("data/certifications.json").then(function (response) {
        if (!response.ok) throw new Error("certs");
        return response.json().then(function (certs) { return { domainsDoc: domainsDoc, certs: certs }; });
      });
    })
    .then(function (loaded) {
      state.source = loaded.domainsDoc.source || {};
      state.levels = loaded.domainsDoc.levels || [];
      state.domains = loaded.domainsDoc.domains || [];
      state.certs = loaded.certs;
      state.domains.forEach(function (domain) { state.domainById[domain.id] = domain; });
      state.certs.forEach(function (cert) { state.certById[cert.id] = cert; });
      if (state.domains.length) state.mobileDomain = state.domains[0].id;
      fillFilters();
      bind();
      render();
    })
    .catch(function () {
      fail("The certification data could not be loaded. Open this site over HTTP, for example GitHub Pages or python3 -m http.server, then reload.");
    });
})();
