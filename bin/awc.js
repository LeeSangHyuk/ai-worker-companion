#!/usr/bin/env node

import { main } from "../npm/cli/main.js";

process.exitCode = await main(process.argv.slice(2));
