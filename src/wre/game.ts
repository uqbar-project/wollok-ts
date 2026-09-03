import { GAME_MODULE } from '../constants'
import { assertIsNotNull, assertIsNumber, Evaluation, Execution, NativeFunction, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'
const { round } = Math


/**
 * Avoid to invoke getters method from properties by accessing directly to the variable
 */
const getter = (message: string): NativeFunction => function* (obj: RuntimeObject): Execution<RuntimeValue> {
  const method = obj.module.lookupMethod(message, 0)!
  return method.isSynthetic ? obj.get(message)! : yield* this.invoke(method, obj)
}

const getPosition = getter('position')
const getX = getter('x')
const getY = getter('y')


class GameSpatialGrid {
  private cells = new Map<string, RuntimeObject[]>()
  private visualToKey = new Map<RuntimeObject, string>()
  private visualToPos = new Map<RuntimeObject, RuntimeValue>()
  private multiObjectCellCount = 0
  private clean = false
  static key(x: number, y: number): string {
    return `${x},${y}`
  }

  isClean(): boolean {
    return this.clean
  }

  markClean(): void {
    if (!this.clean) {
      this.clean = true
      queueMicrotask(() => {
        this.clean = false
      })
    }
  }

  markDirty(): void {
    this.clean = false
  }

  hasAnyCollisions(): boolean {
    return this.multiObjectCellCount > 0
  }

  get(x: number, y: number): RuntimeObject[] {
    return this.cells.get(GameSpatialGrid.key(x, y)) ?? []
  }

  hasCachedPosition(visual: RuntimeObject, currentPosObj: RuntimeValue): boolean {
    return this.visualToPos.get(visual) === currentPosObj
  }

  update(visual: RuntimeObject, x: number, y: number, posObj?: RuntimeValue): void {
    const newKey = GameSpatialGrid.key(x, y)
    const oldKey = this.visualToKey.get(visual)

    if (posObj !== undefined) {
      this.visualToPos.set(visual, posObj)
    }

    if (oldKey === newKey) return

    if (oldKey !== undefined) {
      this.removeFromCell(visual, oldKey)
    }

    this.visualToKey.set(visual, newKey)
    const cell = this.cells.get(newKey)
    if (cell) {
      cell.push(visual)
      if (cell.length === 2) {
        this.multiObjectCellCount++
      }
    } else {
      this.cells.set(newKey, [visual])
    }
  }

  remove(visual: RuntimeObject): void {
    const oldKey = this.visualToKey.get(visual)
    if (oldKey !== undefined) {
      this.removeFromCell(visual, oldKey)
      this.visualToKey.delete(visual)
      this.visualToPos.delete(visual)
      this.markDirty()
    }
  }

  retainOnly(currentVisuals: RuntimeObject[]): void {
    const currentSet = new Set(currentVisuals)
    for (const visual of this.visualToKey.keys()) {
      if (!currentSet.has(visual)) {
        this.remove(visual)
      }
    }
  }

  clear(): void {
    this.cells.clear()
    this.visualToKey.clear()
    this.visualToPos.clear()
    this.multiObjectCellCount = 0
    this.markDirty()
  }

  private removeFromCell(visual: RuntimeObject, key: string): void {
    const cell = this.cells.get(key)
    if (cell) {
      const idx = cell.indexOf(visual)
      if (idx !== -1) cell.splice(idx, 1)
      if (cell.length === 1) {
        this.multiObjectCellCount--
      } else if (cell.length === 0) {
        this.cells.delete(key)
      }
    }
  }
}

const grids = new WeakMap<RuntimeObject, GameSpatialGrid>()

function getGrid(game: RuntimeObject): GameSpatialGrid {
  let grid = grids.get(game)
  if (!grid) {
    grid = new GameSpatialGrid()
    grids.set(game, grid)
  }
  return grid
}

function tryFastGetCoordinates(visual: RuntimeObject): { x: number, y: number, posObj: RuntimeValue } | null {
  const posMethod = visual.module.lookupMethod('position', 0)
  if (!posMethod || !posMethod.isSynthetic) return null

  const posVal = visual.get('position')
  if (!(posVal instanceof RuntimeObject)) return null

  const xMethod = posVal.module.lookupMethod('x', 0)
  const yMethod = posVal.module.lookupMethod('y', 0)
  if (!xMethod || !xMethod.isSynthetic || !yMethod || !yMethod.isSynthetic) return null

  const xVal = posVal.get('x')
  const yVal = posVal.get('y')

  const x = xVal instanceof RuntimeObject ? xVal.innerNumber : undefined
  const y = yVal instanceof RuntimeObject ? yVal.innerNumber : undefined
  if (x === undefined || y === undefined) return null

  return { x: round(x), y: round(y), posObj: posVal }
}

function tryFastPosCoordinates(posVal: RuntimeObject): { x: number, y: number } | null {
  const xMethod = posVal.module.lookupMethod('x', 0)
  const yMethod = posVal.module.lookupMethod('y', 0)
  if (!xMethod || !xMethod.isSynthetic || !yMethod || !yMethod.isSynthetic) return null

  const xVal = posVal.get('x')
  const yVal = posVal.get('y')

  const x = xVal instanceof RuntimeObject ? xVal.innerNumber : undefined
  const y = yVal instanceof RuntimeObject ? yVal.innerNumber : undefined
  if (x === undefined || y === undefined) return null

  return { x: round(x), y: round(y) }
}

const getPosCoordinates = function* (this: Evaluation, posVal: RuntimeObject): Execution<{ x: number, y: number }> {
  const fast = tryFastPosCoordinates(posVal)
  if (fast) return fast

  const xMethod = posVal.module.lookupMethod('x', 0)
  const yMethod = posVal.module.lookupMethod('y', 0)

  const xVal = xMethod?.isSynthetic ? posVal.get('x') : yield* getX.call(this, posVal)
  const yVal = yMethod?.isSynthetic ? posVal.get('y') : yield* getY.call(this, posVal)

  const x = xVal?.innerNumber
  const y = yVal?.innerNumber
  if (x === undefined || y === undefined) throw new RangeError('Position without coordinates')

  return { x: round(x), y: round(y) }
}

const getCoordinates = function* (this: Evaluation, visual: RuntimeObject): Execution<{ x: number, y: number }> {
  const fast = tryFastGetCoordinates(visual)
  if (fast) return { x: fast.x, y: fast.y }

  const posMethod = visual.module.lookupMethod('position', 0)
  const posVal = posMethod?.isSynthetic ? visual.get('position') : yield* getPosition.call(this, visual)

  if (!(posVal instanceof RuntimeObject)) throw new RangeError('Position without coordinates')

  return yield* getPosCoordinates.call(this, posVal)
}

const safeGetCoordinates = function* (this: Evaluation, visual: RuntimeObject): Execution<{ x: number, y: number } | undefined> {
  const fast = tryFastGetCoordinates(visual)
  if (fast) return { x: fast.x, y: fast.y }

  try {
    const posMethod = visual.module.lookupMethod('position', 0)
    if (!posMethod) return undefined

    const posVal = posMethod.isSynthetic ? visual.get('position') : yield* getPosition.call(this, visual)
    if (!(posVal instanceof RuntimeObject)) return undefined

    const xMethod = posVal.module.lookupMethod('x', 0)
    const yMethod = posVal.module.lookupMethod('y', 0)
    if (!xMethod || !yMethod) return undefined

    const xVal = xMethod.isSynthetic ? posVal.get('x') : yield* getX.call(this, posVal)
    const yVal = yMethod.isSynthetic ? posVal.get('y') : yield* getY.call(this, posVal)

    const x = xVal?.innerNumber
    const y = yVal?.innerNumber
    if (x === undefined || y === undefined) return undefined

    return { x: round(x), y: round(y) }
  } catch {
    return undefined
  }
}

const syncGrid = function* (this: Evaluation, game: RuntimeObject, visuals: RuntimeObject[]): Execution<GameSpatialGrid> {
  const grid = getGrid(game)

  if (grid.isClean()) {
    return grid
  }

  grid.retainOnly(visuals)

  for (const visual of visuals) {
    const fastCoords = tryFastGetCoordinates(visual)
    if (fastCoords) {
      if (grid.hasCachedPosition(visual, fastCoords.posObj) && (fastCoords.posObj as RuntimeObject).module.name === 'Position') {
        continue
      }
      grid.update(visual, fastCoords.x, fastCoords.y, fastCoords.posObj)
    } else {
      const coords = yield* safeGetCoordinates.call(this, visual)
      if (coords) {
        grid.update(visual, coords.x, coords.y)
      } else {
        grid.remove(visual)
      }
    }
  }

  grid.markClean()
  return grid
}


const processCollisions = function* (this: Evaluation, _game: RuntimeObject): Execution<void> {}

const game: Natives = {
  game: {
    *addVisual(self: RuntimeObject, positionable: RuntimeObject): Execution<void> {
      assertIsNotNull(positionable, 'addVisual', 'positionable')
      if (!positionable.module.lookupMethod('position', 0)) throw new TypeError('Message addVisual: positionable lacks a position message')

      const visuals = self.get('visuals')!.innerCollection!
      if (visuals.includes(positionable)) throw new RangeError('Visual is already in the game! You cannot add duplicate elements')
      visuals.push(positionable)
      getGrid(self).markDirty()
    },

    *removeVisual(self: RuntimeObject, visual: RuntimeObject): Execution<void> {
      const visuals = self.get('visuals')!
      yield* this.send('remove', visuals, visual)
      getGrid(self).remove(visual)
    },

    *allVisuals(self: RuntimeObject): Execution<RuntimeValue> {
      const visuals = self.get('visuals')!
      return yield* this.list(...visuals.innerCollection ?? [])
    },

    *hasVisual(self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      const visuals = self.get('visuals')!
      return yield* this.send('contains', visuals, visual)
    },

    *getObjectsIn(self: RuntimeObject, position: RuntimeObject): Execution<RuntimeValue> {
      assertIsNotNull(position, 'getObjectsIn', 'position')
      const coords = yield* getPosCoordinates.call(this, position)

      const visuals = self.get('visuals')!.innerCollection!
      const grid = yield* syncGrid.call(this, self, visuals)
      const matches = grid.get(coords.x, coords.y)

      if (matches.length === 0) return yield* this.list()
      return yield* this.list(...matches)
    },

    *say(self: RuntimeObject, visual: RuntimeObject, message: RuntimeObject): Execution<void> {
      const currentTime = (yield* this.send('currentTime', self))!.innerNumber!
      const MESSAGE_SAY_TIME = 2000 // ms
      const messageTime = yield* this.reify(currentTime + MESSAGE_SAY_TIME)

      visual.set('message', message)
      visual.set('messageTime', messageTime)
    },

    *colliders(self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      assertIsNotNull(visual, 'colliders', 'visual')
      const coords = yield* getCoordinates.call(this, visual)

      const visuals = self.get('visuals')!.innerCollection!
      const grid = yield* syncGrid.call(this, self, visuals)

      // Step 1 & 2: If no cell in the whole grid has multiple objects and visual is tracked, no collision is possible
      if (!grid.hasAnyCollisions() && visuals.includes(visual)) {
        return yield* this.list()
      }

      const cellObjects = grid.get(coords.x, coords.y)
      if (cellObjects.length === 0 || cellObjects.length === 1 && cellObjects[0] === visual) {
        return yield* this.list()
      }

      const matches = cellObjects.filter(obj => obj !== visual)
      return yield* this.list(...matches)
    },
    *onCollideDo(_self: RuntimeObject, _visual: RuntimeObject, _action: RuntimeObject): Execution<void> {},

    *whenCollideDo(_self: RuntimeObject, _visual: RuntimeObject, _action: RuntimeObject): Execution<void> {},

    *flushEvents(self: RuntimeObject, time: RuntimeObject): Execution<void> {
      const io = this.object('wollok.lang.io')
      yield* this.send('flushEvents', io, time)
    },


    *onCollideDo(self: RuntimeObject, visual: RuntimeObject, action: RuntimeObject): Execution<void> {
      assertIsNotNull(visual, 'onCollideDo', 'visual')
      assertIsNotNull(action, 'onCollideDo', 'action')
      getGrid(self).addListener(visual, action, 'on')
    },

    *whenCollideDo(self: RuntimeObject, visual: RuntimeObject, action: RuntimeObject): Execution<void> {
      assertIsNotNull(visual, 'whenCollideDo', 'visual')
      assertIsNotNull(action, 'whenCollideDo', 'action')
      getGrid(self).addListener(visual, action, 'when')
    },

    *flushEvents(self: RuntimeObject, time: RuntimeObject): Execution<void> {
      const io = this.object('wollok.lang.io')
      yield* this.send('flushEvents', io, time)
      yield* processCollisions.call(this, self)
    },

  },

  Sound: {
    *play(self: RuntimeObject): Execution<void> {
      const game = this.object(GAME_MODULE)!

      const sounds = game.get('sounds')?.innerCollection
      if (!sounds) game.set('sounds', yield* this.list(self))
      else {
        if (sounds.includes(self)) throw new RangeError('Sound is already in the game! You cannot add duplicate elements')
        else sounds.push(self)
      }

      self.set('status', this.reify('played'))
    },

    *stop(self: RuntimeObject): Execution<void> {
      if (self.get('status')?.innerString !== 'played') throw new Error('You cannot stop a sound that is not played')

      const game = this.object(GAME_MODULE)!
      const sounds = game.get('sounds')
      if (sounds) yield* this.send('remove', sounds, self)

      self.set('status', yield* this.reify('stopped'))
    },

    *pause(self: RuntimeObject): Execution<void> {
      if (self.get('status')?.innerString !== 'played') throw new Error('You cannot pause a sound that is not played')

      self.set('status', this.reify('paused'))
    },

    *resume(self: RuntimeObject): Execution<void> {
      if (self.get('status')?.innerString !== 'paused') throw new Error('You cannot resume a sound that is not paused')

      self.set('status', this.reify('played'))
    },

    *played(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.get('status')?.innerString === 'played')
    },

    *paused(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.get('status')?.innerString === 'paused')
    },

    *volume(self: RuntimeObject, newVolume?: RuntimeObject): Execution<RuntimeValue> {
      if (!newVolume) return self.get('volume')

      const volume: RuntimeObject = newVolume
      assertIsNumber(volume, 'volume', 'newVolume', false)

      if (volume.innerNumber < 0 || volume.innerNumber > 1) throw new RangeError('volumen: newVolume should be between 0 and 1')

      self.set('volume', volume)
    },

    *shouldLoop(self: RuntimeObject, looping?: RuntimeObject): Execution<RuntimeValue> {
      if (!looping) return self.get('loop')
      self.set('loop', looping)
    },

  },
}

export default game