#!/usr/bin/env node
// React's development build records every render as a performance measure, and Node keeps them
// all: the monitor re-renders several times a second and ran out of heap after a few hours.
// React picks its build when first loaded, so the variable is set before importing anything that uses it.
// No JSX here: it would compile to a static react/jsx-runtime import, which runs before this line.
process.env.NODE_ENV ??= 'production';

const { createElement } = await import('react');
const { render } = await import('ink');
const { App } = await import('./app.js');

render(createElement(App), { alternateScreen: true });
