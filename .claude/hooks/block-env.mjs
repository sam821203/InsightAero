#!/usr/bin/env node
// PreToolUse hook for Bash: blocks shell commands that touch real .env files.
// .env.example stays allowed. Exit code 2 tells Claude Code to block the call.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = input?.tool_input?.command ?? "";

const ENV_FILE = /(^|[\s/'"=<>])\.env(\.local|\.[a-z]+\.local)?(?=$|[\s'";|&)<>])/;

if (ENV_FILE.test(command)) {
  console.error("Blocked: this command touches a .env file, which may hold secrets. Use .env.example instead.");
  process.exit(2);
}
