'use strict';
// Serverless entry point for Vercel.
//
// Vercel never runs server.js: it imports this file and calls the exported handler
// once per request. An Express app is already a (req, res) function, so it is handed
// over as-is. Routing is in ../vercel.json, which sends /api/* here and serves the
// built client from dist/ as static files.
//
// Everything stateful lives under DATA_DIR, which must point at a writable directory
// (/tmp/data on Vercel). See the deployment section of the README for the full list
// of environment variables.
require('dotenv').config();
const { createApp } = require('../app.js');

module.exports = createApp();
