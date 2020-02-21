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

  method eventHandlersFor(event) {
    if (!eventHandlers.containsKey(event)) eventHandlers.put(event, [])
    return eventHandlers.get(event)
  }

  method addEventHandler(event, callback) {
    self.eventHandlersFor(event).add(callback)
  }

  method removeEventHandler(event) {
    eventHandlers.remove(event)
  }

  method timeHandlers(name) { 
    if (!timeHandlers.containsKey(name)) timeHandlers.put(name, [])
    return timeHandlers.get(name)
  }

  method addTimeHandler(name, callback) {
    self.timeHandlers(name).add(callback)
  }

  method removeTimeHandler(name) {
    timeHandlers.remove(name)
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