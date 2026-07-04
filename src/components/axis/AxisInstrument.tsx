"use client";

import { useEffect, useRef } from "react";

/* ============================================================
   AXIS — broadcast instrument
   Three things on screen: the bug, the test, the trigger.
   Everything else earns its way in, then leaves.

   Faithful port of the standalone prototype. Logic runs
   imperatively inside one effect; gestures, buttons, and the
   parser all emit the same intents. >>> AXIS-CORE marks hooks.
============================================================ */

const TESTS = ["JUMP", "CMJ", "DROP JUMP", "LANDING", "LATERAL", "SPRINT", "DECEL", "SHOOTING"];
const ATHLETES = ["ATHLETE 01", "ATHLETE 02", "ATHLETE 03"]; // >>> AXIS-CORE: roster fetch

const CSS = `
#axis-instrument{
--lime:#c8f542;
--ink:#000;
--white:#fff;
--rec:#ff2e1f;
--dim:rgba(255,255,255,.5);
--display:'Anton', Impact, 'Arial Narrow', sans-serif;
--safe-t: env(safe-area-inset-top, 0px);
--safe-b: env(safe-area-inset-bottom, 0px);
}
#axis-instrument, #axis-instrument *{ margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; user-select:none; }
#axis-instrument{
position:fixed; inset:0; background:var(--ink); color:var(--white); height:100dvh; overflow:hidden;
overscroll-behavior:none; font-family: ui-sans-serif, system-ui, sans-serif; touch-action:manipulation;
}

/* ---------- stage ---------- */
#axis-instrument #stage{ position:fixed; inset:0; background:#0a0a0a; }
#axis-instrument #cam{ width:100%; height:100%; object-fit:cover; display:block; }
#axis-instrument #overlay-canvas{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
/* >>> AXIS-CORE: pose skeleton draws here */
#axis-instrument #cam-fallback{ position:absolute; inset:0; display:grid; place-items:center; color:var(--dim); font-size:.85rem; text-align:center; padding:2rem; }

#axis-instrument #flash{ position:fixed; inset:0; background:#fff; opacity:0; pointer-events:none; z-index:50; }
#axis-instrument #flash.go{ animation:axis-flash .28s ease-out; }
@keyframes axis-flash{ 0%{opacity:.85} 100%{opacity:0} }

/* ---------- score bug (top-left) ---------- */
#axis-instrument #bug{
position:fixed; top:calc(var(--safe-t) + 12px); left:0; z-index:20;
display:flex; align-items:stretch; height:38px;
font-family:var(--display); letter-spacing:.03em;
transform:skewX(-12deg) translateX(-6px);
filter:drop-shadow(0 2px 8px rgba(0,0,0,.5));
}
#axis-instrument #bug > *{ display:flex; align-items:center; padding:0 14px 0 18px; }
#axis-instrument #bug .mark{ background:var(--lime); color:var(--ink); font-size:1.05rem; }
#axis-instrument #bug .who{ background:var(--ink); color:var(--white); font-size:.95rem; border:0; font-family:var(--display); letter-spacing:.03em; }
#axis-instrument #bug .who .dot{ width:7px; height:7px; border-radius:50%; background:var(--dim); margin-left:9px; }
#axis-instrument.calibrated #bug .who .dot{ background:var(--lime); }
#axis-instrument #bug .clock{ background:var(--rec); color:var(--white); font-size:.95rem; display:none; font-variant-numeric:tabular-nums; }
#axis-instrument.recording #bug .clock{ display:flex; }
#axis-instrument #bug span, #axis-instrument #bug button span{ transform:skewX(12deg); display:inline-flex; align-items:center; }

/* save — appears in the bug row only when there is evidence */
#axis-instrument #save-btn{
display:none; background:var(--white); color:var(--ink);
border:0; font-family:var(--display); font-size:.9rem; letter-spacing:.04em;
}
#axis-instrument.has-evidence #save-btn{ display:flex; }
#axis-instrument #save-btn:active{ background:var(--lime); }

/* ---------- lower third (status flashes) ---------- */
#axis-instrument #third{
position:fixed; left:0; bottom:calc(var(--safe-b) + 218px); z-index:30;
background:var(--lime); color:var(--ink);
font-family:var(--display); font-size:1.05rem; letter-spacing:.04em;
padding:8px 22px 8px 20px; transform:skewX(-12deg) translateX(-110%);
transition:transform .22s cubic-bezier(.2,.9,.2,1);
filter:drop-shadow(0 2px 8px rgba(0,0,0,.5));
}
#axis-instrument #third.err{ background:var(--rec); color:var(--white); }
#axis-instrument #third.show{ transform:skewX(-12deg) translateX(-6px); }
#axis-instrument #third span{ display:inline-block; transform:skewX(12deg); }

/* ---------- the test (swipe to change) ---------- */
#axis-instrument #deck{
position:fixed; left:0; right:0; bottom:0; z-index:20;
padding:0 0 calc(var(--safe-b) + 18px);
display:flex; flex-direction:column; align-items:center; gap:14px;
background:linear-gradient(to top, rgba(0,0,0,.65), transparent);
padding-top:40px;
}
#axis-instrument #test-name{
font-family:var(--display); font-style:italic;
font-size:clamp(2.6rem, 12vw, 4rem); line-height:1;
letter-spacing:.01em; text-transform:uppercase;
color:var(--white); -webkit-text-stroke:0;
text-shadow:0 3px 14px rgba(0,0,0,.6);
transition:opacity .12s, transform .12s;
}
#axis-instrument #test-name.armed{ color:var(--lime); }
#axis-instrument #test-name.swap{ opacity:0; transform:translateX(var(--dir, 20px)); }
#axis-instrument #test-dots{ display:flex; gap:7px; }
#axis-instrument #test-dots i{ width:5px; height:5px; border-radius:50%; background:var(--dim); }
#axis-instrument #test-dots i.on{ background:var(--lime); width:16px; border-radius:3px; }
#axis-instrument #hint{ font-size:.68rem; letter-spacing:.14em; color:var(--dim); text-transform:uppercase; }

/* ---------- trigger ---------- */
#axis-instrument #record-btn{
width:82px; height:82px; border-radius:50%;
border:4px solid var(--white); background:transparent;
display:grid; place-items:center; padding:0; cursor:pointer;
filter:drop-shadow(0 2px 10px rgba(0,0,0,.5));
}
#axis-instrument #record-btn .core{
width:60px; height:60px; border-radius:50%; background:var(--lime);
transition:all .18s;
}
#axis-instrument #record-btn:active .core{ transform:scale(.88); }
#axis-instrument.recording #record-btn{ border-color:var(--rec); }
#axis-instrument.recording #record-btn .core{ background:var(--rec); border-radius:12px; transform:scale(.58); }

/* ---------- command line (swipe up / long-press to reveal) ---------- */
#axis-instrument #cmd-tray{
position:fixed; left:0; right:0; bottom:0; z-index:40;
transform:translateY(105%); transition:transform .28s cubic-bezier(.2,.9,.2,1);
background:var(--ink); border-top:2px solid var(--lime);
padding:14px 16px calc(var(--safe-b) + 14px);
display:flex; gap:10px; align-items:center;
}
#axis-instrument #cmd-tray.open{ transform:none; }
#axis-instrument #cmd-tray .prompt{ color:var(--lime); font-family:var(--display); font-size:1.1rem; }
#axis-instrument #cmd{
flex:1; background:transparent; border:0; outline:0; color:var(--white);
font-family:ui-monospace, Menlo, monospace; font-size:.9rem; min-width:0;
}
#axis-instrument #cmd::placeholder{ color:var(--dim); }
#axis-instrument #cmd-go{
border:0; background:var(--lime); color:var(--ink);
font-family:var(--display); font-size:.85rem; letter-spacing:.05em;
padding:9px 18px; transform:skewX(-12deg);
}
#axis-instrument #cmd-go span{ display:inline-block; transform:skewX(12deg); }

/* ---------- athlete sheet ---------- */
#axis-instrument #sheet{
position:fixed; inset:auto 0 0 0; z-index:45; transform:translateY(105%);
transition:transform .28s cubic-bezier(.2,.9,.2,1);
background:var(--ink); border-top:2px solid var(--lime);
padding:20px 20px calc(var(--safe-b) + 20px);
}
#axis-instrument #sheet.open{ transform:none; }
#axis-instrument #sheet h2{ font-family:var(--display); font-size:.85rem; letter-spacing:.1em; color:var(--dim); margin-bottom:10px; }
#axis-instrument #sheet .row{
width:100%; text-align:left; background:transparent; border:0; color:var(--white);
padding:14px 2px; font-family:var(--display); font-size:1.3rem; letter-spacing:.03em;
border-bottom:1px solid rgba(255,255,255,.12);
}
#axis-instrument #sheet .row:active{ color:var(--lime); }
#axis-instrument #veil{ position:fixed; inset:0; z-index:38; background:rgba(0,0,0,.45); display:none; }
#axis-instrument #veil.open{ display:block; }

#axis-instrument button{ font-family:inherit; cursor:pointer; }
@media (prefers-reduced-motion: reduce){ #axis-instrument *{ transition:none !important; animation:none !important; } }
`;

export default function AxisInstrument() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector(s) as T;

    const S = {
      ti: -1,
      athlete: null as string | null,
      recording: false,
      recStart: 0,
      evidence: 0,
      stream: null as MediaStream | null,
      recorder: null as MediaRecorder | null,
      chunks: [] as Blob[],
    };

    let disposed = false;
    let thirdTimer: ReturnType<typeof setTimeout> | undefined;
    let swapTimer: ReturnType<typeof setTimeout> | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let tickTimer: ReturnType<typeof setTimeout> | undefined;
    let pressTimer: ReturnType<typeof setTimeout> | undefined;

    /* ---------- lower third ---------- */
    function flashThird(msg: string, err = false) {
      const t = $("#third");
      $("#third-text").textContent = msg;
      t.classList.toggle("err", err);
      t.classList.add("show");
      clearTimeout(thirdTimer);
      thirdTimer = setTimeout(() => t.classList.remove("show"), 1600);
    }

    /* ---------- intent registry ---------- */
    const registry: Record<string, (arg?: string | number) => void> = {
      test(arg) {
        let i: number;
        if (typeof arg === "number") i = (arg + TESTS.length) % TESTS.length;
        else {
          i = TESTS.findIndex((t) => t.toLowerCase().startsWith(String(arg).toLowerCase()));
          if (i < 0) return flashThird(`NO TEST "${arg}"`, true);
        }
        const dir = i > S.ti || (S.ti === TESTS.length - 1 && i === 0) ? "20px" : "-20px";
        S.ti = i;
        const el = $("#test-name");
        el.style.setProperty("--dir", dir);
        el.classList.add("swap");
        clearTimeout(swapTimer);
        swapTimer = setTimeout(() => {
          el.textContent = TESTS[i];
          el.classList.add("armed");
          el.classList.remove("swap");
          renderDots();
        }, 120);
        // >>> AXIS-CORE: load constraint set for TESTS[i] (constraint-registry.ts)
      },

      athlete(name) {
        if (!name) return openSheet();
        const hit = ATHLETES.find((a) => a.toLowerCase().includes(String(name).toLowerCase()));
        if (!hit) return flashThird(`NO ATHLETE "${name}"`, true);
        S.athlete = hit;
        $("#athlete-name").textContent = hit.replace("ATHLETE ", "A");
        closeSheet();
        flashThird(hit);
      },

      capture() {
        if (!S.stream) return flashThird("NO CAMERA", true);
        const flash = $("#flash");
        flash.classList.remove("go");
        void flash.offsetWidth;
        flash.classList.add("go");
        flashThird("FRAME CAPTURED");
        requestAnimationFrame(() => {
          // heavy work off the tap — INP-safe
          const v = $<HTMLVideoElement>("#cam");
          const c = document.createElement("canvas");
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          c.getContext("2d")?.drawImage(v, 0, 0);
          c.toBlob(
            (b) => {
              if (!b || disposed) return;
              S.evidence++;
              root.classList.add("has-evidence");
              // >>> AXIS-CORE: POST blob to calibration endpoint (Supabase, upload_id keyed)
            },
            "image/jpeg",
            0.85,
          );
        });
      },

      record() {
        if (S.ti < 0) return flashThird("SWIPE TO SELECT A TEST", true);
        if (S.recording) stopRep();
        else startRep();
      },

      save() {
        flashThird("SAVING…");
        // >>> AXIS-CORE: persist calibration
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          if (disposed) return;
          root.classList.add("calibrated");
          flashThird("CALIBRATION SAVED");
        }, 400);
      },
    };
    const dispatch = (intent: string, arg?: string | number) =>
      registry[intent] ? registry[intent](arg) : flashThird(`UNKNOWN "${intent}"`, true);

    /* ---------- parser ---------- */
    function parse(raw: string) {
      const s = raw.trim();
      if (!s) return;
      const [head, ...rest] = s.split(/\s+/);
      const arg = rest.join(" ");
      const verbs: Record<string, string> = {
        test: "test",
        athlete: "athlete",
        capture: "capture",
        record: "record",
        rec: "record",
        stop: "record",
        save: "save",
      };
      const v = verbs[head.toLowerCase()];
      if (v) return dispatch(v, arg);
      if (TESTS.some((t) => t.toLowerCase().startsWith(head.toLowerCase()))) return dispatch("test", s);
      flashThird(`CAN'T PARSE "${s}"`, true);
    }

    /* ---------- recording ---------- */
    const startRep = () => {
      S.recording = true;
      S.recStart = Date.now();
      S.chunks = [];
      root.classList.add("recording");
      if (window.MediaRecorder && S.stream) {
        try {
          S.recorder = new MediaRecorder(S.stream);
          S.recorder.ondataavailable = (e) => {
            if (e.data.size) S.chunks.push(e.data);
          };
          S.recorder.start();
        } catch {
          S.recorder = null;
        }
      }
      tick();
      flashThird(`REC · ${TESTS[S.ti]}`);
    };
    const stopRep = () => {
      S.recording = false;
      root.classList.remove("recording");
      if (S.recorder && S.recorder.state !== "inactive") S.recorder.stop();
      S.evidence++;
      root.classList.add("has-evidence");
      flashThird(`REP SAVED · ${Math.round((Date.now() - S.recStart) / 1000)}S`);
      // >>> AXIS-CORE: hand rep blob to witness pipeline (witness-registry.ts)
    };
    function tick() {
      if (!S.recording || disposed) return;
      const s = Math.floor((Date.now() - S.recStart) / 1000);
      $("#rec-time").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      tickTimer = setTimeout(tick, 250);
    }

    /* ---------- render ---------- */
    function renderDots() {
      $("#test-dots").innerHTML = TESTS.map((_, i) => `<i class="${i === S.ti ? "on" : ""}"></i>`).join("");
    }
    function openSheet() {
      $("#sheet").classList.add("open");
      $("#veil").classList.add("open");
    }
    function closeSheet() {
      $("#sheet").classList.remove("open");
      $("#veil").classList.remove("open");
    }
    $("#athlete-list").innerHTML = ATHLETES.map((a) => `<button class="row" data-a="${a}">${a}</button>`).join("");

    /* ---------- camera ---------- */
    async function initCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        S.stream = stream;
        $<HTMLVideoElement>("#cam").srcObject = stream;
        $("#cam-fallback").hidden = true;
        // >>> AXIS-CORE: feed stream to pose model; draw on #overlay-canvas
      } catch {
        if (!disposed) $("#cam-fallback").hidden = false;
      }
    }

    /* ---------- gestures ---------- */
    let sx = 0;
    let sy = 0;
    const closest = (t: EventTarget | null, sel: string) => (t instanceof Element ? t.closest(sel) : null);

    const onTouchStart = (e: TouchEvent) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      if (closest(e.target, "#test-name"))
        pressTimer = setTimeout(() => {
          $("#cmd-tray").classList.add("open");
          $("#cmd").focus();
        }, 450);
    };
    const onTouchEnd = (e: TouchEvent) => {
      clearTimeout(pressTimer);
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5 && !closest(e.target, "#cmd-tray,#sheet"))
        dispatch("test", S.ti < 0 ? (dx < 0 ? 0 : TESTS.length - 1) : S.ti + (dx < 0 ? 1 : -1));
      else if (Math.abs(dy) > 48 && dy < 0 && sy > innerHeight * 0.7 && !closest(e.target, "#cmd-tray,#sheet")) {
        $("#cmd-tray").classList.add("open");
        $("#cmd").focus();
      }
    };
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchend", onTouchEnd, { passive: true });

    /* mouse fallback for desktop testing: arrow keys cycle tests */
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).id === "cmd") return;
      if (e.key === "ArrowRight") dispatch("test", S.ti + 1);
      if (e.key === "ArrowLeft") dispatch("test", S.ti <= 0 ? TESTS.length - 1 : S.ti - 1);
    };
    document.addEventListener("keydown", onKeydown);

    /* ---------- clicks ---------- */
    const onClick = (e: MouseEvent) => {
      const btn = closest(e.target, "[data-intent]") as HTMLElement | null;
      if (btn) return dispatch(btn.dataset.intent as string);
      const row = closest(e.target, "#sheet .row") as HTMLElement | null;
      if (row) return dispatch("athlete", row.dataset.a);
      if (closest(e.target, "#athlete-btn")) return dispatch("athlete");
      if (e.target instanceof HTMLElement && e.target.id === "veil") return closeSheet();
      if (closest(e.target, "#cmd-tray")) return;
      if ($("#cmd-tray").classList.contains("open")) return $("#cmd-tray").classList.remove("open");
      if (closest(e.target, "#stage")) {
        if (!$("#cam-fallback").hidden) return void initCam();
        return dispatch("capture"); // the whole screen is the shutter
      }
    };
    root.addEventListener("click", onClick);

    const cmd = $<HTMLInputElement>("#cmd");
    const onCmdGo = () => {
      parse(cmd.value);
      cmd.value = "";
    };
    const onCmdKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        parse(cmd.value);
        cmd.value = "";
      }
    };
    $("#cmd-go").addEventListener("click", onCmdGo);
    cmd.addEventListener("keydown", onCmdKey);

    renderDots();
    initCam();

    return () => {
      disposed = true;
      clearTimeout(thirdTimer);
      clearTimeout(swapTimer);
      clearTimeout(saveTimer);
      clearTimeout(tickTimer);
      clearTimeout(pressTimer);
      document.removeEventListener("keydown", onKeydown);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("click", onClick);
      if (S.recorder && S.recorder.state !== "inactive") S.recorder.stop();
      S.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div id="axis-instrument" ref={rootRef}>
      <link href="https://fonts.googleapis.com/css2?family=Anton&display=swap" rel="stylesheet" />
      <style>{CSS}</style>

      <div id="stage">
        <video id="cam" autoPlay playsInline muted />
        <canvas id="overlay-canvas" />
        <div id="cam-fallback" hidden>
          Camera unavailable — allow access, then tap to retry.
        </div>
      </div>
      <div id="flash" />

      {/* score bug */}
      <div id="bug">
        <div className="mark">
          <span>AXIS</span>
        </div>
        <button className="who" id="athlete-btn">
          <span id="athlete-name">ATHLETE</span>
          <span className="dot" />
        </button>
        <div className="clock">
          <span id="rec-time">0:00</span>
        </div>
        <button id="save-btn" data-intent="save">
          <span>SAVE CAL</span>
        </button>
      </div>

      {/* lower third */}
      <div id="third">
        <span id="third-text" />
      </div>

      {/* deck */}
      <div id="deck">
        <div id="test-name">SELECT TEST</div>
        <div id="test-dots" />
        <button id="record-btn" data-intent="record" aria-label="Record rep">
          <span className="core" />
        </button>
        <div id="hint">swipe test · tap video to capture · hold test for commands</div>
      </div>

      {/* command tray */}
      <div id="cmd-tray">
        <span className="prompt">›</span>
        <input
          id="cmd"
          placeholder="jump · record · capture · save · athlete 2"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <button id="cmd-go">
          <span>RUN</span>
        </button>
      </div>

      {/* athlete sheet */}
      <div id="veil" />
      <div id="sheet">
        <h2>ATHLETE</h2>
        <div id="athlete-list" />
      </div>
    </div>
  );
}
