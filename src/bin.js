#!/usr/bin/env node

import { main } from "./main.js";

main(process.argv.slice(2), process.stdin).catch(console.error);
