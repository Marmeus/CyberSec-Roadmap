(function () {
  var state = {
    levels: [],
    areas: [],
    areaById: {},
    certs: [],
    certById: {},
    query: "",
    area: "all",
    domain: "all",
    specialty: "all",
    level: "all",
    route: { name: "chart" },
    selectedId: null,
    groupByDomain: false
  };

  var ALSO_TITLE = "Also placed here";
  var ALSO_NOTE = "These certifications are drawn across this area on the source chart.";

  var main = document.getElementById("main");
  var searchInput = document.getElementById("search");
  var areaSelect = document.getElementById("area");
  var areaField = document.getElementById("area-field");
  var domainSelect = document.getElementById("domain");
  var domainField = document.getElementById("domain-field");
  var specialtySelect = document.getElementById("specialty");
  var specialtyField = document.getElementById("specialty-field");
  var filterToggle = document.getElementById("filter-toggle");
  var domainToggleBtn = document.getElementById("domain-toggle");
  var filterBadge = document.getElementById("filter-badge");
  var filterReset = document.getElementById("filter-reset");
  var toolbar = document.querySelector(".toolbar");
  var levelSelect = document.getElementById("level");
  var countEl = document.getElementById("count");
  var tabsEl = document.getElementById("tabs");
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
    if (match && state.areaById[match[1]]) return { name: "area", id: match[1] };
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

  function domainOf(cert) {
    return findById((state.areaById[cert.area] || {}).domains, cert.domain);
  }

  function specialtyOf(cert) {
    var domain = domainOf(cert);
    return domain ? findById(domain.specialties, cert.specialty) : null;
  }

  function paint(cert) {
    var area = state.areaById[cert.area] || { color: "#444", ink: "#fff" };
    var domain = domainOf(cert);
    var spec = specialtyOf(cert);
    return {
      color: (spec && spec.color) || (domain && domain.color) || area.color,
      ink: (spec && spec.ink) || (domain && domain.ink) || area.ink
    };
  }

  function belongs(cert, areaId) {
    return cert.area === areaId || (cert.crossDomain && cert.areas.indexOf(areaId) !== -1);
  }

  function haystack(cert) {
    var area = state.areaById[cert.area];
    var domain = domainOf(cert);
    var spec = specialtyOf(cert);
    return [
      cert.abbreviation,
      cert.name,
      area ? area.title : "",
      area ? area.title : "",
      domain ? domain.title : "",
      spec ? spec.title : "",
      (cert.details || []).join(" ")
    ].join(" ").toLowerCase();
  }

  function matchesFilters(cert) {
    if (state.level !== "all" && cert.level !== state.level) return false;
    if (state.domain !== "all" && cert.domain !== state.domain) return false;
    if (state.specialty !== "all" && cert.specialty !== state.specialty) return false;
    var query = state.query.trim().toLowerCase();
    if (!query) return true;
    return haystack(cert).indexOf(query) !== -1;
  }

  function updateDomainField() {
    var areaId = state.route.name === "area" ? state.route.id
      : state.area !== "all" ? state.area : null;
    if (!areaId) {
      domainField.hidden = true;
      state.domain = "all";
      return;
    }
    var area = state.areaById[areaId];
    var domains = area ? area.domains : [];
    if (domains.length <= 1) {
      domainField.hidden = true;
      state.domain = "all";
      return;
    }
    if (domainSelect.dataset.area !== areaId) {
      var options = [el("option", { value: "all" }, "All domains")];
      domains.forEach(function (d) {
        options.push(el("option", { value: d.id }, d.title));
      });
      domainSelect.replaceChildren.apply(domainSelect, options);
      domainSelect.dataset.area = areaId;
      state.domain = "all";
      domainSelect.value = "all";
    }
    domainField.hidden = false;
  }

  function updateSpecialtyField() {
    var areaId = state.route.name === "area" ? state.route.id
      : state.area !== "all" ? state.area : null;
    if (!areaId || state.domain === "all") {
      specialtyField.hidden = true;
      state.specialty = "all";
      return;
    }
    var area = state.areaById[areaId];
    var domainObj = area ? findById(area.domains, state.domain) : null;
    var specialties = domainObj ? (domainObj.specialties || []) : [];
    if (!specialties.length) {
      specialtyField.hidden = true;
      state.specialty = "all";
      return;
    }
    if (specialtySelect.dataset.domain !== state.domain) {
      var options = [el("option", { value: "all" }, "All specialties")];
      specialties.forEach(function (s) {
        options.push(el("option", { value: s.id }, s.title));
      });
      specialtySelect.replaceChildren.apply(specialtySelect, options);
      specialtySelect.dataset.domain = state.domain;
      state.specialty = "all";
      specialtySelect.value = "all";
    }
    specialtyField.hidden = false;
  }

  function updateFilterBadge() {
    var active = state.area !== "all" || state.domain !== "all" || state.specialty !== "all" || state.level !== "all";
    filterBadge.hidden = !active;
    filterReset.hidden = !active;
  }

  function byPosition(a, b) {
    return a.abbreviation.localeCompare(b.abbreviation);
  }

  function certsInArea(areaId) {
    return state.certs.filter(function (cert) {
      return belongs(cert, areaId) && matchesFilters(cert);
    });
  }

  function openDetail(id, opener) {
    var cert = state.certById[id];
    if (!cert) return;
    state.selectedId = id;
    lastFocus = opener || document.activeElement;
    var area = state.areaById[cert.area];
    var domain = domainOf(cert);
    var spec = specialtyOf(cert);
    document.getElementById("detail-kicker").textContent = levelLabel(cert.level);
    document.getElementById("detail-title").textContent = cert.abbreviation;
    document.getElementById("detail-name").textContent = cert.name;

    var meta = document.getElementById("detail-meta");
    meta.replaceChildren();
    addMeta(meta, "Area", area ? area.title : cert.area);
    if (area && area.domains.length > 1 && domain) addMeta(meta, "Domain", domain.title);
    if (spec) addMeta(meta, "Specialty", spec.title);
    addMeta(meta, "Level", levelLabel(cert.level));
    if (cert.crossDomain) {
      var others = cert.areas.filter(function (areaId) { return areaId !== cert.area; })
        .map(function (areaId) {
          return state.areaById[areaId] ? state.areaById[areaId].title : areaId;
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
    if (area) {
      if (linkHost.childNodes.length) linkHost.append(document.createTextNode(" · "));
      linkHost.append(el("a", { href: "#/area/" + area.id }, area.title + " area"));
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

  function levelBg(color, level) {
    if (level === "beginner")     return "color-mix(in srgb, " + color + " 40%, white)";
    if (level === "intermediate") return "color-mix(in srgb, " + color + " 70%, white)";
    return color;
  }

  function makeCertButton(cert, className, extra) {
    var colors = paint(cert);
    var button = el("button", {
      type: "button",
      class: className + (cert.crossDomain ? " is-cross" : "") + " cert-" + cert.level,
      "data-cert": cert.id,
      "aria-pressed": cert.id === state.selectedId ? "true" : "false",
      "aria-label": cert.abbreviation + ", " + cert.name + ", " + levelLabel(cert.level)
    });
    if (cert.crossDomain && cert.areas && cert.areas.length > 1) {
      var areaColors = [];
      var homeArea = state.areaById[cert.area];
      if (homeArea) areaColors.push(homeArea.color);
      cert.areas.forEach(function (aid) {
        if (aid === cert.area) return;
        var a = state.areaById[aid];
        if (a && areaColors.indexOf(a.color) === -1) areaColors.push(a.color);
      });
      if (areaColors.length > 1) {
        var stops = [];
        areaColors.forEach(function (c, i) {
          var p1 = (i / areaColors.length * 100).toFixed(1) + "%";
          var p2 = ((i + 1) / areaColors.length * 100).toFixed(1) + "%";
          var mixed = levelBg(c, cert.level);
          stops.push(mixed + " " + p1, mixed + " " + p2);
        });
        button.style.background = "linear-gradient(to right, " + stops.join(", ") + ")";
      } else {
        button.style.background = levelBg(colors.color, cert.level);
      }
    } else {
      button.style.background = levelBg(colors.color, cert.level);
    }
    var whiteAreas = ["management", "operations", "testing"];
    button.style.color = whiteAreas.indexOf(cert.area) !== -1 ? "#ffffff" : "#1c1917";
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

  // Groups an area's certifications by level, then by domain.
  // Certifications from other areas that are drawn into this one go in "Also placed here".
  function levelBlocks(area, certs) {
    var native = certs.filter(function (cert) { return cert.area === area.id; });
    var visitors = certs.filter(function (cert) { return cert.area !== area.id; });
    return state.levels.map(function (level) {
      var blocks = area.domains.map(function (domain) {
        return {
          id: domain.id,
          title: domain.title,
          note: area.domains.length > 1 ? domain.description : "",
          certs: native.filter(function (cert) {
            return cert.level === level.id && cert.domain === domain.id;
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

  // One column per domain. Certifications with no specialty are listed by level.
  // Each specialty comes next, with Expert, Intermediate, and Beginner inside it.
  function renderDomainRow(area, groups, buttonFor) {
    var domainColumns = area.domains.map(function (domain) {
      return { id: domain.id, title: domain.title, note: domain.description || "", specialties: domain.specialties || [] };
    });

    var wrap = el("div", { class: "domain-row-wrap" });
    var isAreaView = state.route.name === "area";
    var row = el("div", { class: "section-row" + (isAreaView && domainColumns.length > 1 ? " section-row--fixed" : "") });
    if (isAreaView && domainColumns.length > 1) {
      row.style.gridTemplateColumns = "repeat(" + domainColumns.length + ", minmax(12rem, 1fr))";
    }

    domainColumns.forEach(function (column) {
      var certs = [];
      groups.forEach(function (group) {
        group.blocks.forEach(function (block) {
          if (block.id === column.id) certs = certs.concat(block.certs);
        });
      });
      if (!certs.length) return;
      var col = el("section", { class: "section-col" });
      col.append(el("h3", null, column.title));
      if (column.note && area.domains.length > 1) {
        col.append(el("p", { class: "section-note" }, column.note));
      }
      var known = column.specialties.map(function (s) { return s.id; });
      appendLevels(col, certs.filter(function (cert) {
        return known.indexOf(cert.specialty) === -1;
      }), buttonFor);
      column.specialties.forEach(function (s) {
        var inSpec = certs.filter(function (cert) { return cert.specialty === s.id; });
        if (!inSpec.length) return;
        col.append(el("h4", { class: "subsection-title" }, s.title));
        appendLevels(col, inSpec, buttonFor, "h5");
      });
      row.append(col);
    });
    wrap.append(row);

    // "Also placed here" rendered as next cell after the last domain column
    var alsoCerts = [];
    groups.forEach(function (group) {
      group.blocks.forEach(function (block) {
        if (block.id === "also") alsoCerts = alsoCerts.concat(block.certs);
      });
    });
    if (alsoCerts.length) {
      var alsoCol = el("section", { class: "section-col section-col--also" });
      var seenAreas = [], colors = [];
      alsoCerts.forEach(function (cert) {
        if (seenAreas.indexOf(cert.area) === -1) {
          seenAreas.push(cert.area);
          var a = state.areaById[cert.area];
          if (a) colors.push(a.color);
        }
      });
      if (colors.length > 0) {
        var stops = [];
        colors.forEach(function (c, i) {
          var p1 = (i / colors.length * 100).toFixed(2) + "%";
          var p2 = ((i + 1) / colors.length * 100).toFixed(2) + "%";
          stops.push(c + " " + p1, c + " " + p2);
        });
        alsoCol.classList.add("section-col--also-gradient");
        alsoCol.style.setProperty("--also-gradient", "linear-gradient(to right, " + stops.join(", ") + ")");
      }
      alsoCol.append(el("h3", null, ALSO_TITLE));
      alsoCol.append(el("p", { class: "section-note" }, ALSO_NOTE));
      appendLevels(alsoCol, alsoCerts, buttonFor);
      row.append(alsoCol);
    }

    return wrap;
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

  function renderColumn(area, certs) {
    var column = el("section", { class: "column" });
    column.style.setProperty("--bar", area.color);
    var title = el("h2", { class: "column-title" }, el("a", {
      href: "#/area/" + area.id
    }, area.title));
    column.append(title);
    var groups = levelBlocks(area, certs);
    if (!groups.length) {
      column.append(el("p", { class: "empty" }, "Nothing matches."));
      return column;
    }
    column.append(renderDomainRow(area, groups, chip));
    return column;
  }

  function renderBoard(list) {
    var shown = state.area === "all"
      ? state.areas
      : state.areas.filter(function (area) { return area.id === state.area; });
    var board = el("div", { class: "board" });
    shown.forEach(function (area) {
      var certs = list.filter(function (cert) { return belongs(cert, area.id); });
      board.append(renderColumn(area, certs));
    });
    return board;
  }

  function renderDomainBoard(list) {
    var board = el("div", { class: "board" });
    var shown = state.area === "all"
      ? state.areas
      : state.areas.filter(function (area) { return area.id === state.area; });

    shown.forEach(function (area) {
      area.domains.forEach(function (domain) {
        var domainCerts = list.filter(function (cert) {
          return cert.area === area.id && cert.domain === domain.id;
        }).sort(byPosition);
        if (!domainCerts.length) return;

        var column = el("section", { class: "column" });
        column.style.setProperty("--bar", domain.color || area.color);
        column.append(
          el("h2", { class: "column-title" },
            el("a", { href: "#/area/" + area.id, title: area.title }, domain.title)
          ),
          el("p", { class: "column-area-label" }, area.title)
        );

        var col = el("section", { class: "section-col" });
        var specialties = domain.specialties || [];
        var known = specialties.map(function (s) { return s.id; });
        appendLevels(col, domainCerts.filter(function (cert) {
          return known.indexOf(cert.specialty) === -1;
        }), chip);
        specialties.forEach(function (s) {
          var inSpec = domainCerts.filter(function (cert) { return cert.specialty === s.id; });
          if (!inSpec.length) return;
          col.append(el("h4", { class: "subsection-title" }, s.title));
          appendLevels(col, inSpec, chip, "h5");
        });
        column.append(col);
        board.append(column);
      });
    });
    return board;
  }

  function renderArea(area, certs) {
    var article = el("article", { class: "area" });
    article.style.setProperty("--bar", area.color);
    article.append(
      el("p", { class: "area-kicker" }, "Area"),
      el("p", { class: "description" }, area.description)
    );
    var groups = levelBlocks(area, certs);
    if (!groups.length) {
      article.append(el("p", { class: "empty" }, "No certifications match these filters."));
      return article;
    }
    var inner = el("div", { class: "area-band-inner" });
    inner.append(
      el("h2", { class: "column-title" }, area.title),
      renderDomainRow(area, groups, card)
    );
    article.append(el("div", { class: "area-band" }, inner));
    return article;
  }

  function lede() {
    var text = "A double border means the certification is also drawn into another area.";
    if (state.route.name === "chart") {
      text += " Choose an area name to open its domains.";
    }
    text += " Certifications are listed alphabetically within each level.";
    text += " Darker shade indicates higher difficulty; lighter shade indicates easier certifications.";
    return el("p", { class: "lede" }, text);
  }

  function renderTabs() {
    var allBtn = el("button", {
      type: "button", class: "tab", role: "tab",
      "aria-selected": state.route.name === "chart" ? "true" : "false",
      id: "tab-all"
    }, "All");
    allBtn.style.setProperty("--bar", "#1b2430");
    allBtn.addEventListener("click", function () { location.hash = "#/"; });

    var areaBtns = state.areas.map(function (area) {
      var selected = state.route.name === "area" && state.route.id === area.id;
      var button = el("button", {
        type: "button", class: "tab", role: "tab",
        "aria-selected": selected ? "true" : "false",
        id: "tab-" + area.id
      }, area.title);
      button.style.setProperty("--bar", area.color);
      button.addEventListener("click", function () { location.hash = "#/area/" + area.id; });
      return button;
    });

    tabsEl.replaceChildren.apply(tabsEl, [allBtn].concat(areaBtns));
  }

  function setupDragScroll() {
    var drag = { on: false, x: 0, y: 0, sl: 0, st: 0, el: null, moved: false };

    main.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (e.target.closest("button, a")) return;
      var scroller = main.querySelector(".board");
      if (!scroller) return;
      drag.on = true;
      drag.moved = false;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.sl = scroller.scrollLeft;
      drag.st = window.scrollY;
      drag.el = scroller;
      main.setPointerCapture(e.pointerId);
      main.style.cursor = "grabbing";
    });

    main.addEventListener("pointermove", function (e) {
      if (!drag.on) return;
      var dx = drag.x - e.clientX;
      var dy = drag.y - e.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      drag.el.scrollLeft = drag.sl + dx;
      window.scrollTo(window.scrollX, drag.st + dy);
    });

    function endDrag(e) {
      if (!drag.on) return;
      drag.on = false;
      main.style.cursor = "";
      try { main.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    main.addEventListener("pointerup", endDrag);
    main.addEventListener("pointercancel", endDrag);

    main.addEventListener("click", function (e) {
      if (drag.moved) { e.stopPropagation(); drag.moved = false; }
    }, true);
  }

  function makeBoardPager(board) {
    var pager = el("div", { class: "board-pager" });
    var prev = el("button", { class: "pager-btn", "aria-label": "Previous", type: "button" }, "←");
    var label = el("span", { class: "pager-label" });
    var next = el("button", { class: "pager-btn", "aria-label": "Next", type: "button" }, "→");
    pager.append(prev, label, next);

    function cols() { return board.querySelectorAll(":scope > .column"); }

    function scrollPos(col) {
      return col.getBoundingClientRect().left - board.getBoundingClientRect().left + board.scrollLeft;
    }

    function getIndex() {
      var cs = cols();
      var sl = board.scrollLeft;
      var best = 0, bestDist = Infinity;
      for (var i = 0; i < cs.length; i++) {
        var d = Math.abs(scrollPos(cs[i]) - sl);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return { i: best, n: cs.length };
    }

    function update() {
      var r = getIndex();
      label.textContent = (r.i + 1) + " / " + r.n;
      prev.disabled = r.i === 0;
      next.disabled = r.i >= r.n - 1;
    }

    board.addEventListener("scroll", update, { passive: true });

    prev.addEventListener("click", function () {
      var r = getIndex(), cs = cols();
      if (r.i > 0) board.scrollTo({ left: scrollPos(cs[r.i - 1]), behavior: "smooth" });
    });
    next.addEventListener("click", function () {
      var r = getIndex(), cs = cols();
      if (r.i < r.n - 1) board.scrollTo({ left: scrollPos(cs[r.i + 1]), behavior: "smooth" });
    });

    update();
    return pager;
  }

  function updateCount(matched, total, label) {
    var text = "Showing " + matched + " of " + total;
    countEl.textContent = label ? text + " in " + label : text + " certifications";
  }

  function render() {
    state.route = parseRoute();
    updateDomainField();
    updateSpecialtyField();
    updateFilterBadge();
    renderTabs();
    areaField.hidden = state.route.name === "area";
    var title = "Security Certification Roadmap";
    main.replaceChildren(lede());

    if (state.route.name === "area") {
      var area = state.areaById[state.route.id];
      document.title = area.title + " · " + title;
      var inArea = certsInArea(area.id);
      var areaTotal = state.certs.filter(function (cert) { return belongs(cert, area.id); }).length;
      updateCount(inArea.length, areaTotal, area.title);
      main.append(renderArea(area, inArea));
    } else {
      document.title = title;
      var matched = state.certs.filter(matchesFilters);
      if (state.area === "all") updateCount(matched.length, state.certs.length);
      else {
        var selected = state.areaById[state.area];
        var selectedMatch = matched.filter(function (cert) { return belongs(cert, state.area); });
        var selectedTotal = state.certs.filter(function (cert) { return belongs(cert, state.area); }).length;
        updateCount(selectedMatch.length, selectedTotal, selected ? selected.title : "");
        matched = selectedMatch;
      }
      var board = state.groupByDomain ? renderDomainBoard(matched) : renderBoard(matched);
      main.append(board, makeBoardPager(board));
    }
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
    return document.querySelector(".board");
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

  function setupTooltip() {
    var tip = document.getElementById("cert-tooltip");
    var autoHideTimer;

    function showTip(btn) {
      var cert = state.certById[btn.getAttribute("data-cert")];
      if (!cert) return;

      tip.querySelector(".tip-name").textContent = cert.name;
      var issuerEl = tip.querySelector(".tip-issuer");
      issuerEl.textContent = cert.issuer || "";
      issuerEl.hidden = !cert.issuer;
      var priceEl = tip.querySelector(".tip-price");
      var price = cert.details && cert.details.length ? cert.details.join(" · ") : "";
      priceEl.textContent = price;
      priceEl.hidden = !price;

      tip.hidden = false;
      var r = btn.getBoundingClientRect();
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var top = r.bottom + 8;
      if (top + h > window.innerHeight - 8) top = r.top - h - 8;
      var left = r.left;
      if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
      if (left < 8) left = 8;
      tip.style.top = top + "px";
      tip.style.left = left + "px";
    }

    function hideTip() {
      clearTimeout(autoHideTimer);
      tip.hidden = true;
    }

    // Desktop: hover
    main.addEventListener("mouseover", function (e) {
      var btn = e.target.closest("[data-cert]");
      if (!btn) { hideTip(); return; }
      showTip(btn);
    });
    main.addEventListener("mouseout", function (e) {
      var btn = e.target.closest("[data-cert]");
      if (!btn || btn.contains(e.relatedTarget)) return;
      hideTip();
    });

    // Mobile/tablet: touch
    main.addEventListener("touchstart", function (e) {
      var btn = e.target.closest("[data-cert]");
      if (!btn) { hideTip(); return; }
      clearTimeout(autoHideTimer);
      showTip(btn);
      autoHideTimer = setTimeout(hideTip, 2500);
    }, { passive: true });
    main.addEventListener("touchmove", hideTip, { passive: true });
  }

  function setupCrossHighlight() {
    var hlTimer;
    function clearHL() {
      main.removeAttribute("data-cross-hl");
      main.querySelectorAll(".is-hl").forEach(function (b) { b.classList.remove("is-hl"); });
      main.querySelectorAll(".is-col-hl").forEach(function (c) { c.classList.remove("is-col-hl"); });
    }
    main.addEventListener("mouseover", function (e) {
      var btn = e.target.closest("[data-cert]");
      if (!btn || !main.contains(btn)) return;
      var certId = btn.getAttribute("data-cert");
      var cert = state.certById[certId];
      clearTimeout(hlTimer);
      if (!cert || !cert.crossDomain) { clearHL(); return; }
      var all = main.querySelectorAll('[data-cert="' + certId + '"]');
      if (all.length < 2) { clearHL(); return; }
      clearHL();
      main.setAttribute("data-cross-hl", "1");
      all.forEach(function (b) {
        b.classList.add("is-hl");
        var col = b.closest(".column");
        if (col) col.classList.add("is-col-hl");
      });
    });
    main.addEventListener("mouseout", function (e) {
      var btn = e.target.closest("[data-cert]");
      if (!btn || !main.contains(btn)) return;
      if (btn.contains(e.relatedTarget)) return;
      hlTimer = setTimeout(clearHL, 80);
    });
  }

  function bind() {
    filterToggle.addEventListener("click", function () {
      var open = toolbar.classList.toggle("filters-open");
      filterToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    domainToggleBtn.addEventListener("click", function () {
      state.groupByDomain = !state.groupByDomain;
      domainToggleBtn.setAttribute("aria-pressed", state.groupByDomain ? "true" : "false");
      domainToggleBtn.classList.toggle("is-active", state.groupByDomain);
      if (state.route.name === "area") {
        location.hash = "#/";
      } else {
        render();
      }
    });
    searchInput.addEventListener("input", function () {
      state.query = searchInput.value;
      render();
    });
    areaSelect.addEventListener("change", function () {
      state.area = areaSelect.value;
      state.domain = "all";
      state.specialty = "all";
      render();
    });
    domainSelect.addEventListener("change", function () {
      state.domain = domainSelect.value;
      state.specialty = "all";
      render();
    });
    specialtySelect.addEventListener("change", function () {
      state.specialty = specialtySelect.value;
      render();
    });
    levelSelect.addEventListener("change", function () {
      state.level = levelSelect.value;
      render();
    });
    filterReset.addEventListener("click", function () {
      state.area = "all";
      state.domain = "all";
      state.specialty = "all";
      state.level = "all";
      areaSelect.value = "all";
      levelSelect.value = "all";
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
    setupDragScroll();
    setupTooltip();
    setupCrossHighlight();
    var hbar = document.getElementById("hscroll");
    hbar.addEventListener("scroll", function () {
      if (hlock) return;
      var target = hscrollTarget();
      if (!target) return;
      hlock = true;
      target.scrollLeft = hbar.scrollLeft;
      hlock = false;
    });
  }

  function fillAreaFilter() {
    var options = [el("option", { value: "all" }, "All areas")];
    state.areas.forEach(function (area) {
      options.push(el("option", { value: area.id }, area.title));
    });
    areaSelect.replaceChildren.apply(areaSelect, options);
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
      state.levels = loaded.domainsDoc.levels || [];
      state.areas = loaded.domainsDoc.areas || [];
      state.certs = loaded.certs;
      state.areas.forEach(function (area) { state.areaById[area.id] = area; });
      state.certs.forEach(function (cert) { state.certById[cert.id] = cert; });
      fillAreaFilter();
      bind();
      render();
    })
    .catch(function () {
      fail("The certification data could not be loaded.");
    });
})();
