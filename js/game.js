/* WQRT-12 Provincial Survey — analog CYOA. Hidden d20. Typed intent. */
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const GATE = "ad472ef360d068c68d7c8fe31a08ecc03a7c29e9c878cc6235387920473b7ccf";
  const IMAGES = {
    road: "assets/survey-road.jpg",
    river: "assets/survey-river.jpg",
    camp: "assets/survey-camp.jpg",
    village: "assets/village.jpg",
    church: "assets/church-empty.jpg",
    pastor: "assets/church-pastor.jpg",
    tower: "assets/tower.jpg",
    fence: "assets/tower-figure.jpg",
    studio: "assets/cam3-empty.jpg",
    occupied: "assets/cam3-occupied.jpg",
    ray: "assets/cam3-ray.jpg",
    sat: "assets/sat-ray.jpg",
    satEmpty: "assets/sat-empty.jpg",
    door: "assets/door.jpg",
    parking: "assets/parking.jpg",
    shop: "assets/shop-empty.jpg",
    polaroid: "assets/ray.jpg"
  };

  const state = {
    name: "UNLOGGED",
    party: [],
    food: 12,
    oil: 8,
    miles: 0,
    page: 12,
    lastPage: null,
    marked: false,
    blessed: false,
    viewed: 2,
    moves: 0,
    ended: false,
    busy: false,
    ghosted: false,
    visited: {},
    debug: /[?&]go=1/.test(location.search)
  };

  function escapeName() {
    return String(state.name || "UNLOGGED").replace(/\s+/g, " ").trim().slice(0, 22) || "UNLOGGED";
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
    if (state.food <= 2) mod -= 2;
    if (state.oil <= 0) mod -= 1;
    if (live().length <= 2) mod -= 1;
    if (state.marked) mod -= 2;
    if (state.blessed) mod += 2;
    const total = d + mod;
    const fumble = d === 1;
    const crit = d === 20;
    return { d: d, mod: mod, total: total, dc: dc, ok: crit || (!fumble && total >= dc), crit: crit, fumble: fumble };
  }

  function intent(raw) {
    const t = String(raw || "").toLowerCase();
    if (!t.trim()) return "wait";
    if (t.indexOf(escapeName().toLowerCase()) !== -1 && escapeName() !== "UNLOGGED") state.marked = true;
    if (/\b(go back|rewind|turn back|previous page|last page)\b/.test(t)) return "back";
    if (/\b(look away|don't look|do not look|cover (my )?eyes|avert)\b/.test(t)) return "avert";
    if (/\b(are you there|who is watching|can you hear|who are you)\b/.test(t)) return "meta";
    if (/\b(inventory|status|supplies|how many)\b/.test(t)) return "status";
    if (/\b(follow|tracks)\b/.test(t)) return "follow";
    if (/\b(ford|cross|wade|swim|river)\b/.test(t)) return "ford";
    if (/\b(hunt|shoot|track|forage)\b/.test(t)) return "hunt";
    if (/\b(camp|rest|sleep|sit|fire)\b/.test(t)) return "camp";
    if (/\b(pray|bless|holy|god|hymn)\b/.test(t)) return "pray";
    if (/\b(run|flee|leave|walk away)\b/.test(t)) return "leave";
    if (/\b(enter|go in|inside|approach)\b/.test(t)) return "enter";
    if (/\b(talk|ask|call|shout|speak|hello|who is)\b/.test(t)) return "talk";
    if (/\b(look|watch|stare|peer|see|inspect|examine|count)\b/.test(t)) return "look";
    if (/\b(continue|keep going|travel|march|forward|onward|wagon|go on)\b/.test(t)) return "travel";
    if (/\b(wait|stay|listen|nothing)\b/.test(t)) return "wait";
    if (/\b(attack|kill|burn|destroy|shoot it)\b/.test(t)) return "attack";
    if (/\b(deliver|offer|give|reliquary)\b/.test(t)) return "deliver";
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
    WQRTAudio.stinger();
    WQRTAudio.setPlace("scare");
    $("tape-flash").style.opacity = "1";
    $("tape-scare").style.backgroundImage = "url(" + IMAGES.occupied + ")";
    $("tape-scare").classList.add("on");
    setTimeout(function () { $("tape-flash").style.opacity = "0"; }, 70);
    setTimeout(function () { $("tape-scare").classList.remove("on"); }, 420);
  }

  function cutTo(page, then) {
    const shown = Math.random() < 0.18 ? page + 7 : page;
    $("cut-page").textContent = "TURN TO PAGE " + shown;
    $("cut").classList.remove("hidden");
    WQRTAudio.hitch();
    setTimeout(function () {
      if (shown !== page) $("cut-page").textContent = "TURN TO PAGE " + page;
    }, 500);
    setTimeout(function () {
      $("cut").classList.add("hidden");
      then();
    }, 1300);
  }

  function playClip(spec, done) {
    setScene(spec.img, !!spec.fail);
    $("tape-cc").textContent = spec.caption || "";
    $("tape-label").textContent = spec.label || "";
    const wait = spec.fail ? 3200 : 5200;
    if (spec.scare) setTimeout(scare, Math.floor(wait * 0.55));
    setTimeout(done, wait);
  }

  const NODES = {
    12: {
      title: "THE ROAD",
      bed: "survey", place: "road", img: IMAGES.road,
      body: "A wagon on a black road. Two horses. Dead trees. Something tall is already in the fog ahead, too far to name.\n\nThis printing does not tell you what to do. It waits for you to write it.",
      caption: "PROVINCIAL SURVEY 1979  •  DAY 4",
      acts: {
        travel: { dc: 10, ok: 19, bad: 23, okMiles: 11 },
        look: { dc: 9, ok: 90, bad: 19, scareFail: true },
        camp: { dc: 11, ok: 40, bad: 43 },
        hunt: { dc: 12, ok: 19, bad: 23, okFood: 2 },
        leave: { dc: 14, ok: 23, bad: 25 },
        talk: { dc: 15, ok: 80, bad: 12 },
        avert: { dc: 11, ok: 19, bad: 90, scareFail: true },
        improv: { dc: 13, ok: 19, bad: 23 }
      }
    },
    19: {
      title: "CANDLE TOWN",
      bed: "weather", place: "village", img: IMAGES.village,
      body: "Every window has a candle. Nobody is in the street. Wagon ruts come in. They do not come out.\n\nThe well has a ring of birds on it that do not fly.",
      caption: "LANDMARK  •  UNNAMED",
      acts: {
        enter: { dc: 12, ok: 50, bad: 54 },
        travel: { dc: 10, ok: 60, bad: 23, okMiles: 9 },
        leave: { dc: 10, ok: 60, bad: 23 },
        look: { dc: 8, ok: 54, bad: 25, scareFail: true },
        talk: { dc: 14, ok: 50, bad: 43 },
        camp: { dc: 13, ok: 40, bad: 43 },
        pray: { dc: 11, ok: 50, bad: 54 },
        avert: { dc: 10, ok: 60, bad: 54 },
        improv: { dc: 13, ok: 50, bad: 23 }
      }
    },
    23: {
      title: "THE WOODS REPEAT",
      bed: "quiet", place: "woods", img: IMAGES.road,
      body: "You have been here. The same oak. The same rut. The miles on your log do not agree with the trees.\n\nIf you try to go back, the road will pretend to allow it.",
      caption: "DAY 4  •  AGAIN",
      acts: {
        back: { dc: 14, ok: 12, bad: 24 },
        travel: { dc: 13, ok: 19, bad: 24, okMiles: 4 },
        look: { dc: 10, ok: 24, bad: 25, scareFail: true },
        camp: { dc: 12, ok: 40, bad: 43 },
        hunt: { dc: 13, ok: 19, bad: 25, okFood: 1 },
        leave: { dc: 12, ok: 60, bad: 25 },
        improv: { dc: 14, ok: 24, bad: 25 }
      }
    },
    24: {
      title: "TRACKS",
      bed: "survey", place: "woods", img: IMAGES.camp,
      body: "Five sets. You can account for four.\n\nThe fifth set is walking backward.",
      caption: "COUNT THEM",
      acts: {
        look: { dc: 10, ok: 43, bad: 25, scareFail: true },
        follow: { dc: 13, ok: 40, bad: 70 },
        travel: { dc: 12, ok: 40, bad: 70 },
        leave: { dc: 13, ok: 60, bad: 25 },
        talk: { dc: 15, ok: 43, bad: 45 },
        camp: { dc: 11, ok: 40, bad: 43 },
        improv: { dc: 13, ok: 40, bad: 70 }
      }
    },
    25: {
      title: "SOMETHING ELSE IS HUNTING",
      bed: "cam3", place: "woods", img: IMAGES.occupied,
      body: "The tape jumps. For a moment the survey is a room that has not been built yet. Three people stand in a light that does not belong on the trail.\n\nThey are waiting for a decision you have not typed.",
      caption: "THIS FRAME WAS NOT IN THE REEL",
      scareOnEnter: true,
      acts: {
        avert: { dc: 12, ok: 23, bad: 70, scareFail: true },
        look: { dc: 7, ok: 70, bad: 70, scareFail: true },
        run: { dc: 14, ok: 60, bad: 70 },
        leave: { dc: 14, ok: 60, bad: 70 },
        talk: { dc: 16, ok: 80, bad: 45 },
        improv: { dc: 15, ok: 23, bad: 70 }
      }
    },
    40: {
      title: "CAMP",
      bed: "faith", place: "camp", img: IMAGES.camp,
      body: "Fire. Wagon. Four of you. The caption will lie about the number if you let it run.\n\nSomeone is seated just outside the light.",
      caption: "FIVE AT THE FIRE",
      acts: {
        camp: { dc: 12, ok: 60, bad: 43, okMiles: 6 },
        look: { dc: 10, ok: 43, bad: 45, scareFail: true },
        talk: { dc: 14, ok: 43, bad: 45 },
        hunt: { dc: 12, ok: 40, bad: 25, okFood: 2 },
        pray: { dc: 11, ok: 50, bad: 43 },
        leave: { dc: 11, ok: 60, bad: 23 },
        avert: { dc: 12, ok: 60, bad: 43 },
        improv: { dc: 13, ok: 60, bad: 43 }
      }
    },
    43: {
      title: "THE FIFTH",
      bed: "quiet", place: "camp", img: IMAGES.camp,
      body: "It has no face you can keep. When you try to describe it, the log writes a name you already used.\n\nIt is sitting where a companion should sit.",
      caption: "DO NOT IDENTIFY THE FIFTH",
      acts: {
        talk: { dc: 16, ok: 80, bad: 45 },
        look: { dc: 8, ok: 45, bad: 25, scareFail: true },
        attack: { dc: 15, ok: 60, bad: 70, killFail: true },
        leave: { dc: 13, ok: 60, bad: 25 },
        pray: { dc: 14, ok: 50, bad: 45 },
        avert: { dc: 12, ok: 40, bad: 45 },
        camp: { dc: 14, ok: 45, bad: 45 },
        improv: { dc: 15, ok: 60, bad: 45 }
      }
    },
    45: {
      title: "IT USED YOUR NAME",
      bed: "sat", place: "tape", img: IMAGES.sat,
      body: "The fifth does not speak with a mouth. The closed-caption does.\n\nIt is spelling you. The survey has stopped being about the valley.",
      caption: "",
      namedCaption: true,
      acts: {
        meta: { dc: 1, ok: 80, bad: 80 },
        talk: { dc: 15, ok: 80, bad: 70 },
        avert: { dc: 13, ok: 40, bad: 70, scareFail: true },
        look: { dc: 9, ok: 70, bad: 70, scareFail: true },
        leave: { dc: 16, ok: 12, bad: 70 },
        improv: { dc: 14, ok: 80, bad: 70 }
      }
    },
    50: {
      title: "VALLEY FAITH HOUR",
      bed: "faith", place: "church", img: IMAGES.pastor,
      body: "The Sunday tape is running in a town with no congregation. The pastor is already looking at the lens.\n\nHe will wait as long as you watch.",
      caption: "LET US LOOK TOGETHER",
      acts: {
        pray: { dc: 11, ok: 90, bad: 54, bless: true },
        look: { dc: 8, ok: 54, bad: 54, scareFail: true },
        avert: { dc: 12, ok: 60, bad: 54, scareFail: true },
        leave: { dc: 10, ok: 60, bad: 54 },
        talk: { dc: 14, ok: 54, bad: 45 },
        enter: { dc: 10, ok: 54, bad: 54 },
        improv: { dc: 12, ok: 90, bad: 54 }
      }
    },
    54: {
      title: "HE DOES NOT BLINK",
      bed: "faith", place: "church", img: IMAGES.pastor,
      body: "The hold is too long for a broadcast. The candle does not drip. Your prompt is still there. He is using it.",
      caption: "LET US LOOK TOGETHER",
      scareOnEnter: true,
      acts: {
        avert: { dc: 13, ok: 60, bad: 70, scareFail: true },
        look: { dc: 6, ok: 70, bad: 70, scareFail: true },
        pray: { dc: 14, ok: 90, bad: 70, bless: true },
        leave: { dc: 12, ok: 60, bad: 70 },
        attack: { dc: 16, ok: 60, bad: 70 },
        improv: { dc: 14, ok: 60, bad: 70 }
      }
    },
    60: {
      title: "THE FORD",
      bed: "survey", place: "river", img: IMAGES.river,
      body: "The river is not on the map you were given. Faces just under the black water, eyes open, not drowning.\n\nWagons have crossed here. Wagons are still crossing.",
      caption: "THE FORD WAS NOT ON THE MAP",
      acts: {
        ford: { dc: 14, ok: 90, bad: 61, okMiles: 14, killFail: true },
        look: { dc: 7, ok: 63, bad: 63, scareFail: true },
        avert: { dc: 11, ok: 90, bad: 61 },
        wait: { dc: 12, ok: 90, bad: 61 },
        pray: { dc: 12, ok: 90, bad: 61, bless: true },
        leave: { dc: 13, ok: 23, bad: 61 },
        travel: { dc: 14, ok: 90, bad: 61, okMiles: 14 },
        improv: { dc: 14, ok: 90, bad: 61 }
      }
    },
    61: {
      title: "THE WAGON GOES UNDER",
      bed: "quiet", place: "river", img: IMAGES.river,
      body: "The lantern is still lit. It is under the water and it is still lit.\n\nSomeone is missing from the party line. The tape did not cut.",
      caption: "LOST AT THE FORD",
      scareOnEnter: true,
      acts: {
        ford: { dc: 16, ok: 90, bad: 63, killFail: true },
        look: { dc: 8, ok: 63, bad: 63, scareFail: true },
        leave: { dc: 14, ok: 23, bad: 63 },
        pray: { dc: 13, ok: 90, bad: 63 },
        improv: { dc: 15, ok: 90, bad: 63 }
      }
    },
    63: {
      title: "YOU ARE IN THE WATER",
      bed: "cam3", place: "river", img: IMAGES.river,
      body: "One of the faces is the operator. One of the faces is you. The printing does not say which is which.\n\nIf you keep watching, the ford will finish without you.",
      caption: "",
      namedCaption: true,
      scareOnEnter: true,
      acts: {
        avert: { dc: 14, ok: 90, bad: 70, scareFail: true },
        look: { dc: 6, ok: 70, bad: 70, scareFail: true },
        ford: { dc: 17, ok: 90, bad: 70, killFail: true },
        leave: { dc: 15, ok: 12, bad: 70 },
        improv: { dc: 16, ok: 90, bad: 70 }
      }
    },
    70: {
      title: "CAMERA 3",
      bed: "cam3", place: "studio", img: IMAGES.occupied,
      body: "You walked into a building that is not on the trail. Three figures in a cone of light. Their mouths are open as if a signal is going in.\n\nThis is not a night you have to survive. This is a page you were not supposed to reach.",
      caption: "CAMERA 3  •  LIVE TALLY",
      scareOnEnter: true,
      acts: {
        leave: { dc: 15, ok: 90, bad: 80 },
        look: { dc: 8, ok: 80, bad: 80, scareFail: true },
        talk: { dc: 14, ok: 80, bad: 45 },
        avert: { dc: 13, ok: 12, bad: 80, scareFail: true },
        attack: { dc: 16, ok: 90, bad: 80 },
        improv: { dc: 15, ok: 80, bad: 80 }
      }
    },
    80: {
      title: "CONTINUITY",
      bed: "sat", place: "sat", img: IMAGES.sat,
      body: "A gray room. A man who looks like the one who left the note. He is reading a procedure that names the chair, not the trail.\n\nHe looks up when you type.",
      caption: "IF YOU ARE READING THIS YOU ARE THE OPERATOR",
      acts: {
        look: { dc: 10, ok: 70, bad: 70, scareFail: true },
        avert: { dc: 12, ok: 12, bad: 70 },
        talk: { dc: 13, ok: 90, bad: 70 },
        leave: { dc: 14, ok: 12, bad: 70 },
        deliver: { dc: 12, ok: 90, bad: 70 },
        meta: { dc: 1, ok: 90, bad: 70 },
        improv: { dc: 13, ok: 90, bad: 70 }
      }
    },
    90: {
      title: "THE TOWER",
      bed: "sat", place: "tower", img: IMAGES.tower,
      body: "The transmitter on the hill. Red lights. Gravel. This is where the survey was supposed to end: a sealed thing delivered to a locked fence.\n\nA figure is already inside.",
      caption: "WQRT TRANSMITTER  •  FWD POWER OK",
      acts: {
        deliver: { dc: 15, ok: 100, bad: 91 },
        enter: { dc: 14, ok: 91, bad: 70 },
        look: { dc: 9, ok: 91, bad: 91, scareFail: true },
        attack: { dc: 14, ok: 101, bad: 91 },
        leave: { dc: 16, ok: 12, bad: 91 },
        pray: { dc: 13, ok: 100, bad: 91, bless: true },
        talk: { dc: 15, ok: 91, bad: 70 },
        improv: { dc: 14, ok: 91, bad: 70 }
      }
    },
    91: {
      title: "INSIDE THE FENCE",
      bed: "quiet", place: "tower", img: IMAGES.fence,
      body: "The figure has a pale face that does not match the night. It does not come closer. It does not need to. The tower is using it the way a camera uses a body.\n\nYou can still type. That is the only door left.",
      caption: "ONE FIGURE",
      scareOnEnter: true,
      acts: {
        deliver: { dc: 16, ok: 100, bad: 102 },
        look: { dc: 8, ok: 102, bad: 102, scareFail: true },
        avert: { dc: 14, ok: 100, bad: 102 },
        leave: { dc: 17, ok: 12, bad: 102 },
        attack: { dc: 15, ok: 101, bad: 102 },
        talk: { dc: 14, ok: 80, bad: 102 },
        improv: { dc: 16, ok: 100, bad: 102 }
      }
    }
  };

  // follow maps to travel if missing
  NODES[24].acts.follow = NODES[24].acts.travel;
  NODES[25].acts.run = NODES[25].acts.leave;

  function showNode(id) {
    const node = NODES[id];
    if (!node) { ending("missing"); return; }
    state.lastPage = state.page;
    state.page = id;
    state.visited[id] = (state.visited[id] || 0) + 1;
    $("page-num").textContent = "PAGE " + id;
    $("page-burn").textContent = "P." + id;
    $("tape-id").textContent = "VTR 2  •  SURVEY REEL  •  " + escapeName();
    setScene(node.img, false);
    $("tape-cc").textContent = node.namedCaption ? (escapeName() + ".") : (node.caption || "");
    $("tape-label").textContent = node.title;
    $("story").textContent = node.body;
    if (state.visited[id] > 1) {
      $("story").textContent = node.body + "\n\nYou have been on this page. It is not the same printing.";
    }
    WQRTAudio.setBed(node.bed);
    WQRTAudio.setPlace(node.place);
    WQRTAudio.setCorruption(Math.min(1, state.moves / 14 + (state.marked ? 0.2 : 0)));
    $("tape-crawl-wrap").classList.add("on");
    $("tape-crawl").textContent = "YOU ARE VIEWER " + state.viewed + "  —  DO NOT REWIND  —  " + escapeName() + " IS IN THE CHAIR  —  ";
    if (node.scareOnEnter) setTimeout(scare, 700);
    hud();
    if (state.food <= 0 && id !== 61) journal("RATIONS GONE. THE NEXT MARCH WILL TAKE SOMEONE.", "ghost");
  }

  function ending(kind) {
    if (state.ended) return;
    state.ended = true;
    const n = escapeName();
    const card = $("end-card");
    card.innerHTML = "";
    const code = document.createElement("div"); code.className = "code";
    const h = document.createElement("h1");
    const p = document.createElement("p");
    const p2 = document.createElement("p");
    const again = document.createElement("button");
    again.textContent = "ANOTHER PRINTING";
    again.onclick = function () { location.reload(); };
    if (kind === "deliver") {
      code.textContent = "ENDING  •  THE RELIQUARY";
      h.textContent = "THE FENCE TAKES IT";
      p.textContent = "You put the sealed thing through the gate. The figure did not move. Sign-on ran at 05:00 with your name on a staff slide Donna did not write.";
      p2.textContent = n + ". Then the names of the people you lost. Then " + n + " again.";
      setScene(IMAGES.tower, false);
      WQRTAudio.setBed("shop");
    } else if (kind === "dark") {
      code.textContent = "ENDING  •  FWD POWER ZERO";
      h.textContent = "THE LIGHTS STAYED ON";
      p.textContent = "You tried to kill the tower. The obstruction lights did not care. The survey log lists you as missing and still on the reel.";
      p2.textContent = n + " last seen inside the fence.";
      setScene(IMAGES.fence, false);
      WQRTAudio.txKill();
    } else if (kind === "tape") {
      code.textContent = "ENDING  •  STILL RECORDING";
      h.textContent = "THE TAPE DOES NOT STOP";
      p.textContent = "There are no more pages. The CRT stays live. In the crawl, viewer count is 1. That is you. That is also not you.";
      p2.textContent = "Do not rewind.";
      setScene(IMAGES.occupied, false);
    } else if (kind === "missing") {
      code.textContent = "ENDING  •  PAGE REMOVED";
      h.textContent = "THIS PAGE WAS CUT FROM YOUR PRINTING";
      p.textContent = "The choice you typed does not exist in this copy. Someone already took that page. Their wagon is on Camera 3.";
      p2.textContent = "You may start another printing. It will not have the same pages.";
      setScene(IMAGES.studio, false);
    } else {
      code.textContent = "ENDING  •  THE CHAIR";
      h.textContent = "YOU WERE NEVER ON THE TRAIL";
      p.textContent = "The survey was footage. The wagon was a caption. You were in master control the whole time, typing into a log that went out over the air.";
      p2.textContent = "WQRT-12 thanks overnight operator " + n + ".";
      setScene(IMAGES.sat, false);
    }
    card.appendChild(code); card.appendChild(h); card.appendChild(p); card.appendChild(p2); card.appendChild(again);
    $("end").classList.remove("hidden");
  }

  function applyFx(table, roll) {
    if (roll.ok) {
      if (table.okFood) state.food += table.okFood;
      if (table.okMiles) state.miles += table.okMiles;
      if (table.bless) state.blessed = true;
    } else {
      state.food = Math.max(0, state.food - 1);
      if (table.killFail || roll.fumble) killOne(roll.fumble ? "the reel skipped" : "the attempt failed");
    }
    if (state.food > 0 && (table.okMiles || !roll.ok)) {
      /* travel always costs */
    }
    if (roll.ok && (table.okMiles || table.ok === 19 || table.ok === 60 || table.ok === 90)) {
      state.food = Math.max(0, state.food - 1);
      if (state.oil > 0 && Math.random() < 0.35) state.oil -= 1;
    }
    hud();
  }

  function goPage(id) {
    if (id == null) { ending("missing"); return; }
    if (id === 100) { ending("deliver"); return; }
    if (id === 101) { ending("dark"); return; }
    if (id === 102) { ending("tape"); return; }
    cutTo(id, function () { showNode(id); unlock(); });
  }

  function unlock() {
    state.busy = false;
    $("move-form").classList.remove("busy");
    $("move").focus();
  }

  function submit(text) {
    if (state.ended || state.busy) return;
    const node = NODES[state.page];
    if (!node) return;
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
      WQRTAudio.hitch();
      const dest = state.lastPage && state.lastPage !== state.page ? 23 : 24;
      journal("YOU TRIED TO REWIND. THE PRINTING DOES NOT ALLOW IT.", "ghost");
      playClip({ img: node.img, fail: true, caption: raw, label: "DO NOT REWIND", scare: true }, function () {
        goPage(dest);
      });
      return;
    }
    if (act === "meta") {
      state.marked = true;
      $("tape-cc").textContent = "YES.";
      journal("THE TAPE ANSWERED.", "ghost");
      playClip({ img: IMAGES.sat, caption: "YES.", label: "CONTINUITY", scare: false }, function () {
        goPage(80);
      });
      return;
    }

    const table = node.acts[act] || node.acts.improv;
    const roll = secretRoll(table.dc);
    state.moves += 1;
    if (state.moves === 3) {
      journal("A LINE YOU DID NOT WRITE: " + escapeName() + " is already in the chain.", "hand");
      state.ghosted = true;
    }
    if (state.moves === 6) state.viewed = 1;

    WQRTAudio.hitch();
    applyFx(table, roll);

    const next = roll.fumble && table.fumble ? table.fumble : (roll.crit && table.crit ? table.crit : (roll.ok ? table.ok : table.bad));
    const fail = !roll.ok;
    const clipImg = fail && (next === 25 || next === 70 || next === 61) ? (next === 61 ? IMAGES.river : IMAGES.occupied) : node.img;

    journal((fail ? "THE ATTEMPT DOES NOT HOLD. " : "THE REEL ALLOWS IT. ") + raw, fail ? "ghost" : "");

    if (live().length <= 0) {
      playClip({ img: IMAGES.occupied, fail: true, scare: true, caption: raw, label: "NO ONE LEFT TO WRITE" }, function () {
        ending("tape");
      });
      return;
    }

    playClip({
      img: clipImg,
      fail: fail,
      scare: !!(fail && (table.scareFail || roll.fumble)),
      caption: raw.toUpperCase(),
      label: fail ? "FAILING  •  " + node.title : "HOLDING  •  " + node.title
    }, function () {
      if (roll.fumble && Math.random() < 0.22) goPage(null);
      else goPage(next);
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
    let fails = 0;
    const names = { a: "", b: "", c: "" };
    function show() {
      card.innerHTML = "";
      if (step === 0) {
        const h = document.createElement("h1"); h.textContent = "WQRT-12";
        const s = document.createElement("p"); s.textContent = "CONTINUITY ACCESS  •  ANNEX 12";
        const p = document.createElement("p"); p.textContent = "You were given a station code. Do not read it on air. Headphones.";
        const i = document.createElement("input"); i.placeholder = "STATION CODE"; i.autocomplete = "off";
        const err = document.createElement("p");
        const b = document.createElement("button"); b.textContent = "OPEN THE CHAIN";
        async function tryCode() {
          const ok = await codeOk(i.value);
          if (ok) { WQRTAudio.start(); WQRTAudio.beep(700, 0.1, 0.08); step = 1; show(); }
          else {
            fails += 1;
            WQRTAudio.start(); WQRTAudio.beep(140, 0.25, 0.1);
            err.textContent = fails >= 3 ? "NO CARRIER." : "DENIED.";
          }
        }
        b.onclick = tryCode;
        i.addEventListener("keydown", function (e) { if (e.key === "Enter") tryCode(); });
        card.appendChild(h); card.appendChild(s); card.appendChild(p); card.appendChild(i); card.appendChild(b); card.appendChild(err);
        setTimeout(function () { i.focus(); }, 40);
      } else if (step === 1) {
        const h = document.createElement("h1"); h.textContent = "THE SURVEY";
        const p = document.createElement("p"); p.textContent = "This is not a night you sit through. It is a printing. You type what the wagon does. A die you cannot see decides if the reel allows it. The same sentence can live or drown.";
        const p2 = document.createElement("p"); p2.textContent = "Analog horror. Oregon Trail. The page you turn to is not the next one.";
        const b = document.createElement("button"); b.textContent = "I UNDERSTAND";
        b.onclick = function () { step = 2; show(); };
        card.appendChild(h); card.appendChild(p); card.appendChild(p2); card.appendChild(b);
      } else if (step === 2) {
        const h = document.createElement("h1"); h.textContent = "NAME THE PARTY";
        const p = document.createElement("p"); p.textContent = "You, then three others. They can be lost. The caption may count an extra.";
        function field(ph) { const i = document.createElement("input"); i.maxLength = 16; i.placeholder = ph; return i; }
        const you = field("YOUR NAME");
        const a = field("COMPANION 1");
        const b = field("COMPANION 2");
        const c = field("COMPANION 3");
        const go = document.createElement("button"); go.textContent = "START THE REEL";
        go.onclick = function () {
          state.name = (you.value || "UNLOGGED").replace(/[<>]/g, "").trim().toUpperCase().slice(0, 16) || "UNLOGGED";
          names.a = (a.value || "ELLIS").replace(/[<>]/g, "").trim().toUpperCase().slice(0, 16);
          names.b = (b.value || "HOLCOMB").replace(/[<>]/g, "").trim().toUpperCase().slice(0, 16);
          names.c = (c.value || "KEENE").replace(/[<>]/g, "").trim().toUpperCase().slice(0, 16);
          state.party = [
            { name: state.name, alive: true, you: true },
            { name: names.a, alive: true },
            { name: names.b, alive: true },
            { name: names.c, alive: true }
          ];
          $("boot").classList.add("hidden");
          $("app").classList.remove("hidden");
          start();
        };
        card.appendChild(h); card.appendChild(p); card.appendChild(you); card.appendChild(a); card.appendChild(b); card.appendChild(c); card.appendChild(go);
        setTimeout(function () { you.focus(); }, 40);
      }
    }
    if (state.debug) {
      state.name = "VEGA";
      state.party = [
        { name: "VEGA", alive: true, you: true },
        { name: "ELLIS", alive: true },
        { name: "HOLCOMB", alive: true },
        { name: "KEENE", alive: true }
      ];
      $("boot").classList.add("hidden");
      $("app").classList.remove("hidden");
      WQRTAudio.start();
      start();
      return;
    }
    show();
  }

  function start() {
    Object.keys(IMAGES).forEach(function (k) { const im = new Image(); im.src = IMAGES[k]; });
    $("move-form").addEventListener("submit", function (e) {
      e.preventDefault();
      submit($("move").value);
    });
    journal("SURVEY BEGINS — OP " + escapeName());
    journal("The die is not printed. Do not ask for it.");
    hud();
    showNode(12);
    $("move").focus();
  }

  boot();
})();
