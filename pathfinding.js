// pathfinding.js

// Requiere que PathFinding.js esté cargado antes
// https://cdn.jsdelivr.net/npm/pathfinding@0.4.18/PathFinding.min.js

class Pathfinder3D {
  constructor(gridWidth, gridHeight, cellSize = 1) {
    this.width = gridWidth;
    this.height = gridHeight;
    this.cellSize = cellSize;
    this.baseMatrix = this._createEmptyMatrix();
    this.grid = new PF.Grid(this.baseMatrix);
    this.finder = new PF.AStarFinder({
      diagonalMovement: PF.DiagonalMovement.Never
    });
  }

  // Crea una matriz llena de ceros (celdas libres)
  _createEmptyMatrix() {
    return Array.from({ length: this.height }, () =>
      Array(this.width).fill(0)
    );
  }

  // Convierte coordenadas del mundo a índice de la matriz
  worldToGrid(x, z) {
    const col = Math.floor((x + this.width * this.cellSize / 2) / this.cellSize);
    const row = Math.floor((z + this.height * this.cellSize / 2) / this.cellSize);
    return { row, col };
  }

  // Convierte de celda de grid a coordenadas del mundo (centro de celda)
  gridToWorld(col, row) {
    const x = col * this.cellSize - (this.width * this.cellSize / 2) + this.cellSize / 2;
    const z = row * this.cellSize - (this.height * this.cellSize / 2) + this.cellSize / 2;
    return { x, z };
  }

  // Marca obstáculos en el grid usando objetos Three.js (muros)
  setObstaclesFromWalls(walls) {
    this.baseMatrix = this._createEmptyMatrix(); // reinicia
    for (let wall of walls) {
      const box = new THREE.Box3().setFromObject(wall);
      const min = this.worldToGrid(box.min.x, box.min.z);
      const max = this.worldToGrid(box.max.x, box.max.z);
      for (let row = min.row; row <= max.row; row++) {
        for (let col = min.col; col <= max.col; col++) {
          if (this._inBounds(row, col)) {
            this.baseMatrix[row][col] = 1; // bloqueado
          }
        }
      }
    }
    this.grid = new PF.Grid(this.baseMatrix);
  }

  _inBounds(row, col) {
    return row >= 0 && row < this.height && col >= 0 && col < this.width;
  }

  // Encuentra camino entre dos posiciones del mundo
  findPath(fromX, fromZ, toX, toZ) {
    const start = this.worldToGrid(fromX, fromZ);
    const end = this.worldToGrid(toX, toZ);
    const tempGrid = this.grid.clone();

    const path = this.finder.findPath(start.col, start.row, end.col, end.row, tempGrid);
    return path.map(([col, row]) => this.gridToWorld(col, row));
  }

  // Movimiento progresivo hacia el siguiente nodo
  moveEntityAlongPath(entity, path, speed) {
    if (!path || path.length < 2) return;

    const next = path[1]; // primer nodo real
    const dx = next.x - entity.position.x;
    const dz = next.z - entity.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.05) {
      const vx = (dx / dist) * speed;
      const vz = (dz / dist) * speed;
      entity.position.x += vx;
      entity.position.z += vz;
    }
  }
}
