#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as toml from "@iarna/toml";
import * as dotenv from "dotenv";
import { parse as parseJsonc } from "jsonc-parser";
import { convertWranglerToWorkerConfig } from "./wrangler-converter";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

async function promptForMigrationTag(): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question("Enter migration_tag: ");
  rl.close();
  return answer.trim();
}

function findConfigFile(): string | null {
  const cwd = process.cwd();
  const candidates = ["wrangler.toml", "wrangler.json", "wrangler.jsonc"];

  let i = 0;
  while (i < candidates.length) {
    const candidate = candidates[i];
    const fullPath = path.join(cwd, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
    i++;
  }

  return null;
}

function parseConfigFile(filePath: string): any {
  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".toml") {
    return toml.parse(content);
  } else if (ext === ".json") {
    return JSON.parse(content);
  } else if (ext === ".jsonc") {
    return parseJsonc(content);
  }

  throw new Error(`Unsupported config file format: ${ext}`);
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const result = dotenv.config({ path: filePath });
  return result.parsed || {};
}

function mergeEnvFiles(): Record<string, string> {
  const cwd = process.cwd();
  const envFiles = [".env", ".dev.vars"];
  let merged: Record<string, string> = {};

  let i = 0;
  while (i < envFiles.length) {
    const envFile = envFiles[i];
    const fullPath = path.join(cwd, envFile);
    const parsed = parseEnvFile(fullPath);
    merged = { ...merged, ...parsed };
    i++;
  }

  return merged;
}

async function main() {
  try {
    console.log("🔍 Looking for Wrangler config...");

    const configPath = findConfigFile();
    if (!configPath) {
      console.error(
        "❌ No wrangler config file found (wrangler.toml, wrangler.json, or wrangler.jsonc)"
      );
      process.exit(1);
    }

    console.log(`📄 Found config: ${path.basename(configPath)}`);

    const config = parseConfigFile(configPath);
    console.log("✅ Config parsed successfully");

    console.log("🔍 Looking for environment files...");
    const env = mergeEnvFiles();

    const envKeys = Object.keys(env);
    if (envKeys.length > 0) {
      console.log(`📝 Found ${envKeys.length} environment variables`);
    } else {
      console.log("📝 No environment files found or empty");
    }

    const migration_tag = await promptForMigrationTag();

    console.log("🔄 Converting config...");
    const result = convertWranglerToWorkerConfig(config, env, migration_tag);

    const outputPath = path.join(process.cwd(), "metadata.json");
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`✅ Conversion complete! Output written to ${outputPath}`);
    console.log(
      `📊 Generated ${result.routes.length} routes for worker "${result.scriptName}"`
    );

    if (result.metadata.bindings) {
      console.log(`🔗 Generated ${result.metadata.bindings.length} bindings`);
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
