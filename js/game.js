/* The Pale March — typed trail, visible d20, analog horror. No pages. */
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

  const state = {
    name: "UNLOGGED",
    party: [],
    food: 12,
    oil: 8,
    miles: 0,
    loc: "road",
    lastLoc: null,
    marked: false,
    blessed: false,
    viewed: 2,
    moves: 0,
    ended: false,
    busy: false,
    visited: {},
    debug: /[?&]go=1/.test(location.search)
  };

  function you() {
    return String(state.name || "UNLOGGED").replace(/\s+/g, " ").trim().slice(0, 16) || "UNLOGGED";
  }
  function live() { return state.party.filter(function (p) { return p.alive; }); }
  function others() { return state.party.filter(function (p) { return p.alive && !p.you; }); }

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

  function secretRoll(dc) {
    const d = 1 + Math.floor(Math.random() * 20);
    let mod = 0;
    const why = [];
    if (state.food <= 2) { mod -= 2; why.push("starved -2"); }
    if (state.oil <= 0) { mod -= 1; why.push("dark -1"); }
    if (live().length <= 2) { mod -= 1; why.push("thin party -1"); }
    if (state.marked) { mod -= 2; why.push("named -2"); }
    if (state.blessed) { mod += 2; why.push("blessed +2"); }
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
          var line = roll.d + (roll.mod ? (roll.mod > 0 ? "+" + roll.mod : String(roll.mod)) : "") + " = " + roll.total;
          $("die-result").textContent = roll.ok ? line + "  HOLDS" : line + "  TEARS";
          $("die-result").className = "die-result " + (roll.ok ? "hit" : "miss");
          journal("d20 " + roll.d + " vs " + roll.dc + (roll.mod ? " (" + roll.mod + ")" : "") + " → " + (roll.ok ? "HOLDS" : "TEARS"), "roll");
          resolve();
        }
      }, 65);
    });
  }

  function intent(raw) {
    const t = String(raw || "").toLowerCase();
    if (!t.trim()) return "wait";
    if (you() !== "UNLOGGED" && t.indexOf(you().toLowerCase()) !== -1) state.marked = true;
    if (/\b(go back|rewind|turn back|previous)\b/.test(t)) return "back";
    if (/\b(look away|don't look|do not look|cover (my )?eyes|avert)\b/.test(t)) return "avert";
    if (/\b(are you there|who is watching|can you hear|who are you)\b/.test(t)) return "meta";
    if (/\b(inventory|status|supplies)\b/.test(t)) return "status";
    if (/\b(follow|tracks)\b/.test(t)) return "follow";
    if (/\b(ford|cross|wade|swim|river)\b/.test(t)) return "ford";
    if (/\b(hunt|shoot|track|forage)\b/.test(t)) return "hunt";
    if (/\b(camp|rest|sleep|sit|fire)\b/.test(t)) return "camp";
    if (/\b(pray|bless|holy|god|hymn)\b/.test(t)) return "pray";
    if (/\b(run|flee|leave|walk away)\b/.test(t)) return "leave";
    if (/\b(enter|go in|inside|approach)\b/.test(t)) return "enter";
    if (/\b(talk|ask|call|shout|speak|hello)\b/.test(t)) return "talk";
    if (/\b(look|watch|stare|peer|see|inspect|examine|count)\b/.test(t)) return "look";
    if (/\b(continue|keep going|travel|march|forward|onward|wagon|go on)\b/.test(t)) return "travel";
    if (/\b(wait|stay|listen)\b/.test(t)) return "wait";
    if (/\b(attack|kill|burn|destroy)\b/.test(t)) return "attack";
    if (/\b(deliver|offer|give|crate|reliquary)\b/.test(t)) return "deliver";
    return "improv";
  }

  function killOne(reason) {
    const pool = others();
    if (!pool.length) return null;
    const v = pool[Math.floor(Math.random() * pool.length)];
    v.alive = false;
    journal(v.name + " — " + reason, "ghost");
    hud();
    return v;
  }

  function setScene(src, fail) {
    const el = $("tape-scene");
    el.className = "scene " + (fail ? "ken-fail" : "ken");
    el.innerHTML = "";
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
    setTimeout(function () { $("tape-scare").classList.remove("on"); }, 420);
  }

  function cutTo(title, then) {
    $("cut-page").textContent = title;
    $("cut").classList.remove("hidden");
    TapeAudio.hitch();
    setTimeout(function () {
      $("cut").classList.add("hidden");
      then();
    }, 1200);
  }

  function playClip(spec, done) {
    setScene(spec.img, !!spec.fail);
    $("tape-cc").textContent = spec.caption || "";
    $("tape-label").textContent = spec.label || "";
    const wait = spec.fail ? 3000 : 4800;
    if (spec.scare) setTimeout(scare, Math.floor(wait * 0.55));
    setTimeout(done, wait);
  }

  const LOCS = {
    road: {
      name: "THE BLACK ROAD",
      bed: "survey", place: "road", img: IMG.road,
      body: "A wagon. Two horses. Dead trees. Something tall is already in the fog, too far to name.\n\nYou type what the march does. The die decides if the reel allows it. The same sentence can live or drown.",
      caption: "DAY 4  •  THE MARCH",
      acts: {
        travel: { dc: 10, ok: "village", bad: "woods", miles: 12 },
        look: { dc: 9, ok: "gate", bad: "village", scareFail: true },
        camp: { dc: 11, ok: "camp", bad: "fifth" },
        hunt: { dc: 12, ok: "village", bad: "woods", food: 2 },
        leave: { dc: 14, ok: "woods", bad: "figures" },
        talk: { dc: 15, ok: "named", bad: "road" },
        avert: { dc: 11, ok: "village", bad: "gate", scareFail: true },
        improv: { dc: 13, ok: "village", bad: "woods" }
      }
    },
    woods: {
      name: "THE WOODS REPEAT",
      bed: "quiet", place: "woods", img: IMG.woods,
      body: "The same oak. The same rut. Your miles do not agree with the trees.\n\nIf you try to go back, the road will pretend to allow it.",
      caption: "DAY 4  •  AGAIN",
      acts: {
        back: { dc: 14, ok: "road", bad: "figures" },
        travel: { dc: 13, ok: "village", bad: "figures", miles: 5 },
        look: { dc: 10, ok: "camp", bad: "figures", scareFail: true },
        camp: { dc: 12, ok: "camp", bad: "fifth" },
        hunt: { dc: 13, ok: "village", bad: "figures", food: 1 },
        leave: { dc: 12, ok: "ford", bad: "figures" },
        follow: { dc: 13, ok: "camp", bad: "figures" },
        improv: { dc: 14, ok: "camp", bad: "figures" }
      }
    },
    village: {
      name: "CANDLE TOWN",
      bed: "weather", place: "village", img: IMG.village,
      body: "Every window has a candle. Nobody is in the street. Ruts come in. They do not come out.\n\nBirds on the well do not fly.",
      caption: "UNNAMED SETTLEMENT",
      acts: {
        enter: { dc: 12, ok: "chapel", bad: "chapel" },
        travel: { dc: 10, ok: "ford", bad: "woods", miles: 10 },
        leave: { dc: 10, ok: "ford", bad: "woods" },
        look: { dc: 8, ok: "chapel", bad: "figures", scareFail: true },
        talk: { dc: 14, ok: "chapel", bad: "fifth" },
        camp: { dc: 13, ok: "camp", bad: "fifth" },
        pray: { dc: 11, ok: "chapel", bad: "chapel" },
        avert: { dc: 10, ok: "ford", bad: "chapel" },
        improv: { dc: 13, ok: "chapel", bad: "woods" }
      }
    },
    camp: {
      name: "THE FIRE",
      bed: "faith", place: "camp", img: IMG.camp,
      body: "Four of you. The caption may count five.\n\nSomeone is seated just outside the light.",
      caption: "FIVE AT THE FIRE",
      acts: {
        camp: { dc: 12, ok: "ford", bad: "fifth", miles: 6 },
        look: { dc: 10, ok: "fifth", bad: "named", scareFail: true },
        talk: { dc: 14, ok: "fifth", bad: "named" },
        hunt: { dc: 12, ok: "camp", bad: "figures", food: 2 },
        pray: { dc: 11, ok: "chapel", bad: "fifth" },
        leave: { dc: 11, ok: "ford", bad: "woods" },
        avert: { dc: 12, ok: "ford", bad: "fifth" },
        improv: { dc: 13, ok: "ford", bad: "fifth" }
      }
    },
    fifth: {
      name: "THE FIFTH",
      bed: "quiet", place: "camp", img: IMG.camp,
      body: "It has no face you can keep. When you try to describe it, the log writes a name you already used.",
      caption: "DO NOT NAME IT",
      acts: {
        talk: { dc: 16, ok: "named", bad: "named" },
        look: { dc: 8, ok: "named", bad: "figures", scareFail: true },
        attack: { dc: 15, ok: "ford", bad: "figures", killFail: true },
        leave: { dc: 13, ok: "ford", bad: "figures" },
        pray: { dc: 14, ok: "chapel", bad: "named" },
        avert: { dc: 12, ok: "camp", bad: "named" },
        camp: { dc: 14, ok: "named", bad: "named" },
        improv: { dc: 15, ok: "ford", bad: "named" }
      }
    },
    named: {
      name: "IT USED YOUR NAME",
      bed: "sat", place: "tape", img: IMG.figures,
      body: "The fifth does not speak with a mouth. The caption does. It is spelling you.\n\nThe march has stopped being about the crate.",
      caption: "",
      namedCaption: true,
      acts: {
        meta: { dc: 1, ok: "gate", bad: "gate" },
        talk: { dc: 15, ok: "gate", bad: "figures" },
        avert: { dc: 13, ok: "camp", bad: "figures", scareFail: true },
        look: { dc: 9, ok: "figures", bad: "figures", scareFail: true },
        leave: { dc: 16, ok: "road", bad: "figures" },
        improv: { dc: 14, ok: "gate", bad: "figures" }
      }
    },
    chapel: {
      name: "THE SUNK CHAPEL",
      bed: "faith", place: "church", img: IMG.chapel,
      body: "Stone in mud. One candle. No congregation. If you pray, you are asking the same thing the well-birds asked.",
      caption: "UNLIT NAVE",
      acts: {
        pray: { dc: 11, ok: "gate", bad: "figures", bless: true },
        look: { dc: 8, ok: "figures", bad: "figures", scareFail: true },
        enter: { dc: 10, ok: "gate", bad: "figures" },
        leave: { dc: 10, ok: "ford", bad: "woods" },
        talk: { dc: 14, ok: "named", bad: "figures" },
        avert: { dc: 12, ok: "ford", bad: "figures", scareFail: true },
        improv: { dc: 12, ok: "gate", bad: "figures" }
      }
    },
    ford: {
      name: "THE BLACK FORD",
      bed: "survey", place: "river", img: IMG.river,
      body: "The river is not on your map. Faces just under the water, eyes open, not drowning.\n\nWagons have crossed. Wagons are still crossing.",
      caption: "NOT ON THE MAP",
      acts: {
        ford: { dc: 14, ok: "gate", bad: "under", miles: 14, killFail: true },
        look: { dc: 7, ok: "under", bad: "under", scareFail: true },
        avert: { dc: 11, ok: "gate", bad: "under" },
        wait: { dc: 12, ok: "gate", bad: "under" },
        pray: { dc: 12, ok: "gate", bad: "under", bless: true },
        leave: { dc: 13, ok: "woods", bad: "under" },
        travel: { dc: 14, ok: "gate", bad: "under", miles: 14 },
        improv: { dc: 14, ok: "gate", bad: "under" }
      }
    },
    under: {
      name: "UNDER THE LANTERN",
      bed: "quiet", place: "river", img: IMG.river,
      body: "The lantern is still lit. It is under the water and it is still lit.\n\nSomeone is missing from the party line.",
      caption: "LOST AT THE FORD",
      scareOnEnter: true,
      acts: {
        ford: { dc: 16, ok: "gate", bad: "figures", killFail: true },
        look: { dc: 8, ok: "figures", bad: "figures", scareFail: true },
        leave: { dc: 14, ok: "woods", bad: "figures" },
        pray: { dc: 13, ok: "gate", bad: "figures" },
        improv: { dc: 15, ok: "gate", bad: "figures" }
      }
    },
    figures: {
      name: "THEY WERE WAITING",
      bed: "cam3", place: "woods", img: IMG.figures,
      body: "Three of them in lantern light. Mouths open as if a signal is going in. This is not a room you sit in. This is what the march walks into when the die tears.",
      caption: "NOT A STUDIO",
      scareOnEnter: true,
      acts: {
        avert: { dc: 12, ok: "woods", bad: "named", scareFail: true },
        look: { dc: 7, ok: "named", bad: "named", scareFail: true },
        leave: { dc: 14, ok: "ford", bad: "named" },
        talk: { dc: 16, ok: "named", bad: "named" },
        attack: { dc: 16, ok: "gate", bad: "named" },
        improv: { dc: 15, ok: "woods", bad: "named" }
      }
    },
    gate: {
      name: "THE GATE",
      bed: "sat", place: "tower", img: IMG.gate,
      body: "Iron in stone. The crate is at your feet. A pale figure already stands inside, too still.\n\nThis is where the march was supposed to end.",
      caption: "THE FENCE TAKES OFFERINGS",
      acts: {
        deliver: { dc: 15, ok: "end-deliver", bad: "inside" },
        enter: { dc: 14, ok: "inside", bad: "figures" },
        look: { dc: 9, ok: "inside", bad: "inside", scareFail: true },
        attack: { dc: 14, ok: "end-dark", bad: "inside" },
        leave: { dc: 16, ok: "road", bad: "inside" },
        pray: { dc: 13, ok: "end-deliver", bad: "inside", bless: true },
        talk: { dc: 15, ok: "inside", bad: "figures" },
        improv: { dc: 14, ok: "inside", bad: "figures" }
      }
    },
    inside: {
      name: "INSIDE THE GATE",
      bed: "quiet", place: "tower", img: IMG.gate,
      body: "The figure does not come closer. It does not need to. The crate is behind you now, or it is in its hands. You can still type. That is the only door left.",
      caption: "ONE FIGURE",
      scareOnEnter: true,
      acts: {
        deliver: { dc: 16, ok: "end-deliver", bad: "end-tape" },
        look: { dc: 8, ok: "end-tape", bad: "end-tape", scareFail: true },
        avert: { dc: 14, ok: "end-deliver", bad: "end-tape" },
        leave: { dc: 17, ok: "road", bad: "end-tape" },
        attack: { dc: 15, ok: "end-dark", bad: "end-tape" },
        talk: { dc: 14, ok: "named", bad: "end-tape" },
        improv: { dc: 16, ok: "end-deliver", bad: "end-tape" }
      }
    }
  };

  function showLoc(id) {
    const loc = LOCS[id];
    if (!loc) { ending("missing"); return; }
    state.lastLoc = state.loc;
    state.loc = id;
    state.visited[id] = (state.visited[id] || 0) + 1;
    $("place-name").textContent = loc.name;
    $("reel-id").textContent = "REEL  •  " + you();
    setScene(loc.img, false);
    $("tape-cc").textContent = loc.namedCaption ? (you() + ".") : (loc.caption || "");
    $("tape-label").textContent = loc.name;
    $("story").textContent = loc.body;
    if (state.visited[id] > 1) {
      $("story").textContent = loc.body + "\n\nYou have been here. It is not the same recording.";
    }
    TapeAudio.setBed(loc.bed);
    TapeAudio.setPlace(loc.place);
    TapeAudio.setCorruption(Math.min(1, state.moves / 14 + (state.marked ? 0.2 : 0)));
    $("tape-crawl-wrap").classList.add("on");
    $("tape-crawl").textContent = "YOU ARE VIEWER " + state.viewed + "  —  DO NOT REWIND  —  " + you() + " WALKS  —  ";
    if (loc.scareOnEnter) setTimeout(scare, 700);
    hud();
  }

  function ending(kind) {
    if (state.ended) return;
    state.ended = true;
    const n = you();
    const card = $("end-card");
    card.innerHTML = "";
    const code = document.createElement("div"); code.className = "code";
    const h = document.createElement("h1");
    const p = document.createElement("p");
    const p2 = document.createElement("p");
    const again = document.createElement("button");
    again.textContent = "ANOTHER MARCH";
    again.onclick = function () { location.reload(); };
    if (kind === "deliver" || kind === "end-deliver") {
      code.textContent = "THE CRATE";
      h.textContent = "THE GATE TAKES IT";
      p.textContent = "You put the sealed thing through. The figure did not move. In the morning the log lists you as staff on a march that has not ended.";
      p2.textContent = n + ". Then the names you lost. Then " + n + " again.";
      setScene(IMG.gate, false);
      TapeAudio.setBed("shop");
    } else if (kind === "dark" || kind === "end-dark") {
      code.textContent = "BROKEN OFFERING";
      h.textContent = "THE FIGURE KEPT THE LIGHT";
      p.textContent = "You tried to end it. The gate stayed shut from the inside. The log lists you missing and still on the reel.";
      p2.textContent = n + " last seen inside the fence.";
      setScene(IMG.gate, false);
      TapeAudio.txKill();
    } else if (kind === "tape" || kind === "end-tape") {
      code.textContent = "STILL RECORDING";
      h.textContent = "THE TAPE DOES NOT STOP";
      p.textContent = "No more trail. The CRT stays live. Viewer count is 1. That is you. That is also not you.";
      p2.textContent = "Do not rewind.";
      setScene(IMG.figures, false);
    } else if (kind === "missing") {
      code.textContent = "CUT FROM THE REEL";
      h.textContent = "THAT ATTEMPT WAS REMOVED";
      p.textContent = "The thing you typed does not exist on this copy. Someone already took that footage.";
      p2.textContent = "Another march will not have the same ground.";
      setScene(IMG.woods, false);
    } else {
      code.textContent = "WATCHING";
      h.textContent = "YOU WERE NEVER ON THE ROAD";
      p.textContent = "The wagon was a caption. You were sitting in the dark, typing into a log that went out over a dead frequency.";
      p2.textContent = "The march thanks " + n + ".";
      setScene(IMG.figures, false);
    }
    card.appendChild(code); card.appendChild(h); card.appendChild(p); card.appendChild(p2); card.appendChild(again);
    $("end").classList.remove("hidden");
  }

  function applyFx(table, roll) {
    if (roll.ok) {
      if (table.food) state.food += table.food;
      if (table.miles) state.miles += table.miles;
      if (table.bless) state.blessed = true;
      if (table.miles) {
        state.food = Math.max(0, state.food - 1);
        if (state.oil > 0 && Math.random() < 0.35) state.oil -= 1;
      }
    } else {
      state.food = Math.max(0, state.food - 1);
      if (table.killFail || roll.fumble) killOne(roll.fumble ? "the reel skipped" : "the attempt tore");
    }
    hud();
  }

  function goLoc(id) {
    if (!id || String(id).indexOf("end-") === 0) { ending(id || "missing"); return; }
    cutTo(LOCS[id] ? LOCS[id].name : "STATIC", function () { showLoc(id); unlock(); });
  }

  function unlock() {
    state.busy = false;
    $("move-form").classList.remove("busy");
    $("move").focus();
  }

  function submit(text) {
    if (state.ended || state.busy) return;
    const loc = LOCS[state.loc];
    if (!loc) return;
    const raw = String(text || "").trim();
    if (!raw) return;
    state.busy = true;
    $("move-form").classList.add("busy");
    $("move").value = "";

    const act = intent(raw);
    if (act === "status") {
      journal("FOOD " + state.food + " / OIL " + state.oil + " / MILES " + state.miles + " / " + live().map(function (p) { return p.name; }).join(", "));
      unlock();
      return;
    }
    if (act === "back") {
      TapeAudio.hitch();
      journal("YOU TRIED TO REWIND. THE REEL DOES NOT ALLOW IT.", "ghost");
      const dest = state.lastLoc && state.lastLoc !== state.loc ? "woods" : "figures";
      showDie(secretRoll(18)).then(function () {
        playClip({ img: loc.img, fail: true, caption: raw, label: "DO NOT REWIND", scare: true }, function () { goLoc(dest); });
      });
      return;
    }
    if (act === "meta") {
      state.marked = true;
      $("tape-cc").textContent = "YES.";
      journal("THE TAPE ANSWERED.", "ghost");
      showDie({ d: 20, mod: 0, why: [], total: 20, dc: 1, ok: true, crit: true, fumble: false }).then(function () {
        playClip({ img: IMG.figures, caption: "YES.", label: "IT HEARD YOU", scare: false }, function () { goLoc("named"); });
      });
      return;
    }

    const table = loc.acts[act] || loc.acts.improv;
    const roll = secretRoll(table.dc);
    state.moves += 1;
    if (state.moves === 3) journal("A LINE YOU DID NOT WRITE: " + you() + " is already walking.", "hand");
    if (state.moves === 6) state.viewed = 1;

    TapeAudio.hitch();
    applyFx(table, roll);

    const next = roll.ok ? table.ok : table.bad;
    const fail = !roll.ok;
    const clipImg = fail && (next === "figures" || next === "under") ? (next === "under" ? IMG.river : IMG.figures) : loc.img;

    journal(raw, fail ? "ghost" : "");

    if (live().length <= 0) {
      showDie(roll).then(function () {
        playClip({ img: IMG.figures, fail: true, scare: true, caption: raw, label: "NO ONE LEFT" }, function () { ending("tape"); });
      });
      return;
    }

    showDie(roll).then(function () {
      playClip({
        img: clipImg,
        fail: fail,
        scare: !!(fail && (table.scareFail || roll.fumble)),
        caption: raw.toUpperCase(),
        label: fail ? "TEARING  •  " + loc.name : "HOLDING  •  " + loc.name
      }, function () {
        if (roll.fumble && Math.random() < 0.22) goLoc(null);
        else goLoc(next);
      });
    });
  }

  async function codeOk(s) {
    const n = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!n || !crypto.subtle) return false;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(n));
    const hex = Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    return hex === GATE;
  }

  function boot() {
    const card = $("boot-card");
    let step = 0;
    function show() {
      card.innerHTML = "";
      if (step === 0) {
        const h = document.createElement("h1"); h.textContent = "THE PALE MARCH";
        const s = document.createElement("p"); s.textContent = "A recovered reel. You were given a word.";
        const p = document.createElement("p"); p.textContent = "Headphones. Do not rewind.";
        const i = document.createElement("input"); i.placeholder = "THE WORD"; i.autocomplete = "off";
        const err = document.createElement("p");
        const b = document.createElement("button"); b.textContent = "THREAD THE TAPE";
        async function tryCode() {
          const ok = await codeOk(i.value);
          if (ok) { TapeAudio.start(); TapeAudio.beep(700, 0.1, 0.08); step = 1; show(); }
          else { TapeAudio.start(); TapeAudio.beep(140, 0.25, 0.1); err.textContent = "NO CARRIER."; }
        }
        b.onclick = tryCode;
        i.addEventListener("keydown", function (e) { if (e.key === "Enter") tryCode(); });
        card.appendChild(h); card.appendChild(s); card.appendChild(p); card.appendChild(i); card.appendChild(b); card.appendChild(err);
        setTimeout(function () { i.focus(); }, 40);
      } else if (step === 1) {
        const h = document.createElement("h1"); h.textContent = "HOW THIS WORKS";
        const p = document.createElement("p"); p.textContent = "You type what the wagon does. A d20 rolls in the open. Beat the number and the reel holds. Miss and it tears — same words, different ground. There are no correct choices. There are only checks.";
        const b = document.createElement("button"); b.textContent = "NAME THE PARTY";
        b.onclick = function () { step = 2; show(); };
        card.appendChild(h); card.appendChild(p); card.appendChild(b);
      } else if (step === 2) {
        const h = document.createElement("h1"); h.textContent = "NAME THE PARTY";
        const p = document.createElement("p"); p.textContent = "You, then three others. They can be lost. The caption may count an extra.";
        function field(ph) { const i = document.createElement("input"); i.maxLength = 16; i.placeholder = ph; return i; }
        const youI = field("YOUR NAME");
        const a = field("COMPANION 1");
        const b = field("COMPANION 2");
        const c = field("COMPANION 3");
        const go = document.createElement("button"); go.textContent = "START THE REEL";
        go.onclick = function () {
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
        card.appendChild(h); card.appendChild(p); card.appendChild(youI); card.appendChild(a); card.appendChild(b); card.appendChild(c); card.appendChild(go);
        setTimeout(function () { youI.focus(); }, 40);
      }
    }
    if (state.debug) {
      state.name = "VEGA";
      state.party = [
        { name: "VEGA", alive: true, you: true },
        { name: "ELLIS", alive: true },
        { name: "MARROW", alive: true },
        { name: "VESS", alive: true }
      ];
      $("boot").classList.add("hidden");
      $("app").classList.remove("hidden");
      TapeAudio.start();
      start();
      return;
    }
    show();
  }

  function start() {
    Object.keys(IMG).forEach(function (k) { const im = new Image(); im.src = IMG[k]; });
    $("move-form").addEventListener("submit", function (e) {
      e.preventDefault();
      submit($("move").value);
    });
    journal("MARCH BEGINS — " + you());
    journal("The die is in the open. Same words can drown twice.");
    hud();
    showLoc("road");
    $("move").focus();
  }

  boot();
})();
