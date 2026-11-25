'use strict';

/**
 * Vercel entry point. Vercel calls this function for every /api/* request
 * (see vercel.json). It reuses the exact same server logic that `npm start` runs locally.
 */
const { createApp } = require('../server');

const app = createApp();

module.exports = (req, res) => app.emit('request', req, res);
