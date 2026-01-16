import { jsxDEV } from "react/jsx-dev-runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@websim/remotion/player";
import { ReplayComposition } from "./composition.jsx";
let root = null;
function mountReplay(container, replayData) {
  if (root) {
    root.unmount();
  }
  root = createRoot(container);
  const durationInFrames = replayData.frames ? replayData.frames.length : 1;
  const fps = replayData.fps || 30;
  root.render(
    /* @__PURE__ */ jsxDEV("div", { style: { width: "100%", height: "100%", position: "relative" }, children: /* @__PURE__ */ jsxDEV(
      Player,
      {
        component: ReplayComposition,
        durationInFrames: Math.max(1, durationInFrames),
        fps,
        compositionWidth: 540,
        compositionHeight: 960,
        inputProps: { replayData },
        controls: true,
        loop: true,
        autoPlay: true,
        style: { width: "100%", height: "100%" }
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 20,
        columnNumber: 13
      },
      this
    ) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 19,
      columnNumber: 9
    }, this)
  );
}
function unmountReplay(container) {
  if (root) {
    root.unmount();
    root = null;
  }
}
export {
  mountReplay,
  unmountReplay
};
