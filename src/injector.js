function injector(bonkCode) {
  window.onbeforeunload = function () {
    return "Are you sure?";
  };

  const kklee = {};
  window.kklee = kklee;
  kklee.polyDecomp = require("poly-decomp");
  kklee.splitConcaveIntoConvex = (v) => {
    kklee.polyDecomp.makeCCW(v);
    // Normal decomp is VERY slow with a high amount of vertices
    return kklee.polyDecomp.quickDecomp(v);
  };
  let src = bonkCode;

  let prevSrc = src;
  function checkSrcChange() {
    if (prevSrc == src) throw new Error("src didn't change");
    prevSrc = src;
  }
  function replace() {
    src = src.replace(...arguments);
    checkSrcChange();
  }
  function assert(condition) {
    if (!condition) throw new Error("assertion failed");
  }

  const mapObjectName = src
    .match(/rxid:[a-zA-Z0-9]{3}\[\d+\]/)[0]
    .split(":")[1];
  // Escape regex special characters
  const monEsc = mapObjectName.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
  const varArrName = mapObjectName.split("[")[0];

  // When a new map object is created, also assign it to a global variable
  replace(
    new RegExp(`(${monEsc}=[^;]+;)`, "g"),
    `$1window.kklee.mapObject=${mapObjectName};\
if(window.kklee.afterNewMapObject)window.kklee.afterNewMapObject();`
  );

  const mapEncoderName = src.match(
    new RegExp(`${monEsc}=(.)\\[.{1,25}\\]\\(\\);`)
  )[1];

  replace(
    new RegExp(`function ${mapEncoderName}\\(\\)\\{\\}`, "g"),
    `function ${mapEncoderName}(){};\
window.kklee.mapEncoder=${mapEncoderName};`
  );

  /*
  This function contains some useful stuff
    function j0Z() {
        z5i[977] = -1; // selected body
        z5i[450] = -1; // selected spawn
        z5i[462] = -1; // selected capzone
        p4Z(); // update left box
        v4Z(); // update right box, takes parameter for selected fixture
        n4V.a1V();
        B4Z(true); // update rendering stuff. I'll use "true" as the parameter
        M4Z(); // spawns and physics shapes warnings
        y0Z(); // update undo and redo buttons
        I6s(); // update mode dropdown selection
    }
  */
  const theResetFunction = src.match(
    new RegExp(
      "function ...\\(\\){.{0,40}\
(...\\[\\d+\\]=-1;){2}.{0,40}(...\\(true\\);).{0,40}(...\\(\\);){2}[^}]+\\}"
    )
  )[0];

  const resetFunctionNames = theResetFunction
    // Function body excluding last semicolon
    .match(/(?<=\{).+(?=;\})/)[0]
    .split(";")
    // Exclude the weird obfuscation function
    .filter((s) => !s.match(/.+(\.).+\(\)/));
  const updateFunctionNames = resetFunctionNames
    .slice(3)
    .map((s) => s.split("(")[0]);
  const currentlySelectedNames = resetFunctionNames
    .slice(0, 3)
    .map((s) => s.split("=")[0]);
  assert(resetFunctionNames.length == 9);

  let ufInj = "";

  const apiUpdateFunctionNames = [
    "LeftBox",
    "RightBoxBody",
    "Renderer",
    "Warnings",
    "UndoButtons",
    "ModeDropdown",
  ];
  for (const i in updateFunctionNames) {
    const on = updateFunctionNames[i],
      nn = apiUpdateFunctionNames[i];

    ufInj += `let ${on}OLD=${on};${on}=function(){${on}OLD(...arguments);\
if(window.kklee.afterUpdate${nn})window.kklee.afterUpdate${nn}(...arguments);};\
window.kklee.update${nn}=${on};`;
  }

  const apiCurrentlySelectedNames = ["Body", "Spawn", "CapZone"];
  for (const i in currentlySelectedNames) {
    const on = currentlySelectedNames[i],
      nn = apiCurrentlySelectedNames[i];

    ufInj += `window.kklee.getCurrent${nn}=function(){return ${on};};\
window.kklee.setCurrent${nn}=function(v){return ${on}=v;};`;
  }

  replace(theResetFunction, `${theResetFunction};{${ufInj}};`);

  // Only part of the function body
  const saveHistoryFunction = src.match(
    new RegExp(
      `function ...\\(\\)\\{.{1,170}${varArrName}\\[\\d{1,3}\\]--;\\}\
${varArrName}\\[\\d{1,3}\\].{1,40}\\]\\(JSON\\[.{1,40}\\]\\(${monEsc}\\)`
    )
  )[0];
  const saveHistoryFunctionName = saveHistoryFunction.match(
    /(?<=function )...(?=\(\))/
  )[0];
  const newSaveHistoryFunction = saveHistoryFunction.replace(
    new RegExp("(function ...\\(\\)\\{)"),
    "$1window.kklee.afterSaveHistory();"
  );
  replace(
    saveHistoryFunction,
    `;window.kklee.setMapObject=\
function(m){${mapObjectName}=m;window.kklee.mapObject=m;};\
window.kklee.saveToUndoHistoryOLD=${saveHistoryFunctionName};\
${newSaveHistoryFunction}`
  );

  const dbOpenRequest = window.indexedDB.open("kkleeStorage_347859220", 1);
  let db;
  kklee.backups = [];

  dbOpenRequest.onsuccess = () => {
    db = dbOpenRequest.result;
    db.transaction("backups");
    const transaction = db.transaction("backups");
    const getRequest = transaction.objectStore("backups").get(1);
    getRequest.onsuccess = () => {
      kklee.backups = getRequest.result;
    };
    getRequest.onerror = (event) => {
      console.error(event);
      alert("kklee: unable to get backups from database");
    };
  };
  function saveBackups() {
    if (!db) return;
    const transaction = db.transaction("backups", "readwrite");
    transaction.objectStore("backups").put(kklee.backups, 1);
    db.onerror = console.error;
  }
  dbOpenRequest.onerror = (event) => {
    console.error(event);
    alert("kklee: unable to open IndexedDB");
  };
  dbOpenRequest.onupgradeneeded = (event) => {
    const db = event.target.result;
    const b = db.createObjectStore("backups");
    b.put(JSON.parse(localStorage.kkleeMapBackups || "[]"), 1);
    delete localStorage.kkleeMapBackups;
  };

  kklee.getBackupLabel = (b) =>
    `${b.mapLabel} - ${new Date(b.timestamp).toLocaleString()}`;
  kklee.loadBackup = (b) =>
    kklee.setMapObject(kklee.mapEncoder.decodeFromDatabase(b.mapData));

  function newBackupSessionId() {
    kklee.backupSessionId =
      Date.now().toString(36) + Math.random().toString(36);
  }
  function backUpMap() {
    const mapLabel = `${kklee.mapObject.m.n} by ${kklee.mapObject.m.a}`;
    const mapData = kklee.mapEncoder.encodeToDatabase(kklee.mapObject);
    const lastBackup = kklee.backups[kklee.backups.length - 1];

    if (
      lastBackup &&
      lastBackup.sessionId == kklee.backupSessionId &&
      lastBackup.mapLabel == mapLabel
    ) {
      lastBackup.mapData = mapData;
      lastBackup.timestamp = Date.now();
    } else {
      kklee.backups.push({
        sessionId: kklee.backupSessionId,
        mapLabel: mapLabel,
        timestamp: Date.now(),
        mapData: mapData,
      });
    }

    let i = kklee.backups.length - 1;
    let size = 0;
    while (i >= 0) {
      size += kklee.backups[i].mapData.length;
      if (size > 1e6) break;
      else i--;
    }

    kklee.backups = kklee.backups.slice(i + 1);
    saveBackups();
  }
  newBackupSessionId();
  // ID will be different every time a new room is made
  document
    .getElementById("mainmenuelements")
    .addEventListener("mousemove", () => newBackupSessionId());

  window.kklee.afterSaveHistory = () => {
    backUpMap();
  };

  // Replace Float64Array instances with normal arrays
  window.kklee.saveToUndoHistory = () => {
    function fix(obj) {
      for (const k of Object.keys(obj)) {
        if (obj[k] instanceof Float64Array) obj[k] = [...obj[k]];
        else if (obj[k] instanceof Object) fix(obj[k]);
      }
    }
    fix(kklee.mapObject);
    window.kklee.saveToUndoHistoryOLD();
  };

  /*
    Prevent removal of event listener for activating chat with enter key when
    lobby is hidden
  */
  replace(
    new RegExp(
      "(?<=this\\[.{10,20}\\]=function\\(\\)\\{.{20,40}\
this\\[.{10,20}\\]=false;.{0,11})\\$\\(document\\)\\[.{10,20}\\]\\(.{10,20},\
.{3,4}\\);"
    ),
    ""
  );

  /*
  Colour picker
    this["showColorPicker"] = function(H0R, k0R, C0R, u0R) {
        var Z8D = [arguments];
        Z8D[6] = E8TT;
        j8D[8]["style"]["backgroundColor"] = j7S[29]["numToHex"](Z8D[0][0]);
        Z8D[2] = K8u(Z8D[0][0]);
        j8D[41] = Z8D[2]["hue"];
        j8D[26] = Z8D[2]["brightness"];
        j8D[38] = Z8D[2]["saturation"];
        j8D[88] = Z8D[0][2];
        j8D[22] = Z8D[0][3];
        j8D[32] = Z8D[0][0];
        M8u(false);
        e8u(Z8D[0][1]);
        j8D[1]["style"]["display"] = "block";
    }
  */
  replace(
    new RegExp(
      "((?<=this\\[.{10,25}\\]=function\\(.{3,4},.{3,4}\
,.{3,4},.{3,4}\\)\\{).{50,250}(.{3,4}\\[.{0,25}\\]=.{3,4}\\[.{0,30}\\];){3}\
.{0,75}.{3,4}\\(false\\).{0,75};\\};)",
      "g"
    ),
    `window.kklee.showColourPickerArguments=[...arguments];\
document.getElementById("kkleeColourInput").value="#"+arguments[0]\
.toString(16).padStart(6,"0");$1;\
let Kscpa=this["showColorPicker"];window.kklee.setColourPickerColour=\
function(c){Kscpa(c,...window.kklee.showColourPickerArguments.slice(1));};\
window.kklee.bonkShowColorPicker=Kscpa;`
  );
  // Map editor test TimeMS
  window.kklee.editorPreviewTimeMs = 30;
  replace(
    new RegExp(
      "(?<=(?<!Infinity.{0,300});.{3,4}\\[.{1,20}\\]\\=)30\
(?=;.{0,30}while.{10,150}Date.{0,5000})",
      "g"
    ),
    "window.kklee.editorPreviewTimeMs"
  );

  /* 
  Stage renderer that contains methods that is used for the
  Map editor preview, tutorial, replays etc..
  - panStage(-xDelta, yDelta) // (Positive xDelta will move left)
  - scaleStage(scale) // Scales the stage by scale
  - resetStage() // Resets the stage zoom
  - getCanvas() // Returns the HTMLCanvas element
  - ...and more
  */
  replace(
    new RegExp("(.{3}\\[.{1,3}\\]=new .{1,3}\\(document)"),
    "window.kklee.stageRenderer=$1"
  );

  /*
  Map editor rectangle overlay drawing
    if (C3V[22]) {
      C3V[38] = new PIXI.Graphics();  // Exported as
                                      //   kklee.editorImageOverlay.background
      C3V[38].lineStyle(4, 16776960); // Set the outline to yellow (0xffff00)
      S9L.u1R(15);
      C3V[38].drawRect(-2, -2, S9L.N1R(4, 730), S9L.g1R(4, 500)); // Draw rect
      C3V[19].addChild(C3V[38]);
      C3V[92] = new PIXI.Graphics();
      C3V[19].addChild(C3V[92]);
    }
  */

  // Exposes variable used for map editor preview overlay drawing
  kklee.editorImageOverlay = {
    opacity: 0.3,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    angle: 0,
    ogW: 0,
    ogH: 0,
    sprite: null,
    imageState: "none",
  };
  replace(
    new RegExp(
      "(.{1,3}\\[.{1,3}\\]=new PIXI\\[.{1,3}\\[.{1,3}\\]\\[.{1,3}\\]\\]\
\\(\\);.{0,500}.{1,3}\\[.{1,3}\\]\\[.{1,3}\\[.{1,3}\\]\\[.{1,3}\\]\\]\\(4,0xffff00\\);)"
    ),
    "window.kklee.editorImageOverlay.background=$1"
  );

  kklee.editorImageOverlay.updateSpriteSettings = () => {
    const e = kklee.editorImageOverlay,
      p = e.sprite;
    p.x = e.x + 365;
    p.y = e.y + 250;
    p.width = e.w;
    p.height = e.h;
    p.alpha = e.opacity;
    p.angle = e.angle;
    kklee.updateRenderer(true);
  };
  kklee.editorImageOverlay.loadImage = (event) => {
    // If nothing is passed, then reset the image
    if (!event || !event.target || !event.target.files.length) {
      if (kklee.editorImageOverlay.sprite)
        kklee.editorImageOverlay.sprite.destroy();
      kklee.editorImageOverlay.sprite = null;
      kklee.updateRenderer(true);
      kklee.editorImageOverlay.imageState = "none";
      kklee.rerenderKklee();
      return;
    }

    const target = event.target;
    const img = new Image();

    // If someone tries something that an <img> can't handle
    img.onerror = () => {
      if (kklee.editorImageOverlay.sprite)
        kklee.editorImageOverlay.sprite.destroy();
      kklee.editorImageOverlay.sprite = null;
      kklee.updateRenderer(true);

      kklee.editorImageOverlay.imageState = "error";
      kklee.rerenderKklee();
    };
    img.onload = () => {
      try {
        const e = kklee.editorImageOverlay;
        if (e.sprite) e.sprite.destroy();
        e.sprite = window.PIXI.Sprite.from(window.PIXI.Texture.from(img));
        e.background.addChild(e.sprite);

        e.sprite.anchor.set(0.5);
        e.ogW = e.sprite.texture.width;
        e.ogH = e.sprite.texture.height;
        e.w = e.ogW;
        e.h = e.ogH;
        e.updateSpriteSettings();

        e.imageState = "image";
        kklee.rerenderKklee();
      } catch (er) {
        console.error(er);
        if (kklee.editorImageOverlay.sprite)
          kklee.editorImageOverlay.sprite.destroy();
        kklee.editorImageOverlay.sprite = null;
        kklee.updateRenderer(true);

        kklee.editorImageOverlay.imageState = "error";
        kklee.rerenderKklee();
      }
    };

    // Load the image from file picker to the <Image> element
    img.src = URL.createObjectURL(target.files[0]);
  };

  kklee.dataLimitInfo = () => {
    try {
      const d = atob(
        window.LZString.decompressFromEncodedURIComponent(
          kklee.mapEncoder.encodeToDatabase(kklee.mapObject)
        )
      ).length;
      return `${d}/102400 bytes`;
    } catch {
      return "Over data limit";
    }
  };
  kklee.dispatchInputEvent = (el) => el.dispatchEvent(new InputEvent("input"));

  require("./nimBuild.js");
  console.log("kklee injector run");
  return src;
}

if (!window.bonkCodeInjectors) window.bonkCodeInjectors = [];
window.bonkCodeInjectors.push((bonkCode) => {
  try {
    return injector(bonkCode);
  } catch (error) {
    alert(
      `Whoops! kklee was unable to load.


This may be due to an update to Bonk.io. If so, please report this error!


This could also be because you have an extension that is incompatible with \
kklee, such as the Bonk Leagues Client. You would have to disable it to use \
kklee.
    `
    );
    throw error;
  }
});
console.log("kklee injector loaded");

const currentVersion = require("../dist/manifest.json")
  .version.split(".")
  .map(Number); // "0.10" --> [0,10]

(async () => {
  const req = await fetch("https://api.github.com/repos/kklkkj/kklee/releases");
  const releases = await req.json();
  let outdated = false;
  for (const r of releases) {
    // "v0.10" --> [0,10]
    const version = r.tag_name.substr(1).split(".").map(Number);
    if (version.length != 2 || isNaN(version[0]) || isNaN(version[1])) continue;
    if (
      version[0] > currentVersion[0] ||
      (version[0] == currentVersion[0] && version[1] > currentVersion[1])
    ) {
      outdated = true;
      break;
    }
  }
  if (!outdated) return;

  try {
    const el = document.createElement("span");
    el.textContent = "A new version of kklee is available! Click this";
    el.style =
      "position: absolute; background: linear-gradient(#33a, #d53);\
line-height: normal;";
    el.onclick = () => window.open("https://github.com/kklkkj/kklee");
    parent.document.getElementById("bonkioheader").appendChild(el);
  } catch (error) {
    console.error(error);
    alert("A new version of kklee is available!");
  }
})().catch((err) => {
  console.error(err);
  alert(
    "Something went wrong with checking if the current version of kklee is \
outdated"
  );
});
