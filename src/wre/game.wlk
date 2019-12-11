import wollok.io.*

/**
  * Wollok Game main object 
  */
object game {
	
	/**
	 * Adds an object to the board for drawing it.
	 * Object should understand a position property 
	 * (implemented by a reference or getter method).
	 *
	 * Example:
	 *     game.addVisual(pepita) ==> pepita should have a position property
	 */
	method addVisual(positionable) native

	/**
	 * Adds an object to the board for drawing it on a specific position.
	 *
	 * Example:
	 *     game.addVisualIn(pepita, game.origin()) ==> no need for pepita to have a position property
	 *     game.addVisualIn(pepita, game.at(2, 2))
	 */
	method addVisualIn(element, position) native

	
	/**
	 * Adds an object to the board for drawing it. It can be moved with arrow keys.
	 * That object should understand a position property 
	 * (implemented by a reference or getter method).
	 *
	 * Example:
	 *     game.addVisualCharacter(pepita) ==> pepita should have a position property
	 */
	method addVisualCharacter(positionable) native

	/**
	 * Adds an object to the board for drawing it on a specific position. It can be moved with arrow keys.
	 *
	 * Example:
	 *     game.addVisualCharacterIn(pepita, game.origin()) ==> no need for pepita to have a position property
	 */	
	method addVisualCharacterIn(element, position) native

	/**
	 * Removes an object from the board for stop drawing it.
	 *
	 * Example:
	 *     game.removeVisual(pepita)
	 */
	method removeVisual(visual) native
	
	/**
	 * Adds a block that will be executed each time a specific key is pressed
	 * @see keyboard.onPressDo()
	 */	
	method whenKeyPressedDo(key, action) native

	/**
	 * Adds a block that will be executed when the given object collides with other. 
	 * Two objects collide when are in the same position.
	 *
	 * The block should expect the other object as parameter.
	 *
	 * Example:
	 *     game.whenCollideDo(pepita, { comida => pepita.comer(comida) })
	 */	
	method whenCollideDo(visual, action) {
		io.addTimeHandler(visual.identity(), { time => 
			self.colliders(visual).forEach({it => action.apply(it)})
		})		
	}

	/**
	 * Adds a block with a specific name that will be executed every n milliseconds.
	 * Block expects no argument.
	 * Be careful not to set it too often :)
	 *
	 * Example:
	 *     	game.onTick(5000, "pepitaMoving", { => pepita.position().x(0.randomUpTo(4)) })
	 */
	method onTick(milliseconds, name, action) {
		var times = 0
		const initTime = io.currentTime()
		io.addTimeHandler(name, { time => if ((time - initTime).div(milliseconds) > times) { action.apply(); times+=1 } })
	}
	 
	/**
	 * Remove a tick event created with onTick message
	 *
	 * Example:
	 *      game.removeTickEvent("pepitaMoving")
	 */ 
	method removeTickEvent(name) {
		io.removeTimeHandler(name)
	}

	method schedule(milliseconds, action) {
		const name = action.identity()
		self.onTick(milliseconds, name, {
			action.apply()
			self.removeTickEvent(name)
		})
	}
	
	/**
	 * Returns all objects in given position.
	 *
	 * Example:
	 *     game.getObjectsIn(game.origin())
	 */	
	method getObjectsIn(position) native

	/**
	 * Draws a dialog balloon with given message in given visual object position.
	 *
	 * Example:
	 *     game.say(pepita, "hola!")
	 */
	method say(visual, message) native

	/**
	 * Removes all visual objects on board and configurations (colliders, keys, etc).
	 */	
	method clear() native

	/**
	 * Returns all objects that are in same position of given object.
	 */	
	method colliders(visual) = self.getObjectsIn(visual.position()).filter({it => it != visual})

	/**
	 * Returns the unique object that is in same position of given object.
	 */	
	method uniqueCollider(visual) = self.colliders(visual).uniqueElement()

	/**
	 * Stops render the board and finish the game.
	 */	
	method stop() native
	
	/**
	 * Starts render the board in a new windows.
	 */	
	method start() {
		// TODO: Not sure what this is about
		// self.doStart(runtime.isInteractive())
		self.doStart(false)
	}
	
	/**
	 * Returns a position for given coordinates.
	 */	
	method at(x, y) {
		return new Position(x = x, y = y)
	}

	/**
	 * Returns the position (0,0).
	 */	
	method origin() = self.at(0, 0)

	/**
	 * Returns the center board position (rounded down).
	 */	
	method center() = self.at(self.width().div(2), self.height().div(2))

	/**
	 * Sets game title.
	 */		
	method title(title) native

	/**
	 * Returns game title.
	 */		
	method title() native
	
	/**
	 * Sets board width (in cells).
	 */			
	method width(width) native

	/**
	 * Returns board width (in cells).
	 */		
	method width() native

	/**
	 * Sets board height (in cells).
	 */			
	method height(height) native

	/**
	 * Returns board height (in cells).
	 */		
	method height() native

	/**
	 * Sets cells background image.
	 */			
	method ground(image) native
	
	/**
	 * Sets full background image.
	 */			
	method boardGround(image) native
	
	/**
	 * Attributes will not show when user mouse over a visual component.
	 * Default behavior is to show them.
	 */
	method hideAttributes(visual) native
	
	/**
	 * Attributes will appear again when user mouse over a visual component.
	 * Default behavior is to show them, so this is not necessary.
	 */
	method showAttributes(visual) native
	
	/**
	 * Allows to configure a visual component as "error reporter".
	 * Then every error in game board will be reported by this visual component,
	 * in a balloon message form.
     */
    method errorReporter(visual) native
     
    /**
	 * Plays once a .mp3, .ogg or .wav audio file
     */ 
    method sound(audioFile) native
    
	/** 
	* @private
	*/
	method doStart(isRepl) native
}

/**
 * Represents a position in a two-dimensional gameboard.
 * It is an immutable object since Wollok 1.8.0
 */
class Position {
	const property x = 0
	const property y = 0
	
	/**
	 * Returns a new Position n steps right from this one.
	 */		
	method right(n) = new Position(x = x + n, y = y)
	
	/**
	 * Returns a new Position n steps left from this one.
	 */		
	method left(n) = new Position(x = x - n, y = y)
	
	/**
	 * Returns a new Position n steps up from this one.
	 */		
	method up(n) = new Position(x = x, y = y + n)
	
	/**
	 * Returns a new Position, n steps down from this one.
	 */		
	method down(n) = new Position(x = x, y = y - n) 

	/**
	 * Adds an object to the board for drawing it in self.
	 */
	method drawElement(element) { game.addVisualIn(element, self) } //TODO: Implement native
	
	/**
	 * Adds an object to the board for drawing it in self. It can be moved with arrow keys.
	 */
	method drawCharacter(element) { game.addVisualCharacterIn(element, self) } //TODO: Implement native

	/**
	 * Draw a dialog balloon with given message in given visual object position.
	 */	
	method say(element, message) { game.say(element, message) } //TODO: Implement native

	/**
	 * Returns all objects in self.
	 */	
	method allElements() = game.getObjectsIn(self) //TODO: Implement native
	
	/**
	 * Returns a new position with same coordinates.
	 */	
	method clone() = new Position(x = x, y = y)

	/**
	 * Returns the distance between given position and self.
	 */	
	method distance(position) {
		// self.checkNotNull(position, "distance")
		const deltaX = x - position.x()
		const deltaY = y - position.y()
		return (deltaX.square() + deltaY.square()).squareRoot() 
	}

	/**
	 * Removes all objects in self from the board for stop drawing it.
	 */
	method clear() {
		self.allElements().forEach{it => game.removeVisual(it)}
	}
	
	/**
	 * Two positions are equals if they have same coordinates.
	 */	
	override method ==(other) = x == other.x() && y == other.y()
	
	/**
	 * String representation of a position
	 */
	override method toString() = "(" + x + "," + y + ")"
	
}

/**
 * Keyboard object handles all keys movements. There is a method for each key.
 * 
 * Examples:
 *     keyboard.i().onPressDo { game.say(pepita, "hola!") } 
 *         => when user hits "i" key, pepita will say "hola!"
 *
 *     keyboard.any().onPressDo { game.say(pepita, "you pressed a key!") }
 *         => any key pressed will activate its closure
 */
object keyboard {

	method any() = new Key(keyCodes = [])

	method num(n) = new Key(keyCodes = ["Digit"+n])
	
	method num0() = self.num(0)

	method num1() = self.num(1)

	method num2() = self.num(2)

	method num3() = self.num(3)

	method num4() = self.num(4)

	method num5() = self.num(5)

	method num6() = self.num(6)

	method num7() = self.num(7)

	method num8() = self.num(8)

	method num9() = self.num(9)

	method a() = new Key(keyCodes = ["KeyA"])

	method alt() = new Key(keyCodes = ["Alt", "AltRight", "AltLeft"])

	method b() = new Key(keyCodes = ["KeyB"])

	method backspace() = new Key(keyCodes = ["Backspace"])

	method c() = new Key(keyCodes = ["KeyC"])

	method control() = new Key(keyCodes = ["Control", "ControlLeft", "ControlRight"])

	method d() = new Key(keyCodes = ["KeyD"])

	method del() = new Key(keyCodes = ["Delete"])

	method center() = new Key(keyCodes = [])

	method down() = new Key(keyCodes = ["ArrowDown"])

	method left() = new Key(keyCodes = ["ArrowLeft"])

	method right() = new Key(keyCodes = ["ArrowRight"])

	method up() = new Key(keyCodes = ["ArrowUp"])

	method e() = new Key(keyCodes = ["KeyE"])

	method enter() = new Key(keyCodes = ["Enter"])

	method f() = new Key(keyCodes = ["KeyF"])

	method g() = new Key(keyCodes = ["KeyG"])

	method h() = new Key(keyCodes = ["KeyH"])

	method i() = new Key(keyCodes = ["KeyI"])

	method j() = new Key(keyCodes = ["KeyJ"])

	method k() = new Key(keyCodes = ["KeyK"])

	method l() = new Key(keyCodes = ["KeyL"])

	method m() = new Key(keyCodes = ["KeyM"])

	method minusKey() = new Key(keyCodes = ["Minus"])

	method n() = new Key(keyCodes = ["KeyN"])

	method o() = new Key(keyCodes = ["KeyO"])

	method p() = new Key(keyCodes = ["KeyP"])

	method plusKey() = new Key(keyCodes = ["Plus"])

	method q() = new Key(keyCodes = ["KeyQ"])

	method r() = new Key(keyCodes = ["KeyR"])

	method s() = new Key(keyCodes = ["KeyS"])

	method shift() = new Key(keyCodes = ["Shift", "ShiftLeft", "ShiftRight"])

	method slash() = new Key(keyCodes = ["Slash"])

	method space() = new Key(keyCodes = ["Space"])

	method t() = new Key(keyCodes = ["KeyT"])

	method u() = new Key(keyCodes = ["KeyU"])

	method v() = new Key(keyCodes = ["KeyV"])

	method w() = new Key(keyCodes = ["KeyW"])

	method x() = new Key(keyCodes = ["KeyX"])

	method y() = new Key(keyCodes = ["KeyY"])

	method z() = new Key(keyCodes = ["KeyZ"])

}


class Key {	
	const property keyCodes
	
	/**
	 * Adds a block that will be executed always self is pressed.
	 *
	 * Example:
     	 *     keyboard.i().onPressDo { game.say(pepita, "hola!") } 
     	 *         => when user hits "i" key, pepita will say "hola!"
	 */	
	method onPressDo(action) {
		// keyCodes.forEach{ key => game.whenKeyPressedDo(key, action) }
		keyCodes.forEach { key => game.whenKeyPressedDo(["keydown", key], action) }
	}
}