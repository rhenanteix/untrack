/* LinkOr Pixel 1.0.0 — memory only, explicit analytics consent. */
(function (w, d) {
  "use strict";
  var script = d.currentScript;
  if (!script) return;
  var site = script.getAttribute("data-site-id");
  if (!site || !/^[a-zA-Z0-9_-]{1,128}$/.test(site)) return;
  if (w.LinkOr && w.LinkOr.version) {
    w.LinkOr.duplicate();
    return;
  }
  var endpoint = new URL("/api/connect/public/" + site, script.src).href;
  var consent = false,
    queue = [],
    active = null,
    timer = null,
    generation = 0;
  var lastPage = null,
    duplicate = false,
    diagnosticSent = false;
  var debug = script.getAttribute("data-debug") === "true";
  var testId = new URL(w.location.href).searchParams.get("linkor_test");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      testId || "",
    )
  )
    testId = null;
  var testSent = false;
  var goals = ["quote", "whatsapp", "appointment", "registration"];
  function allowed() {
    return (
      consent &&
      w.navigator.doNotTrack !== "1" &&
      w.navigator.globalPrivacyControl !== true
    );
  }
  function log(code) {
    if (debug && w.console) w.console.info("[LinkOr] " + code);
  }
  function emit(name, properties) {
    if (!allowed() || queue.length >= 50 || !w.crypto || !w.crypto.randomUUID)
      return false;
    queue.push({
      event: {
        event_id: w.crypto.randomUUID(),
        event_name: name,
        event_version: 1,
        occurred_at: new Date().toISOString(),
        properties: properties || {},
        consent_context: { analytics: "granted" },
      },
      attempts: 0,
      created: Date.now(),
    });
    pump();
    return true;
  }
  function pump() {
    if (!allowed() || active || timer || !queue.length) return;
    var item = queue[0];
    if (Date.now() - item.created > 60000) {
      queue.shift();
      pump();
      return;
    }
    var epoch = generation;
    var controller = new AbortController();
    active = controller;
    item.attempts++;
    var timeout = w.setTimeout(function () {
      controller.abort();
    }, 5000);
    w.fetch(endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.event),
      signal: controller.signal,
      keepalive: true,
    })
      .then(function (response) {
        if (response.status === 429 || response.status >= 500)
          throw new Error("transient");
        if (epoch !== generation) return;
        queue.shift();
        log(response.ok ? "received" : "rejected");
      })
      .catch(function () {
        if (epoch !== generation) return;
        if (item.attempts >= 3) {
          queue.shift();
          log("delivery_failed");
        } else
          timer = w.setTimeout(
            function () {
              timer = null;
              pump();
            },
            500 * Math.pow(2, item.attempts),
          );
      })
      .finally(function () {
        w.clearTimeout(timeout);
        if (epoch !== generation) return;
        active = null;
        pump();
      });
  }
  function page() {
    if (!allowed()) return;
    // Kept only in memory for navigation deduplication; never transmitted.
    var key = w.location.pathname + w.location.search + w.location.hash;
    if (key === lastPage) return;
    lastPage = key;
    emit("page_view");
  }
  function diagnostics() {
    if (duplicate && !diagnosticSent && allowed())
      diagnosticSent = emit("pixel_diagnostic", {
        reason: "duplicate_installation",
      });
  }
  function setConsent(value) {
    consent = value === "granted";
    if (!allowed()) {
      generation++;
      queue = [];
      w.clearTimeout(timer);
      timer = null;
      if (active) active.abort();
      active = null;
      log("consent_blocked");
      return;
    }
    page();
    diagnostics();
    if (testId && !testSent) testSent = emit("pixel_test", { test_id: testId });
    pump();
  }
  w.LinkOr = {
    version: "1.0.0",
    consent: setConsent,
    debug: function (enabled) {
      debug = enabled === true;
    },
    duplicate: function () {
      duplicate = true;
      log("duplicate_installation");
      diagnostics();
    },
    track: function (name, options) {
      if (
        ["page_view", "link_click", "cta_click", "custom_event"].indexOf(name) <
        0
      )
        return false;
      if (name === "page_view") {
        page();
        return allowed();
      }
      var properties = {};
      if (
        options &&
        options.goal &&
        (name === "cta_click" || name === "custom_event")
      ) {
        if (goals.indexOf(options.goal) < 0) return false;
        properties.goal = options.goal;
      }
      return emit(name, properties);
    },
    test: function (id) {
      return (
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id || "",
        ) && emit("pixel_test", { test_id: id })
      );
    },
  };
  d.addEventListener(
    "click",
    function (event) {
      if (!allowed() || !event.isTrusted) return;
      var target =
        event.target && event.target.closest
          ? event.target.closest(
              "[data-linkor-goal],a[href],button[data-linkor-cta]",
            )
          : null;
      if (!target) return;
      var goal = target.getAttribute("data-linkor-goal");
      if (goals.indexOf(goal) >= 0) emit("cta_click", { goal: goal });
      else if (target.hasAttribute("data-linkor-cta")) emit("cta_click");
      else if (target.tagName === "A") emit("link_click");
    },
    true,
  );
  ["pushState", "replaceState"].forEach(function (method) {
    var original = w.history[method];
    w.history[method] = function () {
      var result = original.apply(this, arguments);
      page();
      return result;
    };
  });
  w.addEventListener("popstate", page);
  w.addEventListener("hashchange", page);
  w.addEventListener("linkor:consent", function (event) {
    setConsent(event.detail && event.detail.analytics);
  });
  // CMP must update this value on every choice, including withdrawal.
  setConsent(w.LinkOrConsent);
})(window, document);
