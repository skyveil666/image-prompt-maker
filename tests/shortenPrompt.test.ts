import assert from "node:assert/strict";
import test from "node:test";
import { shortenPrompt } from "../src/lib/shortenPrompt.ts";

const fixed = "【固定】顔・同一性・衣装・背景・体型は元画像を維持。";
const longBody = "【人体補正】手指と関節・体型・接地を元画像に合わせ自然に保つ。" +
  " Anatomically correct hands (5 fingers each), wrists, elbows, legs, knees, ankles, grounding. " +
  "Keep body proportions matched to the reference, do not elongate legs or torso; " +
  "use standard-to-portrait lens only, do not apply fisheye or wide-angle distortion.";

test("短い人体補正行を定型文で長くしない", () => {
  const input = fixed + "\n【人体補正】手指を自然に。";
  assert.equal(shortenPrompt(input), input);
});

test("長い人体補正と英語補足だけを短縮し、固定・変更指示を保持する", () => {
  const change = "【変更】背景を海辺に変更し、人物サイズは維持。";
  const input = [fixed, change, longBody, "Legs: exactly two legs, no extra outlines."].join("\n");
  const output = shortenPrompt(input);
  assert.ok(output.length < input.length);
  assert.ok(output.startsWith(fixed + "\n" + change + "\n"));
  assert.ok(output.includes("体型のプロポーションを元画像と同じに保ち"));
  assert.ok(!output.includes("Anatomically correct"));
  assert.equal(shortenPrompt(output), output);
});

test("複数行NGの英語・空行・末尾空白を保持する", () => {
  for (const heading of ["【NG】", "  【NG】", "《NG》"]) {
    const ng = heading + "\nKeep natural skin texture\n\n\nLegs: extra outlines\n  ";
    const input = [fixed, longBody, ng].join("\n");
    const output = shortenPrompt(input);
    assert.ok(output.length < input.length);
    assert.ok(output.endsWith(ng));
  }
});

test("NGの後の独立セクションは短縮できる", () => {
  const ng = "【NG】\nKeep natural skin texture";
  const input = [fixed, ng, longBody].join("\n");
  const output = shortenPrompt(input);
  assert.ok(output.includes(ng + "\n【人体補正】"));
  assert.ok(output.length < input.length);
});

test("同じ行に別セクションがある想定外形式は保持する", () => {
  const input = fixed + "\n" + longBody + "【NG】温室";
  assert.equal(shortenPrompt(input), input);
});

test("複数案・CRLF・未知形式でもNGと各案の固定を保持する", () => {
  const ng = "【NG】\r\nKeep natural skin texture\r\n";
  const first = fixed + "\r\n" + longBody + "\r\n" + ng;
  const second = fixed + "\n【人体補正】手指を自然に。";
  const output = shortenPrompt(first + "---案区切り---\n" + second);
  const parts = output.split("---案区切り---");
  assert.ok(parts[0].startsWith(fixed + "\r\n"));
  assert.ok(parts[0].endsWith(ng));
  assert.equal(parts[1], "\n" + second);
  assert.equal(shortenPrompt("Keep natural skin texture"), "Keep natural skin texture");
  assert.equal(shortenPrompt(""), "");
});
