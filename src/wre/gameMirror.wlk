import wollok.io.*
import wollok.game.*

//TODO: Move to language?
object gameMirror {

	method addVisualCharacter(visual) {
		game.addVisual(visual)
		keyboard.up().onPressDo({ visual.position(visual.position().up(1)) })
		keyboard.down().onPressDo({ visual.position(visual.position().down(1)) })
		keyboard.left().onPressDo({ visual.position(visual.position().left(1)) })
		keyboard.right().onPressDo({ visual.position(visual.position().right(1)) })
	}

  method whenCollideDo(visual, action) {
    io.addTimeHandler(visual.identity(), { time => 
			game.colliders(visual).forEach({it => action.apply(it)})
		})
  }

  method onCollideDo(visual, action) {
		var lastColliders = []
    io.addTimeHandler(visual.identity(), { time => 
			const colliders = game.colliders(visual)
			colliders.forEach({ it => if (game.hasVisual(visual) and !lastColliders.contains(it)) action.apply(it) })
			lastColliders = colliders
		})
  }

	method onTick(milliseconds, name, action) {
		var times = 0
		const initTime = io.currentTime()
		io.addTimeHandler(name, { time => if ((time - initTime).div(milliseconds) > times) { action.apply(); times+=1 } })
	}

	method schedule(milliseconds, action) {
		const name = action.identity()
		self.onTick(milliseconds, name, {
			action.apply()
			io.removeTimeHandler(name)
		})
	}
	
}