import wollok.io.*
import wollok.game.*

//TODO: Move to native
object gameMirror {

  method whenCollideDo(visual, action) {
    io.addTimeHandler(visual.identity(), { time => 
			self.colliders(visual).forEach({it => action.apply(it)})
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

  method colliders(visual) = game.getObjectsIn(visual.position()).filter({it => it != visual})

}