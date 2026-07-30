import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppRoute } from "./appRoute.ts";

test("her ikisi hazır olana kadar splash'ta kalır", () => {
  assert.equal(resolveAppRoute({ sessionReady: false, minSplashElapsed: false }), "splash");
  assert.equal(resolveAppRoute({ sessionReady: true, minSplashElapsed: false }), "splash");
  assert.equal(resolveAppRoute({ sessionReady: false, minSplashElapsed: true }), "splash");
});

test("ikisi de hazırsa main", () => {
  assert.equal(resolveAppRoute({ sessionReady: true, minSplashElapsed: true }), "main");
});
