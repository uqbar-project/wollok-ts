import wollok.game.*
//TODO: Move to language?
object io {
  // TODO: merge handlers
  const property eventHandlers = new Dictionary()
  const property timeHandlers = new Dictionary()
  var property eventQueue = []
  var property currentTime = 0
  var property errorHandler = { exception => console.println(exception)}
  var property domainExceptionHandler = {exception => game.say(exception.source(), exception.message())}

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
      eventHandlers.getOrElse(event, { [] }).forEach{ callback => self.runHandler({ callback.apply() }) }
    }

    timeHandlers.values().flatten().forEach{ callback => self.runHandler({ callback.apply(time) }) }
    currentTime = time
  }

  method runHandler(callback) {
    try { 
      callback.apply()
    } catch e: DomainException{
      domainExceptionHandler.apply(e)
    } catch e {
      errorHandler.apply(e)
    }
    //TODO: catch Exception ?
  }

}