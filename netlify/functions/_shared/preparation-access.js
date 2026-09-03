export function judgeDemoEnabled(env = process.env) {
  return env.HENRY_JUDGE_DEMO === "true";
}
