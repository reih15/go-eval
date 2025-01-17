"use strict";

async function readFile(filePath) {
  const response = await fetch(filePath);

  if (!response.ok) {
    throw new Error(`Network Error: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

function gtpToWgoCoords(gtpCoords, boardYSize) {
  if (typeof gtpCoords !== "string" || gtpCoords.length < 2) {
    throw new Error(`Invalid gtpCoords: ${gtpCoords}`);
  }

  const col = gtpCoords.charCodeAt(0) - "A".charCodeAt(0);
  const row = boardYSize - Number(gtpCoords.slice(1));

  if (col >= 8) {
    return [col - 1, row];
  }
  return [col, row];
}

(async () => {
  const url = new URL(location.href);
  const allPositions = (await readFile("./all_positions.txt")).trim().split("\n");

  if (!url.searchParams.has("id")) {
    const i = Math.floor(Math.random() * allPositions.length);
    url.searchParams.append("id", allPositions[i]);
    window.location.href = url.toString();
  }

  document.getElementById("next-position-top").href = url.pathname;
  document.getElementById("next-position-bottom").href = url.pathname;

  const positionId = url.searchParams.get("id");
  if (!allPositions.includes(positionId)) {
    throw new Error(`Invalid positionId: ${positionId}`);
  }

  const sgf = await readFile(`./positions/${positionId}/pos.sgf`);

  const board = new WGo.BasicPlayer(document.getElementById("main-board"), {
    sgf: sgf,
    layout: { top: ["Control"] },
  });
  board.last();

  document.getElementById("turn").innerText = board.kifuReader.game.turn === WGo.B ? "黒(B)" : "白(W)";
  document.getElementById("komi").innerText = board.kifu.info.KM;
  document.getElementById("rule").innerText = board.kifu.info.RU;
  document.getElementById("capture-black").innerText = board.kifuReader.game.getCaptureCount(WGo.B);
  document.getElementById("capture-white").innerText = board.kifuReader.game.getCaptureCount(WGo.W);

  document.getElementById("copy-sgf").addEventListener("click", () => {
    navigator.clipboard.writeText(sgf);

    const button = document.getElementById("copy-sgf");
    const originalText = button.textContent;
    button.textContent = "Copied!";

    setTimeout(() => {
      button.textContent = originalText;
    }, 1500);
  });

  const infoString = await readFile(`./positions/${positionId}/info.txt`);

  const info = infoString.trim().split("\n");
  const modelName = info[0].trim();
  const movesInfo = info.slice(1);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  if (movesInfo.length > alphabet.length) {
    throw new Error("Too many choices");
  }

  const labels = alphabet
    .slice(0, movesInfo.length)
    .split("")
    .sort(() => 0.5 - Math.random());

  const map = new Map();
  for (let i = 0; i < movesInfo.length; i++) {
    const m = new Map();
    m.set("label", labels[i]);
    const xs = movesInfo[i].trim().split(",");
    m.set("visits", xs[1]);
    m.set("winrate", Number(xs[2]) * 100);
    m.set("scoreLead", Number(xs[3]));

    map.set(xs[0], m);
  }

  for (const [k, v] of map) {
    const wgoCoords = gtpToWgoCoords(k, board.kifu.size);
    board.board.addObject({
      x: wgoCoords[0],
      y: wgoCoords[1],
      type: "LB",
      text: v.get("label"),
      c: "rgba(0,0,0,0.8)",
    });
  }

  const details = document.getElementById("eval");
  const summary = document.createElement("summary");
  summary.textContent = `KataGo の評価値を見る (See KataGo's evaluation) [Model: ${modelName}]`;
  details.appendChild(summary);

  for (const k of [...map.keys()].sort((a, b) => map.get(b).get("winrate") - map.get(a).get("winrate"))) {
    const m = map.get(k);
    const label = m.get("label");
    const winrateString = m.get("winrate").toFixed(2);
    const scoreLead = m.get("scoreLead");
    const scoreLeadString = (scoreLead > 0 ? "+" : "") + scoreLead.toFixed(1);
    const visits = m.get("visits");

    const innerDetails = document.createElement("details");
    const s = document.createElement("summary");

    const spanLabel = document.createElement("span");
    spanLabel.textContent = `${label}:`;
    spanLabel.className = "highlight eval-value";
    s.appendChild(spanLabel);

    const spanWinrate = document.createElement("span");
    spanWinrate.textContent = `${winrateString}%`;
    spanWinrate.className = "highlight eval-value";
    s.appendChild(spanWinrate);

    const spanScore = document.createElement("span");
    spanScore.textContent = scoreLeadString;
    spanScore.className = "highlight eval-value";
    s.appendChild(spanScore);

    s.appendChild(document.createTextNode(visits));

    innerDetails.appendChild(s);

    const b = document.createElement("div");
    b.textContent = "Sorry, something went wrong.";
    b.className = "board";
    innerDetails.appendChild(b);

    details.appendChild(innerDetails);

    innerDetails.addEventListener("toggle", () => {
      if (innerDetails.open) {
        window.dispatchEvent(new Event("resize"));
        innerDetails.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    new WGo.BasicPlayer(b, {
      sgf: await readFile(`./positions/${positionId}/${k}.sgf`),
      layout: { top: ["Control"] },
    });
  }
})();
