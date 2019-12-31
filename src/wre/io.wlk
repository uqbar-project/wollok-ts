//TODO: Move to language?
object io {
  // TODO: merge handlers
  const property eventHandlers = new Dictionary()
  const property timeHandlers = new Dictionary()
  var property eventQueue = []
  var property currentTime = 0

  method queueEvent(event) {
    eventQueue.add(event)
  }

  method addEventHandler(event, callback) {
    if (!eventHandlers.containsKey(event)) eventHandlers.put(event, [])
    eventHandlers.get(event).add(callback)
  }

  method removeEventHandler(event) {
    eventHandlers.remove(event)
  }

  method addTimeHandler(event, callback) {
    if (!timeHandlers.containsKey(event)) timeHandlers.put(event, [])
    timeHandlers.get(event).add(callback)
  }

  method removeTimeHandler(event) {
    timeHandlers.remove(event)
  }

  method clear() {
    eventHandlers.clear()
    timeHandlers.clear()
  }

  method flushEvents(time) {
    const currentEvents = eventQueue.copy()
    eventQueue = []
    currentEvents.forEach{ event =>
      eventHandlers.getOrElse(event, { [] }).forEach{ callback => callback.apply() }
    }

    timeHandlers.values().flatten().forEach{ callback => callback.apply(time) }
    currentTime = time
  }

}