/* The Pale March — freeform referee. Die is local and honest. */
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const GATE = "5ff171d62e4d576f6e870020a480f1acac85e8b3f9a2950fd27c73cd632e1897";
  const IMG = {
    road: "assets/road.jpg",
    woods: "assets/woods.jpg",
    village: "assets/village.jpg",
    camp: "assets/camp.jpg",
    river: "assets/river.jpg",
    chapel: "assets/chapel.jpg",
    gate: "assets/gate.jpg",
    figures: "assets/figures.jpg"
  };
  const BEDS = {
    road: "survey", woods: "quiet", village: "weather", camp: "faith",
    river: "survey", chapel: "faith", gate: "sat", figures: "cam3"
  };

  const state = {
    name: "UNLOGGED",
    party: [],
    food: 12,
    oil: 8,
    miles: 0,
    place: "road",
    marked: false,
    viewed: 2,
    moves: 0,
    ended: false,
    busy: false,
    history: [],
    apiKey: "",
    useProxy: false,
    debug: /[?&]go=1/.test(location.search)
  };

  function you() {
    return String(state.name || "UNLOGGED").replace(/\s+/g, " ").trim().slice(0, 16) || "UNLOGGED";
  }
  function live() { return state.party.filter(function (p) { return p.alive; }); }

  function journal(text, cls) {
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = text;
    $("log").appendChild(line);
    $("log").scrollTop = $("log").scrollHeight;
  }

  function hud() {
    $("pill-food").textContent = "FOOD " + state.food;
    $("pill-food").className = "pill " + (state.food <= 2 ? "alarm" : "on");
    $("pill-oil").textContent = "OIL " + state.oil;
    $("pill-oil").className = "pill " + (state.oil <= 1 ? "warn" : "on");
    $("pill-miles").textContent = "MILES " + state.miles;
    $("pill-party").textContent = "PARTY " + live().length;
    $("pill-party").className = "pill " + (live().length <= 2 ? "warn" : "on");
    $("party-line").textContent = state.party.map(function (p) {
      return p.alive ? p.name : p.name + " (GONE)";
    }).join("  •  ");
  }

  function rollDie(dc) {
    const d = 1 + Math.floor(Math.random() * 20);
    let mod = 0;
    const why = [];
    if (state.food <= 2) { mod -= 2; why.push("starved -2"); }
    if (state.oil <= 0) { mod -= 1; why.push("dark -1"); }
    if (live().length <= 2) { mod -= 1; why.push("thin -1"); }
    if (state.marked) { mod -= 2; why.push("named -2"); }
    const total = d + mod;
    const fumble = d === 1;
    const crit = d === 20;
    return {
      d: d, mod: mod, why: why, total: total, dc: dc,
      ok: crit || (!fumble && total >= dc), crit: crit, fumble: fumble
    };
  }

  function showDie(roll) {
    return new Promise(function (resolve) {
      const el = $("die");
      el.className = "die rolling";
      $("die-need").textContent = "need " + roll.dc;
      $("die-mod").textContent = roll.why.length ? roll.why.join(" · ") : "mod 0";
      $("die-result").textContent = "";
      $("die-result").className = "die-result";
      let n = 0;
      const iv = setInterval(function () {
        el.textContent = String(1 + Math.floor(Math.random() * 20));
        n += 1;
        if (n >= 14) {
          clearInterval(iv);
          el.textContent = String(roll.d);
          el.className = "die " + (roll.ok ? "hit" : "miss");
          const line = roll.d + (roll.mod ? (roll.mod > 0 ? "+" + roll.mod : String(roll.mod)) : "") + " = " + roll.total;
          $("die-result").textContent = roll.ok ? line + "  HOLDS" : line + "  TEARS";
          $("die-result").className = "die-result " + (roll.ok ? "hit" : "miss");
          journal("d20 " + roll.d + " vs " + roll.dc + " → " + (roll.ok ? "HOLDS" : "TEARS"), "roll");
          resolve();
        }
      }, 65);
    });
  }

  function setScene(src, fail) {
    const el = $("tape-scene");
    el.className = "scene " + (fail ? "ken-fail" : "ken");
    while (el.firstChild) el.removeChild(el.firstChild);
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    el.appendChild(img);
  }

  function scare() {
    TapeAudio.stinger();
    TapeAudio.setPlace("scare");
    $("tape-flash").style.opacity = "1";
    $("tape-scare").style.backgroundImage = "url(" + IMG.figures + ")";
    $("tape-scare").classList.add("on");
    setTimeout(function () { $("tape-flash").style.opacity = "0"; }, 70);
    setTimeout(function () { $("tape-scare").classList.remove("on"); }, 480);
  }

  function cutTo(title, then) {
    $("cut-page").textContent = title || "";
    $("cut").classList.remove("hidden");
    TapeAudio.hitch();
    setTimeout(function () {
      $("cut").classList.add("hidden");
      if (then) then();
    }, 900);
  }

  function snapshot() {
    return {
      name: you(),
      party: state.party.map(function (p) { return { name: p.name, alive: p.alive, you: !!p.you }; }),
      food: state.food,
      oil: state.oil,
      miles: state.miles,
      place: state.place,
      viewed: state.viewed,
      marked: state.marked
    };
  }

  function parseModelJson(text) {
    if (!text) throw new Error("empty");
    var s = String(text).trim();
    var fence = s.match(/\{[\s\S]*\}/);
    if (fence) s = fence[0];
    return JSON.parse(s);
  }

  function buildMessages(phase, action, roll) {
    var hist = state.history.slice(-8).map(function (h) {
      return "PLAYER: " + h.action + "\nREEL: " + h.scene;
    }).join("\n---\n");
    var user = [
      "PHASE: " + phase,
      "ACTION: " + action,
      "STATE: " + JSON.stringify(snapshot()),
      roll ? ("ROLL: " + JSON.stringify(roll)) : "ROLL: none yet",
      hist ? ("RECENT:\n" + hist) : "RECENT: start of reel"
    ].join("\n");
    return [
      { role: "system", content: window.MARCH_PROMPT },
      { role: "user", content: user }
    ];
  }

  function askModel(messages) {
    if (state.useProxy) {
      return fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok) throw new Error(x.j && x.j.error ? x.j.error : "proxy");
          return parseModelJson(x.j.text);
        });
    }
    return fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + state.apiKey
      },
      body: JSON.stringify({ model: "grok-4.6", temperature: 0.9, messages: messages })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) throw new Error((x.j && x.j.error && x.j.error.message) || "upstream");
        return parseModelJson(x.j.choices[0].message.content);
      });
  }

  function applyScene(data, fail) {
    var place = (data.place && IMG[data.place]) ? data.place : state.place;
    if (place !== state.place) {
      state.place = place;
      cutTo(data.place_title || place.toUpperCase());
    }
    setScene(IMG[place] || IMG.road, !!fail);
    $("place-name").textContent = data.place_title || place.replace(/_/g, " ").toUpperCase();
    $("tape-label").textContent = $("place-name").textContent;
    $("tape-cc").textContent = data.caption || "";
    $("story").textContent = data.scene || "";
    $("tape-crawl-wrap").classList.add("on");
    $("tape-crawl").textContent = (data.crawl || ("YOU ARE VIEWER " + state.viewed + "  —  DO NOT REWIND  —  " + you() + " WALKS  —  "));
    if (typeof data.food === "number") state.food = Math.max(0, data.food);
    if (typeof data.oil === "number") state.oil = Math.max(0, data.oil);
    if (typeof data.miles === "number") state.miles = Math.max(0, data.miles);
    if (data.deaths && data.deaths.length) {
      data.deaths.forEach(function (nm) {
        state.party.forEach(function (p) {
          if (p.alive && p.name.toUpperCase() === String(nm).toUpperCase() && !p.you) {
            p.alive = false;
            journal(p.name + " is gone from the frame.", "ghost");
          }
        });
      });
    }
    if (data.log) journal(data.log, fail ? "ghost" : "");
    TapeAudio.setBed(BEDS[place] || "survey");
    TapeAudio.setPlace(place === "figures" ? "woods" : place);
    TapeAudio.setCorruption(Math.min(1, state.moves / 16));
    if (data.scare) scare();
    hud();
    if (data.ending) ending(data);
  }

  function ending(data) {
    if (state.ended) return;
    state.ended = true;
    var card = $("end-card");
    while (card.firstChild) card.removeChild(card.firstChild);
    var code = document.createElement("div"); code.className = "code";
    code.textContent = (data.ending || "END").toString().toUpperCase();
    var h = document.createElement("h1");
    h.textContent = data.ending_title || "THE REEL STOPS";
    var p = document.createElement("p");
    p.textContent = data.ending_body || data.scene || "The tape runs out.";
    var again = document.createElement("button");
    again.textContent = "ANOTHER MARCH";
    again.onclick = function () { location.reload(); };
    card.appendChild(code); card.appendChild(h); card.appendChild(p); card.appendChild(again);
    $("end").classList.remove("hidden");
  }

  function lock() { state.busy = true; $("move-form").classList.add("busy"); }
  function unlock() {
    state.busy = false;
    $("move-form").classList.remove("busy");
    $("die-need").textContent = $("die-need").textContent || "d20";
    $("move").focus();
  }

  function submit(text) {
    if (state.ended || state.busy) return;
    var raw = String(text || "").trim();
    if (!raw) return;
    if (/^\s*(inventory|status|supplies)\s*$/i.test(raw)) {
      journal("FOOD " + state.food + " / OIL " + state.oil + " / MILES " + state.miles + " / " + live().map(function (p) { return p.name; }).join(", "));
      return;
    }
    lock();
    $("move").value = "";
    $("die").className = "die";
    $("die").textContent = "…";
    $("die-need").textContent = "listening";
    $("die-result").textContent = "";
    TapeAudio.hitch();
    state.moves += 1;
    if (state.moves === 6) state.viewed = 1;

    askModel(buildMessages("declare", raw, null)).then(function (dec) {
      if (dec.need_roll === false) {
        applyScene(dec, false);
        state.history.push({ action: raw, scene: (dec.scene || "").slice(0, 400) });
        unlock();
        return null;
      }
      var dc = typeof dec.dc === "number" ? dec.dc : 12;
      if (dec.check) $("die-mod").textContent = String(dec.check);
      var roll = rollDie(dc);
      return showDie(roll).then(function () {
        return askModel(buildMessages("resolve", raw, roll)).then(function (res) {
          applyScene(res, !roll.ok);
          state.history.push({ action: raw, scene: (res.scene || "").slice(0, 400) });
          if (!res.ending) unlock();
        });
      });
    }).catch(function (err) {
      journal("THE TAPE DROPS OUT. " + (err && err.message ? err.message : "no carrier"), "ghost");
      $("die").textContent = "—";
      $("die-need").textContent = "d20";
      unlock();
    });
  }

  async function codeOk(s) {
    var n = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!n || !crypto.subtle) return false;
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(n));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("") === GATE;
  }

  function opening() {
    setScene(IMG.road, false);
    $("place-name").textContent = "THE BLACK ROAD";
    $("tape-label").textContent = "THE BLACK ROAD";
    $("tape-cc").textContent = "DAY 4  •  THE MARCH";
    $("story").textContent = "Fog on a black road. The crate is lashed in the wagon like it might breathe. Something tall is already ahead, too far to be a man and too still to be a tree.\n\nThe reel is waiting for you to speak. Not a menu. Not a page. What do you do?";
    $("tape-crawl-wrap").classList.add("on");
    $("tape-crawl").textContent = "YOU ARE VIEWER " + state.viewed + "  —  DO NOT REWIND  —  " + you() + " WALKS  —  ";
    TapeAudio.setBed("survey");
    TapeAudio.setPlace("road");
    hud();
  }

  function start() {
    Object.keys(IMG).forEach(function (k) { var im = new Image(); im.src = IMG[k]; });
    $("move-form").addEventListener("submit", function (e) {
      e.preventDefault();
      submit($("move").value);
    });
    journal("MARCH BEGINS — " + you());
    journal("The die is honest. The referee is not.");
    opening();
    $("move").focus();
  }

  function probeProxy() {
    return fetch("/api/health").then(function (r) { return r.ok ? r.json() : { dm: false }; }).catch(function () { return { dm: false }; });
  }

  function boot() {
    var card = $("boot-card");
    var step = 0;
    function show() {
      while (card.firstChild) card.removeChild(card.firstChild);
      if (step === 0) {
        var h = document.createElement("h1"); h.textContent = "THE PALE MARCH";
        var p = document.createElement("p"); p.textContent = "A recovered reel. You were given a word. Headphones.";
        var i = document.createElement("input"); i.placeholder = "THE WORD"; i.autocomplete = "off";
        var err = document.createElement("p");
        var b = document.createElement("button"); b.textContent = "THREAD THE TAPE";
        async function tryCode() {
          if (await codeOk(i.value)) { TapeAudio.start(); TapeAudio.beep(700, 0.1, 0.08); step = 1; show(); }
          else { TapeAudio.start(); TapeAudio.beep(140, 0.25, 0.1); err.textContent = "NO CARRIER."; }
        }
        b.onclick = tryCode;
        i.addEventListener("keydown", function (e) { if (e.key === "Enter") tryCode(); });
        card.appendChild(h); card.appendChild(p); card.appendChild(i); card.appendChild(b); card.appendChild(err);
        setTimeout(function () { i.focus(); }, 40);
      } else if (step === 1) {
        var h1 = document.createElement("h1"); h1.textContent = "THE REFEREE";
        var p1 = document.createElement("p");
        p1.textContent = "There is no list of right moves. You say what the wagon does. If it is dangerous, a d20 rolls in the open. The reel describes what the valley does with that number.";
        var go = document.createElement("button"); go.textContent = "CONTINUE";
        go.onclick = function () { step = 2; show(); };
        card.appendChild(h1); card.appendChild(p1); card.appendChild(go);
      } else if (step === 2) {
        probeProxy().then(function (hth) {
          if (hth && hth.dm) { state.useProxy = true; step = 3; show(); return; }
          var h2 = document.createElement("h1"); h2.textContent = "DM KEY";
          var p2 = document.createElement("p");
          p2.textContent = "The referee is Grok. Paste an xAI API key from console.x.ai. It stays in this tab only. Or run server.py with XAI_API_KEY in .env and skip this.";
          var i2 = document.createElement("input"); i2.type = "password"; i2.placeholder = "XAI_API_KEY"; i2.autocomplete = "off";
          var err2 = document.createElement("p");
          var b2 = document.createElement("button"); b2.textContent = "BIND THE KEY";
          b2.onclick = function () {
            var k = i2.value.trim();
            if (k.length < 8) { err2.textContent = "THAT IS NOT A KEY."; return; }
            state.apiKey = k;
            step = 3; show();
          };
          card.appendChild(h2); card.appendChild(p2); card.appendChild(i2); card.appendChild(b2); card.appendChild(err2);
          setTimeout(function () { i2.focus(); }, 40);
        });
      } else if (step === 3) {
        var h3 = document.createElement("h1"); h3.textContent = "NAME THE PARTY";
        var p3 = document.createElement("p"); p3.textContent = "You, then three others. They can be lost.";
        function field(ph) { var i = document.createElement("input"); i.maxLength = 16; i.placeholder = ph; return i; }
        var youI = field("YOUR NAME");
        var a = field("COMPANION 1");
        var b = field("COMPANION 2");
        var c = field("COMPANION 3");
        var go3 = document.createElement("button"); go3.textContent = "START THE REEL";
        go3.onclick = function () {
          state.name = (youI.value || "UNLOGGED").replace(/[<>]/g, "").trim().toUpperCase().slice(0, 16) || "UNLOGGED";
          state.party = [
            { name: state.name, alive: true, you: true },
            { name: (a.value || "ELLIS").replace(/[<>]/g, "").trim().toUpperCase().slice(0, 16), alive: true },
            { name: (b.value || "MARROW").replace(/[<>]/g, "").trim().toUpperCase().slice(0, 16), alive: true },
            { name: (c.value || "VESS").replace(/[<>]/g, "").trim().toUpperCase().slice(0, 16), alive: true }
          ];
          $("boot").classList.add("hidden");
          $("app").classList.remove("hidden");
          start();
        };
        card.appendChild(h3); card.appendChild(p3); card.appendChild(youI); card.appendChild(a); card.appendChild(b); card.appendChild(c); card.appendChild(go3);
        setTimeout(function () { youI.focus(); }, 40);
      }
    }
    show();
  }

  boot();
})();
