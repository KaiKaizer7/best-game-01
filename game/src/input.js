// EMBERHOLD — input: mouse and keyboard, translated into board cells and commands.
// The canvas is the map; clicks land on cells, keys drive the common commands. The game
// logic itself lives in the world and in main.js — this file only reports what happened.

import { CELL } from './config.js';

export class Input {
  constructor(canvas, handlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.attach();
  }

  cellFromEvent(ev) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (ev.clientX - rect.left) * scaleX;
    const y = (ev.clientY - rect.top) * scaleY;
    return { cx: Math.floor(x / CELL), cy: Math.floor(y / CELL), x, y };
  }

  attach() {
    this.canvas.addEventListener('mousemove', (ev) => {
      const { cx, cy } = this.cellFromEvent(ev);
      this.handlers.mouseMoved?.(cx, cy);
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.handlers.mouseLeft?.();
    });
    this.canvas.addEventListener('click', (ev) => {
      const { cx, cy } = this.cellFromEvent(ev);
      this.handlers.cellClicked?.(cx, cy);
    });
    this.canvas.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      this.handlers.deselect?.();
    });
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat) return;
      const key = ev.key.toLowerCase();
      if (key === ' ' || key === 'spacebar') {
        ev.preventDefault();
        this.handlers.startWave?.();
        return;
      }
      this.handlers.keyPressed?.(key);
    });
  }
}
