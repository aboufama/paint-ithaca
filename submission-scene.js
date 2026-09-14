const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (from, to, value) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, amount) => a + (b - a) * amount;

function surface(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

/** A local visual transition; it does not send a photo or simulate upload progress. */
export class SubmissionScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    if (!this.context) throw new Error('Canvas unavailable');
    this.surfaces = [];
    this.tiles = [];
    this.points = [];
    this.prepared = false;
  }

  async prepare(photoCanvas, { images = [] } = {}) {
    this.dispose();
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    if (!this.width || !this.height || !photoCanvas.width || !photoCanvas.height) {
      throw new Error('A captured photo is required');
    }
    const make = (width, height) => {
      const canvas = surface(width, height);
      this.surfaces.push(canvas);
      return canvas;
    };
    this.photo = make(this.width, this.height);
    this.photo.getContext('2d').drawImage(photoCanvas, 0, 0, this.width, this.height);
    this.edgeVeil = make(this.width, this.height);
    const veilContext = this.edgeVeil.getContext('2d');
    const veilWidth = this.width * .1, veilHeight = this.height * .085;
    for (const [x0, y0, x1, y1, x, y, width, height] of [
      [0, 0, veilWidth, 0, 0, 0, veilWidth, this.height],
      [this.width, 0, this.width - veilWidth, 0, this.width - veilWidth, 0, veilWidth, this.height],
      [0, 0, 0, veilHeight, 0, 0, this.width, veilHeight],
      [0, this.height, 0, this.height - veilHeight, 0, this.height - veilHeight, this.width, veilHeight],
    ]) {
      const gradient = veilContext.createLinearGradient(x0, y0, x1, y1);
      gradient.addColorStop(0, 'rgba(245,243,236,1)');
      gradient.addColorStop(.45, 'rgba(245,243,236,.38)');
      gradient.addColorStop(1, 'rgba(245,243,236,0)');
      veilContext.fillStyle = gradient;
      veilContext.fillRect(x, y, width, height);
    }
    let seed = 70933;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const sources = images.filter(image => (image.naturalWidth || image.width) > 0
      && (image.naturalHeight || image.height) > 0);
    if (!sources.length) sources.push(this.photo);
    this.tileWidth = this.width * .096;
    this.tileHeight = this.tileWidth * this.height / this.width;
    const stepX = this.tileWidth + this.width * .019;
    const stepY = this.tileHeight + this.height * .021;

    // Each thumbnail is prepared once. Animation frames only move these small bitmaps.
    for (let row = -5; row <= 5; row++) {
      for (let column = -4; column <= 4; column++) {
        if (row === 0 && column === 0) continue;
        const image = sources[Math.floor(random() * sources.length)];
        const thumb = make(128, 160);
        const context = thumb.getContext('2d', { alpha: false });
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const cropWidth = Math.min(width, height * .8) / mix(1, 1.2, random());
        const cropHeight = cropWidth / .8;
        context.drawImage(image, (width - cropWidth) * mix(.22, .78, random()),
          (height - cropHeight) * mix(.25, .75, random()), cropWidth, cropHeight, 0, 0, 128, 160);
        context.fillStyle = 'rgba(245,243,236,.07)';
        context.fillRect(0, 0, 128, 160);
        this.tiles.push({
          photo: thumb,
          x: column * stepX + row * this.width * .008,
          y: row * stepY * .94,
          angle: (random() - .5) * .026,
          opacity: mix(.68, .86, random()),
          depth: random(),
        });
      }
    }

    // Sparse neutral points live in the gaps: a quiet hint of spatial reconstruction.
    for (let index = 0; index < 112; index++) {
      const column = Math.floor(random() * 9) - 4;
      const row = Math.floor(random() * 11) - 5;
      this.points.push({
        x: (column + .52 + (random() - .5) * .16) * stepX + row * this.width * .008,
        y: (row + (random() - .5) * .78) * stepY * .94,
        radius: mix(.6, 1.7, random()) * this.width / 800,
        opacity: mix(.16, .44, random()),
        reach: mix(6, 16, random()) * this.width / 800,
      });
    }
    this.prepared = true;
  }

  draw(progress) {
    if (!this.prepared) return;
    const p = clamp(Number.isFinite(progress) ? progress : 0);
    const context = this.context;
    const width = this.width, height = this.height;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    context.filter = 'none';
    context.shadowColor = 'transparent';

    // The first frame is the actual painting, with no overlay, crop, or color change.
    if (p === 0) {
      context.drawImage(this.photo, 0, 0, width, height);
      context.restore();
      return;
    }

    context.fillStyle = '#f5f3ec';
    context.fillRect(0, 0, width, height);
    const travel = smooth(0, .93, p);
    const zoom = Math.exp(Math.log(width / this.tileWidth) * (1 - travel));
    const centerX = width * .5;
    const centerY = mix(height * .5, height * .48, travel);
    const turn = -.027 * travel;
    const cosine = Math.cos(turn), sine = Math.sin(turn);
    const fieldOpacity = smooth(.05, .46, p);
    const project = (x, y) => ({
      x: centerX + (x * cosine - y * sine) * zoom,
      y: centerY + (x * sine + y * cosine) * zoom,
    });
    const reveal = smooth(.32, .85, p);

    context.strokeStyle = '#8b9587';
    context.fillStyle = '#8b9587';
    for (const point of this.points) {
      const position = project(point.x, point.y);
      if (position.x < -20 || position.x > width + 20 || position.y < -20 || position.y > height + 20) continue;
      context.globalAlpha = point.opacity * reveal;
      context.beginPath();
      context.arc(position.x, position.y, point.radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha *= .37;
      context.lineWidth = .65 * width / 800;
      context.beginPath();
      context.moveTo(position.x, position.y);
      context.lineTo(position.x + point.reach, position.y - point.reach * .65);
      context.stroke();
    }

    const drawPhoto = (photo, x, y, cardWidth, cardHeight, angle, opacity, hero = false) => {
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.globalAlpha = opacity;
      const radius = Math.min(4 * width / 800, cardWidth * .055) * travel;
      if (hero) {
        context.shadowColor = `rgba(74,78,61,${.12 * smooth(0, .18, p)})`;
        context.shadowBlur = mix(22, 7, travel) * width / 800;
        context.shadowOffsetY = mix(10, 3, travel) * width / 800;
        context.fillStyle = '#f5f3ec';
        roundedRect(context, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, radius);
        context.fill();
        context.shadowColor = 'transparent';
      }
      roundedRect(context, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, radius);
      context.clip();
      context.drawImage(photo, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
      context.restore();
    };

    const cardWidth = this.tileWidth * zoom;
    const cardHeight = this.tileHeight * zoom;
    for (const tile of this.tiles) {
      const position = project(tile.x, tile.y);
      if (position.x + cardWidth < 0 || position.x - cardWidth > width
        || position.y + cardHeight < 0 || position.y - cardHeight > height) continue;
      // Slight depth changes keep a large collection from feeling like a flat contact sheet.
      const depthScale = mix(1, .976 + tile.depth * .024, travel);
      drawPhoto(tile.photo, position.x, position.y, cardWidth * depthScale, cardHeight * depthScale,
        turn + tile.angle * travel, fieldOpacity * tile.opacity);
    }

    drawPhoto(this.photo, centerX, centerY, cardWidth, cardHeight, turn, 1, true);

    // The arriving image keeps a fine sage outline, with one brief settling breath.
    const arrival = smooth(.78, .96, p);
    const breath = Math.sin(smooth(.76, 1, p) * Math.PI);
    context.save();
    context.translate(centerX, centerY);
    context.rotate(turn);
    context.globalAlpha = arrival * .48;
    context.strokeStyle = '#939e86';
    context.lineWidth = width / 800;
    const inset = (3 + breath * 3) * width / 800;
    roundedRect(context, -cardWidth / 2 - inset, -cardHeight / 2 - inset,
      cardWidth + inset * 2, cardHeight + inset * 2, 6 * width / 800);
    context.stroke();
    context.restore();
    // Let the collection continue into paper rather than end at the viewfinder edge.
    context.globalAlpha = .85 * smooth(.4, .9, p);
    context.drawImage(this.edgeVeil, 0, 0);
    context.restore();
  }

  dispose() {
    for (const canvas of this.surfaces) { canvas.width = 0; canvas.height = 0; }
    this.surfaces = [];
    this.tiles = [];
    this.points = [];
    this.photo = null;
    this.edgeVeil = null;
    this.prepared = false;
  }
}
