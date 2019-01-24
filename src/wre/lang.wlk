/**
 * Base class for all Exceptions.
 * Every exception and its subclasses indicates conditions that a reasonable application might want to catch.
 * 
 * @author jfernandes
 * @since 1.0
 */
class Exception {
	const message
	const cause

	/** Constructs a new exception with no detailed message. */
	constructor()
	/** Constructs a new exception with the specified detail message. */
	constructor(_message) = self(_message, null)
	/** Constructs a new exception with the specified detail message and cause. */
	constructor(_message, _cause) { message = _message ; cause = _cause }
	
	/** Prints this exception and its backtrace to the console */
	method printStackTrace() { self.printStackTrace(console) }

	/** Prints this exception and its backtrace as a string value */
	method getStackTraceAsString() {
		const printer = new StringPrinter()
		self.printStackTrace(printer)
		return printer.getBuffer()
	}
	
	/** Prints this exception and its backtrace to the specified printer */
	method printStackTrace(printer) { self.printStackTraceWithPreffix("", printer) }
	
	/** @private */
	method printStackTraceWithPreffix(preffix, printer) {
		printer.println(preffix +  self.className() + (if (message != null) (": " + message.toString()) else ""))
		
		// TODO: eventually we will need a stringbuffer or something to avoid memory consumption
		self.getStackTrace().forEach { e =>
			printer.println("\tat " + e.contextDescription() + " [" + e.location() + "]")
		}
		
		if (cause != null)
			cause.printStackTraceWithPreffix("Caused by: ", printer)
	}
	
	/** @private */
	method createStackTraceElement(contextDescription, location) = new StackTraceElement(contextDescription, location)

	/** Provides programmatic access to the stack trace information printed by printStackTrace() with full path files for linking */
	method getFullStackTrace() native
	
	/** Provides programmatic access to the stack trace information printed by printStackTrace(). */
	method getStackTrace() native
	
	/** Answers the cause of the exception, if present */
	method getCause() = cause
	
	/** Answers the detail message string of this exception. */
	method getMessage() = message
	
	/** Overrides the behavior to compare exceptions */
	override method equals(other) = other.className().equals(self.className()) && other.getMessage() == self.getMessage()
}

/**
 * Thrown when a stack overflow occurs because an application
 * recurses too deeply.
 *
 * @author jfernandes
 * @since 1.5.1
 */
class StackOverflowException inherits Exception {
	constructor() = super()
}

class EvaluationError inherits Exception {
	constructor() = super()
	constructor(_message) = super(_message)
}

/**
 * An exception that is thrown when a specified element cannot be found
 */
class ElementNotFoundException inherits Exception {
	constructor(_message) = super(_message)
	constructor(_message, _cause) = super(_message, _cause)
}

/**
 * An exception that is thrown when an object cannot understand a certain message
 */
class MessageNotUnderstoodException inherits Exception {
	constructor()
	constructor(_message) = super(_message)
	constructor(_message, _cause) = super(_message, _cause)
	
	/*
	'''«super.getMessage()»
		«FOR m : wollokStack»
		«(m as WExpression).method?.declaringContext?.contextName».«(m as WExpression).method?.name»():«NodeModelUtils.findActualNodeFor(m).textRegionWithLineInformation.lineNumber»
		«ENDFOR»
		'''
	*/
}

/**
 * An element in a stack trace, represented by a context and a location of a method where a message was sent
 */
class StackTraceElement {
	const contextDescription
	const location
	constructor(_contextDescription, _location) {
		contextDescription = _contextDescription
		location = _location
	}
	method contextDescription() = contextDescription
	method location() = location
}

/**
 *
 * Representation of Wollok Object
 *
 * Class Object is the root of the class hierarchy. Every class has Object as a superclass.  
 * 
 * @author jfernandes
 * since 1.0
 */
class Object {
  constructor() {
    self.initialize()
  }

  method initialize() { }

	/** Answers object identity of a Wollok object, represented by a unique uuid in Wollok environment */
	method identity() native
	
  /** Object description
	 *
	 * Examples:
	 * 		"2".kindName()  => Answers "a String"
	 *  	2.kindName()    => Answers "a Integer"
	 */
	method kindName() native
	/** Full name of Wollok object class */
	method className() native
	
	/**
	 * Tells whether self object is "equal" to the given object
	 * The default behavior compares them in terms of identity (===)
	 */
	method ==(other) {
		return self === other 
	}
	
	/** Tells whether self object is not equal to the given one */
	method !=(other) = !(self == other)
	
	/**
	 * Tells whether self object is identical (the same) to the given one.
	 */
	method ===(other) native

	/**
	 * Tells whether self object is not identical (the same) to the given one.
	 * @See === message.
	 */
	method !==(other) = ! (self === other)
	
	/**
	 * o1.equals(o2) is a synonym for o1 == o2
	 */
	method equals(other) = self == other

	/**
	 * Generates a Pair key-value association. @see Pair.
	 */
	method ->(other) {
		return new Pair(self, other)
	}

	/**
	 * String representation of Wollok object
	 */
	method toString() native
	
	/**
	 * Provides a visual representation of Wollok Object
	 * By default, same as toString but can be overriden
	 * like in String
	 */
	method printString() = self.toString()

	
	/** @private */
	method messageNotUnderstood(name, parameters) {
		var message = if (name != "toString") self.toString() else self.kindName()
		message += " does not understand " + name
		if (parameters.size() > 0)
			message += "(" + (0..(parameters.size()-1)).map { i => "p" + i }.join(',') + ")"
		else
			message += "()"
		throw new MessageNotUnderstoodException(message)
	}

	/** Builds an exception with a message */		
	method error(message) {
		throw new Exception(message)
	}
}

/** 
 * Representation of a Key/Value Association.
 * It is also useful if you want to model a Point. 
 */
class Pair {
	const x
	const y
	constructor (_x, _y) {
		x = _x
		y = _y
	}
	method getX() { return x }
	method getY() { return y }
	method getKey() { return self.getX() }
	method getValue() { return self.getY() }
}

/**
 * The root class in the collection hierarchy. 
 * A collection represents a group of objects, known as its elements.
 */	
class Collection {

  override method initialize() native

	/**
	  * Answers the element that is considered to be/have the maximum value.
	  * The criteria is given by a closure that receives a single element as input (one of the element)
	  * The closure must return a comparable value (something that understands the >, >= messages).
	  * If collection is empty, an ElementNotFound exception is thrown.
	  *
	  * Example:
	  *       ["a", "ab", "abc", "d" ].max({ e => e.length() })    =>  Answers "abc"
	  */
	method max(closure) = self.absolute(closure, { a, b => a > b })

	/**
	  * Answers the element that represents the maximum value in the collection.
	  * The criteria is by direct comparison of the elements.
	  * Example:
	  *       [11, 1, 4, 8, 3, 15, 6].max()    =>  Answers 15		 
	  */
	method max() = self.max({it => it})

  method maxIfEmpty(continuation) = if (self.isEmpty()) continuation.apply() else self.max()

  method maxIfEmpty(criteria, continuation) = if (self.isEmpty()) continuation.apply() else self.max(criteria)		
	
	/**
	  * Answers the element that is considered to be/have the minimum value.
	  * The criteria is given by a closure that receives a single element as input (one of the element)
	  * The closure must return a comparable value (something that understands the <, <= messages).
	  * Example:
	  *       ["ab", "abc", "hello", "wollok world"].min({ e => e.length() })    =>  Answers "ab"		 
	  */
	method min(closure) = self.absolute(closure, { a, b => a < b} )
	
	/**
	  * Answers the element that represents the minimum value in the collection.
	  * The criteria is by direct comparison of the elements.
	  * Example:
	  *       [11, 1, 4, 8, 3, 15, 6].min()    =>  Answers 1 
	  */
	method min() = self.min({it => it})

    method minIfEmpty(continuation) = if (self.isEmpty()) continuation.apply() else self.min()

  method minIfEmpty(criteria, continuation) = if (self.isEmpty()) continuation.apply() else self.min(criteria)

	/** @private */
	method absolute(closure, criteria) {
		if (self.isEmpty())
			throw new ElementNotFoundException("collection is empty")
		const result = self.fold(null, { acc, e =>
			const n = closure.apply(e) 
			if (acc == null)
				new Pair(e, n)
			else {
				if (criteria.apply(n, acc.getY()))
					new Pair(e, n)
				else
					acc
			}
		})
		return result.getX()
	}
	 
	// non-native methods

	/**
	  * Concatenates this collection to all elements from the given collection parameter giving a new collection
	  * (no side effect) 
	  */
	method +(elements) {
		const newCol = self.copy() 
		newCol.addAll(elements)
		return newCol 
	}
	
	/**
	  * Adds all elements from the given collection parameter to self collection. This is a side-effect operation.
	  */
	method addAll(elements) { elements.forEach { e => self.add(e) } }
	
	/**
	  * Removes all elements of the given collection parameter from self collection. This is a side-effect operation.
	  */
	method removeAll(elements) { 
		elements.forEach { e => self.remove(e) } 
	}
	
	/**
	 * Removes those elements that meet a given condition. This is a side-effect operation.
	 */
	 method removeAllSuchThat(closure) {
	 	self.removeAll( self.filter(closure) )
	 }

	/** Tells whether self collection has no elements */
	method isEmpty() = self.size() == 0
			
	/**
	 * Performs an operation on every element of self collection.
	 * The logic to execute is passed as a closure that takes a single parameter.
	 * @returns nothing
	 * Example:
	 *      plants.forEach { plant => plant.takeSomeWater() }
	 */
	method forEach(closure) {
    self.fold(null, { acc, elemi =>
      closure.apply(elemi)
      return acc
    })
  }
	
	/**
	 * Answers whether all the elements of self collection satisfy a given condition
	 * The condition is a closure argument that takes a single element and Answers a boolean value.
	 * @returns true/false
	 * Example:
	 *      plants.all({ plant => plant.hasFlowers() })
	 */
	method all(predicate) = self.fold(true, { acc, e => if (!acc) acc else predicate.apply(e) })
	
	/**
	 * Tells whether at least one element of self collection satisfies a given condition.
	 * The condition is a closure argument that takes a single element and Answers a boolean value.
	 * @returns true/false
	 * Example:
	 *      plants.any({ plant => plant.hasFlowers() })
	 */
	method any(predicate) = self.fold(false, { acc, e => if (acc) acc else predicate.apply(e) })
	
	/**
	 * Answers the element of self collection that satisfies a given condition.
	 * If more than one element satisfies the condition then it depends on the specific collection class which element
	 * will be returned
	 * @returns the element that complies the condition
	 * @throws ElementNotFoundException if no element matched the given predicate
	 * Example:
	 *      users.find { user => user.name() == "Cosme Fulanito" }
	 */
	method find(predicate) = self.findOrElse(predicate, { 
		throw new ElementNotFoundException("there is no element that satisfies the predicate")
	})

	/**
	 * Answers the element of self collection that satisfies a given condition, 
	 * or the given default otherwise, if no element matched the predicate.
	 * If more than one element satisfies the condition then it depends on the specific
	 * collection class which element
	 * will be returned
	 * @returns the element that complies the condition or the default value
	 * Example:
	 *      users.findOrDefault({ user => user.name() == "Cosme Fulanito" }, homer)
	 */
	method findOrDefault(predicate, value) =  self.findOrElse(predicate, { value })
	
	/**
	 * Answers the element of self collection that satisfies a given condition, 
	 * or the the result of evaluating the given continuation. 
	 * If more than one element satisfies the condition then it depends on the
	 * specific collection class which element
	 * will be returned
	 * @returns the element that complies the condition or the result of evaluating the continuation
	 * Example:
	 *      users.findOrElse({ user => user.name() == "Cosme Fulanito" }, { homer })
	 */
	method findOrElse(predicate, continuation) {
    const response = self.fold(null, {result, elem => if (result == null && predicate.apply(elem)) elem else result })
    return if (response != null) response else continuation.apply()
  }

	/**
	 * Counts all elements of self collection that satisfies a given condition
	 * The condition is a closure argument that takes a single element and Answers a number.
	 * @returns an integer number
	 * Example:
	 *      plants.count { plant => plant.hasFlowers() }
	 */
	method count(predicate) = self.fold(0, { acc, e => if (predicate.apply(e)) acc+1 else acc  })

	/**
	 * Counts the occurrences of a given element in self collection.
	 * @returns an integer number
	 * Example:
	 *      [1, 8, 4, 1].occurrencesOf(1)	=> Answers 2
	 */
	method occurrencesOf(element) = self.count({it => it == element})
	
	/**
	 * Collects the sum of each value for all elements.
	 * This is similar to call a map {} to transform each element into a number object and then adding all those numbers.
	 * The condition is a closure argument that takes a single element and Answers a boolean value.
	 * @returns an integer
	 * Example:
	 *      const totalNumberOfFlowers = plants.sum{ plant => plant.numberOfFlowers() }
	 */
	method sum(closure) = self.fold(0, { acc, e => acc + closure.apply(e) })
	
	/**
	 * Sums all elements in the collection.
	 * @returns an integer
	 * Example:
	 *      const total = [1, 2, 3, 4, 5].sum() 
	 */
	method sum() = self.sum( {it => it} )
	
	/**
	 * Answers a new collection that contains the result of transforming each of self collection's elements
	 * using a given closure.
	 * The condition is a closure argument that takes a single element and Answers an object.
	 * @returns another list
	 * Example:
	 *      const ages = users.map({ user => user.age() })
	 */
	method map(closure) = self.fold([], { acc, e =>
		 acc.add(closure.apply(e))
		 acc
	})
	
	/**
	 * Map + flatten operation
	 * @see map
	 * @see flatten
	 * 
	 * Example
	 * 		object klaus {	var languages = ["c", "cobol", "pascal"]
	 *  		method languages() = languages
	 *		}
	 *		object fritz {	var languages = ["java", "perl"]
	 * 			method languages() = languages
	 * 		}
	 * 		program abc {
	 * 			console.println([klaus, fritz].flatMap({ person => person.languages() }))
	 *				=> Answers ["c", "cobol", "pascal", "java", "perl"]
	 * 		}	
	 */
	method flatMap(closure) = self.fold(self.newInstance(), { acc, e =>
		acc.addAll(closure.apply(e))
		acc
	})

	/**
	 * Answers a new collection that contains the elements that meet a given condition.
	 * The condition is a closure argument that takes a single element and Answers a boolean.
	 * @returns another collection (same type as self one)
	 * Example:
	 *      const overageUsers = users.filter({ user => user.age() >= 18 })
	 */
	 method filter(closure) = self.fold(self.newInstance(), { acc, e =>
		 if (closure.apply(e))
		 	acc.add(e)
		 acc
	})

	/**
	 * Answers whether this collection contains the specified element.
	 */
	method contains(e) = self.any {one => e == one }
	
	/**
	 * Flattens a collection of collections
	 *
	 * Example:
	 * 		[ [1, 2], [3], [4, 0] ].flatten()  => Answers [1, 2, 3, 4, 0]
	 *
	 */
	method flatten() = self.flatMap { e => e }

	/** Converts a collection to a list */
	method asList()
	
	/** Converts a collection to a set (no duplicates) */
	method asSet()

	/**
	 * Answers a new collection of the same type and with the same content 
	 * as self.
	 * @returns a new collection
	 * Example:
	 *      const usersCopy = users.copy() 
	 */
	method copy() {
		var copy = self.newInstance()
		copy.addAll(self)
		return copy
	}
	
	/**
	 * Answers a new List that contains the elements of self collection 
	 * sorted by a criteria given by a closure. The closure receives two objects
	 * X and Y and Answers a boolean, true if X should come before Y in the 
	 * resulting collection.
	 * @returns a new List
	 * Example:
	 *      const usersByAge = users.sortedBy({ a, b => a.age() < b.age() })
	 */
	method sortedBy(closure) {
		var copy = self.copy().asList()
		copy.sortBy(closure)
		return copy
	}
	
	
	/**
	 * Answers a new, empty collection of the same type as self.
	 * @returns a new collection
	 * Example:
	 *      const newCollection = users.newInstance() 
	 */
	method newInstance()
	
	method fold(element, closure) native
	
	/** Removes an element in this collection */ 
	override method remove(element) native
	
	/** Answers the number of elements */
	override method size() native
		
	/** Removes all of the elements from this collection */
	method clear() native

	/** Adds the specified element as last one */
	method add(element) native

	method anyOne() = throw new Exception("Should be implemented by the subclasses")
}

/**
 *
 * A collection that contains no duplicate elements. 
 * It models the mathematical set abstraction. A Set guarantees no order of elements.
 * 
 * @author jfernandes
 * @since 1.3
 */	
class Set inherits Collection {
	constructor(elements...) {
		self.addAll(elements)
	}
	
	/** @private */
	override method newInstance() = #{}
	
  override method toString() = {
    const this = self.asList()
    "#{" +
    if (self.isEmpty()) ""
    else this.subList(1).fold(this.head().printString(), {acc, e => acc + ', ' + e.printString()}) +
    "}"
  }
	
	/** 
	 * Converts this set to a list
	 * @see List
	 */
	override method asList() { 
		const result = []
		result.addAll(self)
		return result
	}
	
	/**
	 * Converts an object to a Set. No effect on Sets.
	 */
	override method asSet() = self

	/**
	 * Answers any element of this collection 
	 */
	override method anyOne() = self.asList().anyOne()

	/**
	 * Answers a new Set with the elements of both self and another collection.
	 * @returns a Set
	 */
	 method union(another) = self + another

	/**
	 * Answers a new Set with the elements of self that exist in another collection
	 * @returns a Set
	 */
	 method intersection(another) = 
	 	self.filter({it => another.contains(it)})
	 	
	/**
	 * Answers a new Set with the elements of self that don't exist in another collection
	 * @returns a Set
	 */
	 method difference(another) =
	 	self.filter({it => !another.contains(it)})
	
	/**
	 * Adds the specified element to this set if it is not already present
	 */
	override method add(element) {
    if(!self.contains(element)) super(element)
  }

	/**
	 * Answers the concatenated string representation of the elements in the given set.
	 * You can pass an optional character as an element separator (default is ",")
	 *
	 * Examples:
	 * 		[1, 5, 3, 7].join(":") => Answers "1:5:3:7"
	 * 		["you","will","love","wollok"].join(" ") => Answers "you will love wollok"
	 * 		["you","will","love","wollok"].join()    => Answers "you,will,love,wollok"
	 */
	method join() = self.join(",")
	method join(separator) = self.asList().join(separator)
	
	/**
	 * @see Object#==
	 */
	override method ==(other) =
    self.className() == other.className() &&
    self.size() == other.size() &&
    self.all{elem => other.contains(elem)}
}

/**
 *
 * An ordered collection (also known as a sequence). 
 * You iterate the list the same order elements are inserted. 
 * The user can access elements by their integer index (position in the list).
 * A List can contain duplicate elements.
 *
 * @author jfernandes
 * @since 1.3
 */
class List inherits Collection {
	constructor(elements...) {
		self.addAll(elements)
	}

	/** Answers the element at the specified position in this list.
	 * The first char value of the sequence is at index 0, the next at index 1, and so on, as for array indexing. 
	 */
	method get(index) native

	/** Creates a new list */
	override method newInstance() = []
	
	/**
	 * Answers any element of this collection 
	 */
	override method anyOne() {
		if (self.isEmpty()) 
			throw new Exception("Illegal operation 'anyOne' on empty collection")
		else 
			return self.get(0.randomUpTo(self.size()).truncate(0))
	}
	
	/**
	 * Answers first element of the non-empty list
	 * @returns first element
	 *
	 * Example:
	 *		[1, 2, 3, 4].first()	=> Answers 1
	 */
	method first() = self.head()
	
	/**
	 * Synonym for first method 
	 */
	method head() = self.get(0)
	
	/**
	 * Answers the last element of the non-empty list.
	 * @returns last element
	 * Example:
	 *		[1, 2, 3, 4].last()		=> Answers 4	
	 */
	method last() = self.get(self.size() - 1)

  override method toString() =
    "[" +
    if (self.isEmpty()) ""
    else self.subList(1).fold(self.head().printString(), {acc, e => acc + ', ' + e.printString()}) +
    "]"

	/** 
	 * Converts this collection to a list. No effect on Lists.
	 * @see List
	 */
	override method asList() = self
	
	/** 
	 * Converts this list to a set (removing duplicate elements)
	 * @see List
	 */
	override method asSet() { 
		const result = #{}
		result.addAll(self)
		return result
	}
	
	/** 
	 * Answers a view of the portion of this list between the specified fromIndex 
	 * and toIndex, both inclusive. Remember first element is position 0, second is position 1, and so on.
	 * If toIndex exceeds length of list, no error is thrown.
	 *
	 * Example:
	 *		[1, 5, 3, 2, 7, 9].subList(2, 3)		=> Answers [3, 2]	
	 *		[1, 5, 3, 2, 7, 9].subList(4, 6)		=> Answers [7, 9] 
	 */
	method subList(start) = self.subList(start, self.size() - 1)
	method subList(start,end) {
		if(self.isEmpty() || start >= self.size())
			return self.newInstance()
		const newList = self.newInstance()
		const _start = start.limitBetween(0,self.size()-1)
		const _end = end.limitBetween(0,self.size()-1)
		(_start.._end).forEach { i => newList.add(self.get(i)) }
		return newList
	}
	 
	/**
	 * @see List#sortedBy
	 */
	method sortBy(closure) {
    if (self.isEmpty()) { return }

    const head = self.head()
    const tail = self.subList(1, self.size() - 1)
    const greater = tail.filter{n => closure.apply(head, n)}
    greater.sortBy(closure)
    const lesser = tail.filter{n => !closure.apply(head, n)}
    lesser.sortBy(closure)

    self.clear()
    lesser.forEach{n => self.add(n)}
    self.add(head)
    greater.forEach{n => self.add(n)}
  }
	
	/**
	 * Takes first n elements of a list
	 *
	 * Examples:
	 * 		[1,9,2,3].take(5)  ==> Answers [1, 9, 2, 3]
	 *  	[1,9,2,3].take(2)  ==> Answers [1, 9]
	 *  	[1,9,2,3].take(-2)  ==> Answers []		 
	 */
	method take(n) =
		if(n <= 0)
			self.newInstance()
		else
			self.subList(0,n-1)
		
	
	/**
	 * Answers a new list dropping first n elements of a list. 
	 * This operation has no side effect.
	 *
	 * Examples:
	 * 		[1, 9, 2, 3].drop(3)  ==> Answers [3]
	 * 		[1, 9, 2, 3].drop(1)  ==> Answers [9, 2, 3]
	 * 		[1, 9, 2, 3].drop(-2) ==> Answers [1, 9, 2, 3]
	 */
	method drop(n) = 
		if(n >= self.size())
			self.newInstance()
		else
			self.subList(n)
		
	/**
	 * Answers a new list reversing the elements, so that first element becomes last element of the new list and so on.
	 * This operation has no side effect.
	 * 
	 * Example:
	 *  	[1, 9, 2, 3].reverse()  ==> Answers [3, 2, 9, 1]
	 *
	 */
	method reverse() = self.subList(self.size()-1,0)

	/**
	 * Answers the concatenated string representation of the elements in the given set.
	 * You can pass an optional character as an element separator (default is ",")
	 *
	 * Examples:
	 * 		[1, 5, 3, 7].join(":") => Answers "1:5:3:7"
	 * 		["you","will","love","wollok"].join(" ") => Answers "you will love wollok"
	 * 		["you","will","love","wollok"].join()    => Answers "you,will,love,wollok"
	 */
	method join() = self.join(",")
	method join(separator) =
    if (self.isEmpty()) ""
    else self.subList(1).fold(self.head().toString(), {acc, e => acc + separator + e})
  
	
	
	/** A list is == another list if all elements are equal (defined by == message) */
	override method ==(other) =
    other != null &&
    self.className() == other.className() &&
    self.size() == other.size() &&
    (self.size() == 0 || (0..(self.size() - 1)).all{i => self.get(i) == other.get(i)})


	/**
	 * Answers the list without duplicate elements
	 * [1, 3, 1, 5, 1, 3, 2, 5].withoutDuplicates() => Answers [1, 2, 3, 5]
	 */
	method withoutDuplicates() = self.asSet().asList()

}

/**
 * Represents a set of key -> values
 * 
 */
class Dictionary {

  var entries = []

	/**
	 * Adds or updates a value based on a key
	 */
	method put(_key, _value) {
    if(_key == null) throw new BadParameterException("key")
    if(_value == null) throw new BadParameterException("value")

    self.remove(_key)
    entries.add([_key, _value])
  }
	
	/**
	 * Answers the value to which the specified key is mapped, or null if this Dictionary contains no mapping for the key.
	 */
	method basicGet(_key) = entries.findOrDefault({entry => entry.get(0) == _key}, [null,null]).get(1)
  

	/**
	 * Answers the value to which the specified key is mapped, or evaluates a non-parameter closure otherwise 
	 */
	method getOrElse(_key, _closure) {
		const value = self.basicGet(_key)
		if (value == null) 
			return _closure.apply()
		else 
			return value
	}
	
	/**
	 * Answers the value to which the specified key is mapped. 
	 * If this Dictionary contains no mapping for the key, an error is thrown.
	 */
	method get(_key) = self.getOrElse(_key,{ => throw new ElementNotFoundException("there is no element associated with key " + _key) })

	/**
	 * Answers the number of key-value mappings in this Dictionary.
	 */
	method size() = self.values().size()
	
	/**
	 * Answers whether the dictionary has no elements
	 */
	method isEmpty() = self.size() == 0
	
	/**
	 * Answers whether this Dictionary contains a mapping for the specified key.
	 */
	method containsKey(_key) = self.keys().contains(_key)
	
	/**
	 * Answers whether if this Dictionary maps one or more keys to the specified value.
	 */
	method containsValue(_value) = self.values().contains(_value)
	
	/**
	 * Removes the mapping for a key from this Dictionary if it is present 
	 */
	method remove(_key) {
    entries = entries.filter {entry => entry.get(0) != _key }
  }
	
	/**
	 * Answers a list of the keys contained in this Dictionary.
	 */
	method keys() = entries.map { entry => entry.get(0) }
	
	/**
	 * Answers a list of the values contained in this Dictionary.
	 */
	method values() = entries.map { entry => entry.get(1) }
	
	/**
	 * Performs the given action for each entry in this Dictionary until all entries have been 
	 * processed or the action throws an exception.
	 * 
	 * Expected closure with two parameters: the first associated with key and second with value.
	 *
	 * Example:
	 * 		mapaTelefonos.forEach({ k, v => result += k.size() + v.size() })
	 * 
	 */
	method forEach(closure) {
    entries.forEach { entry => closure.apply(entry.get(0), entry.get(1)) }
  }
	
	/** Removes all of the mappings from this Dictionary. This is a side-effect operation. */
	method clear() {
    entries = []
  }
	
  override method toString() = "a Dictionary [" +
    if (entries.isEmpty()) "]"
    else entries.subList(1).fold(entries.get(0).get(0).printString() + " -> " + entries.get(0).get(1).printString(), {acum, entry =>
      acum + ", " + entry.get(0).printString() + " -> " + entry.get(1).printString()
    }) + "]"

}

/**
 *
 * @author jfernandes
 * @since 1.3
 * @noInstantiate
 */	
class Number {

	/** 
	 * Answers the greater number between two
	 * Example:
	 * 		5.max(8)    ==> Answers 8 
	 */
	method max(other) = if (self >= other) self else other
	
	/** Answers the lower number between two. @see max */
	method min(other) = if (self <= other) self else other
	
	/**
	 * Given self and a range of integer values, Answers self if it is in that range
	 * or nearest value from self to that range 
	 *
	 * Examples
	 * 4.limitBetween(2, 10)   ==> Answers 4, because 4 is in the range
	 * 4.limitBetween(6, 10)   ==> Answers 6, because 4 is not in range 6..10, and 6 is nearest value to 4
	 * 4.limitBetween(1, 2)    ==> Answers 2, because 4 is not in range 1..2, but 2 is nearest value to 4
	 *
	 */   
	method limitBetween(limitA,limitB) = if(limitA <= limitB) 
											limitA.max(self).min(limitB) 
										 else 
										 	limitB.max(self).min(limitA)

	/** Answers whether self is between min and max */
	method between(min, max) { return (self >= min) && (self <= max) }
	
	/** Answers squareRoot of self
	 * 		9.squareRoot() => Answers 3 
	 */
	method squareRoot() { return self ** 0.5 }
	
	/** Answers square of self
	 * 		3.square() => Answers 9 
	 */
	method square() { return self * self }
	
	/** Answers whether self is an even number (divisible by 2, mathematically 2k) */
	method even() { return self % 2 == 0 }
	
	/** Answers whether self is an odd number (not divisible by 2, mathematically 2k + 1) */
	method odd() { return !self.even() }
	
	/** Answers remainder between self and other
	 * Example:
	 * 		5.rem(3) ==> Answers 2
	 */
	method rem(other) { return self % other }
	
	/**
	 * Rounds up self up to a certain amount of decimals.
	 * Amount of decimals must be positive
	 * 1.223445.roundUp(3) ==> 1.224
	 * -1.223445.roundUp(3) ==> -1.224
	 * 14.6165.roundUp(3) ==> 14.617
	 * 5.roundUp(3) ==> 5
	 */
	 method roundUp(_decimals) native
	 method roundUp() = self.roundUp(0)

	/**
	 * Truncates self up to a certain amount of decimals.
	 * Amount of decimals must be positive
	 * 1.223445.truncate(3) ==> 1.223
	 * 14.6165.truncate(3) ==> 14.616
	 * -14.6165.truncate(3) ==> -14.616
	 * 5.truncate(3) ==> 5
	 */
	method truncate(_decimals) native

	method +_() = self
	method -_() native

	/**
	 * The whole wollok identity implementation is based on self method
	 */
	override method ===(other) native

	method +(other) native
	method -(other) native
	method *(other) native
	method /(other) native
	
	/** Integer division between self and other
	 *
	 * Example:
	 *		8.div(3)  ==> Answers 2
	 * 		15.div(5) ==> Answers 3
	 */
	method div(other) = (self / other).truncate(0)
	
	/**
	 * raisedTo
	 * 		3 ** 2 ==> Answers 9
	 */
	method **(other) native
	
	/**
	 * Answers remainder of division between self and other
	 */
	method %(other) native
	
	/** String representation of self number */
	override method toString() native
	
	/** 
	 * Builds a Range between self and end
	 * 
	 * Example:
	 * 		1..4   Answers ==> a new Range object from 1 to 4
	 */
	method ..(end) = new Range(self, end)
	
	method >(other) native
	method >=(other) native
	method <(other) native
	method <=(other) native

	/** 
	 * Answers absolute value of self 
	 *
	 * Example:
	 * 		2.abs() ==> 2
	 * 		(-3).abs() ==> 3 (be careful with parentheses)
	 */		
	method abs() native
	
	/**
	 * Inverts sign of self
	 *
	 * Example:
	 * 		3.invert() ==> Answers -3
	 * 		(-2).invert() ==> Answers 2 (be careful with parentheses)
	 */
  method invert() = -self
	
	/**
	 * greater common divisor
	 *
	 * Example:
	 * 		8.gcd(12) ==> Answers 4
	 *		5.gcd(10) ==> Answers 5
	 */
	method gcd(other) = if(other == 0) self else other.gcd(self % other)
	
	/**
	 * least common multiple
	 *
	 * Example:
	 * 		3.lcm(4) ==> Answers 12
	 * 		6.lcm(12) ==> Answers 12
	 */
	method lcm(other) {
		const mcd = self.gcd(other)
		return self * (other / mcd)
	}
	
	/**
	 * number of digits of self (without sign)
	 */
	method digits() {
		var digits = self.toString().size()
		if (self < 0) { digits -= 1 }
    if (self % 1 != 0) { digits -= 1 }
		return digits
	}
	
	/** Answers whether self is a prime number, like 2, 3, 5, 7, 11... */
	method isPrime() {
		if (self == 1) return false
		return !(2..(self.div(2) + 1)).any({ i => self % i == 0 })
	}
	
	/**
	 * Answers a random between self and max
	 */
	method randomUpTo(max) native
	
	/**
	 * Executes the given action n times (n = self)
	 * Example:
	 * 		4.times({ i => console.println(i) }) ==> Answers 
	 * 			1
	 * 			2
	 * 			3
	 * 			4
	 */
	method times(action) { 
		(1..self).forEach(action) 
	}

}


/**
 * Strings are constant; their values cannot be changed after they are created.
 *
 * @author jfernandes
 * @noInstantiate
 */
class String {
	/** Answers the number of elements */
	method length() native
	
	/** 
	 * Answers the char value at the specified index. An index ranges from 0 to length() - 1. 
	 * The first char value of the sequence is at index 0, the next at index 1, and so on, as for array indexing.
	 */
	method charAt(index) = self.substring(index, index + 1)
	
	/** 
	 * Concatenates the specified string to the end of this string.
	 * Example:
	 * 		"cares" + "s" => Answers "caress"
	 */
	method +(other) = self.concat(other.toString())
  
  method concat(other) native
	
	/** 
	 * Tests if this string starts with the specified prefix. It is case sensitive.
	 *
	 * Examples:
	 * 		"mother".startsWith("moth")  ==> Answers true
	 *      "mother".startsWith("Moth")  ==> Answers false
	 */ 
	method startsWith(other) native
	
	/** Tests if this string ends with the specified suffix. It is case sensitive.
	 * @see startsWith
	 */
	method endsWith(other) native
	
	/** 
	 * Answers the index within this string of the first occurrence of the specified character.
	 * If character is not present, Answers -1
	 * 
	 * Examples:
	 * 		"pototo".indexOf("o")  ==> Answers 1
	 * 		"unpredictable".indexOf("o")  ==> Answers -1 		
	 */
	method indexOf(other) native
	
	/**
	 * Answers the index within this string of the last occurrence of the specified character.
	 * If character is not present, Answers -1
	 *
	 * Examples:
	 * 		"pototo".lastIndexOf("o")  ==> Answers 5
	 * 		"unpredictable".lastIndexOf("o")  ==> Answers -1 		
	 */
	method lastIndexOf(other) native
	
	/** Converts all of the characters in this String to lower case */
	method toLowerCase() native
	
	/** Converts all of the characters in this String to upper case */
	method toUpperCase() native
	
	/** 
	 * Answers a string whose value is this string, with any leading and trailing whitespace removed
	 * 
	 * Example:
	 * 		"   emptySpace  ".trim()  ==> "emptySpace"
	 */
	method trim() native
	
	method <(aString) native
	method <=(aString) {
		return self < aString || (self.equals(aString))
	}
	method >(aString) native
	method >=(aString) {
		return self > aString || (self.equals(aString))
	}
	
	/**
	 * Answers whether this string contains the specified sequence of char values.
	 * It is a case sensitive test.
	 *
	 * Examples:
	 * 		"unusual".contains("usual")  ==> Answers true
	 * 		"become".contains("CO")      ==> Answers false
	 */
	method contains(other) native
	
	/** Answers whether this string has no characters */
	method isEmpty() {
		return self.size() == 0
	}

	/** 
	 * Compares this String to another String, ignoring case considerations.
	 *
	 * Example:
	 *		"WoRD".equalsIgnoreCase("Word")  ==> Answers true
	 */
	method equalsIgnoreCase(aString) {
		return self.toUpperCase() == aString.toUpperCase()
	}
	
	/**
	 * Answers a substring of this string beginning from an inclusive index. 
	 *
	 * Examples:
	 * 		"substitute".substring(6)  ==> Answers "tute", because second "t" is in position 6
	 * 		"effect".substring(0)      ==> Answers "effect", has no effect at all
	 */
	method substring(length) native
	
	/**
	 * Answers a substring of this string beginning from an inclusive index up to another inclusive index
	 *
	 * Examples:
	 * 		"walking".substring(2, 4)   ==> Answers "lk"
	 * 		"walking".substring(3, 5)   ==> Answers "ki"
	 *		"walking".substring(0, 5)	==> Answers "walki"
	 *		"walking".substring(0, 45)	==> throws an out of range exception 
	 */
	method substring(startIndex, length) native
	
	/**
	 * Splits this string around matches of the given string.
	 * Answers a list of strings.
	 *
	 * Example:
	 * 		"this,could,be,a,list".split(",")   ==> Answers ["this", "could", "be", "a", "list"]
	 */
	method split(expression) {
		const result = []
		var me = self.toString() + expression
		var first = 0
		(0..me.size() - 1).forEach { i =>
			if (me.charAt(i) == expression) {
				result.add(me.substring(first, i))
				first = i + 1
			}
		}
		return result
	}

	/** 
	 * Answers a string resulting from replacing all occurrences of expression in this string with replacement
	 *
	 * Example:
	 *		 "stupid is what stupid does".replace("stupid", "genius") ==> Answers "genius is what genius does"
	 */
	method replace(expression, replacement) native
	
	/** This object (which is already a string!) is itself returned */
	override method toString() native
	
	/** String implementation of printString, 
	 * simply adds quotation marks 
	 */
	override method printString() = '"' + self.toString() + '"'
	
	/** Compares this string to the specified object. The result is true if and only if the
	 * argument is not null and is a String object that represents the same sequence of characters as this object.
	 */
	override method ==(other) native
	
	/** A synonym for length */
	method size() = self.length()
	
	/** Takes first n characters of this string */
	method take(n) = self.substring(0, n.min(self.size()))
	
	/** Answers a new string dropping first n characters of this string */
	method drop(n) = self.substring(n.min(self.size()), self.size())
	
	/** Splits this strings into several words */
	method words() = self.split(" ")
	
	/** Changes the first letter of every word to upper case in this string */
	method capitalize() {
		const capitalizedPhrase = self.words().fold("", { words, word => words + word.take(1).toUpperCase() + word.drop(1).toLowerCase() + " " })
		return capitalizedPhrase.take(capitalizedPhrase.size() - 1)
	}
 	
}

/**
 * Represents a Boolean value (true or false)
 *
 * @author jfernandes
 * @noinstantiate
 */
class Boolean {

	/** Answers the result of applying the logical AND operator to the specified boolean operands self and other */
	method &&(other) native
	
	/** Answers the result of applying the logical OR operator to the specified boolean operands self and other */
	method ||(other) native
	
	/** Answers a String object representing this Boolean's value. */
	override method toString() native
	
	/** Compares this string to the specified object. The result is true if and only if the
	 * argument is not null and represents same value (true or false)
	 */
	override method ==(other) native
	
	/** NOT logical operation */
	method !_() native
}

/**
 * Represents a finite arithmetic progression of integer numbers with optional step
 * If start = 1, end = 8, Range will represent [1, 2, 3, 4, 5, 6, 7, 8]
 * If start = 1, end = 8, step = 3, Range will represent [1, 4, 7]
 *
 * @author jfernandes
 * @since 1.3
 */
class Range {
	const start
	const end
	var step
	
	constructor(_start, _end) {
		start = _start.truncate(0) 
		end = _end.truncate(0)
		if (_start > _end) { 
			step = -1 
		} else {
			step = 1
		}  
	}
	
	method step(_step) { step = _step }

	/** 
	 * Iterates over a Range from start to end, based on step
	 */
	method forEach(closure) native
	
	/**
	 * Answers a new collection that contains the result of transforming each of self collection's elements
	 * using a given closure.
	 * The condition is a closure argument that takes an integer and Answers an object.
	 * @returns another list
	 * Example:
	 *      (1..10).map({ n => n * 2}) ==> Answers [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] 
	 */
	method map(closure) {
		const l = []
		self.forEach{e=> l.add(closure.apply(e)) }
		return l
	}
	
	/** @private */
	method asList() {
		return self.map({ elem => elem })
	}
	
	/** Answers whether this range contains no elements */
	method isEmpty() = self.size() == 0

	/** @see List#fold(seed, foldClosure) */
	method fold(seed, foldClosure) { return self.asList().fold(seed, foldClosure) }
	
	/** Answers the number of elements */
	method size() { return end - start + 1 }
	
	/** @see List#any(closure) */
	method any(closure) { return self.asList().any(closure) }
	
	/** @see List#all(closure) */
	method all(closure) { return self.asList().all(closure) }
	
	/** @see List#filter(closure) */
	method filter(closure) { return self.asList().filter(closure) }
	
	/** @see List#min() */
	method min() { return self.asList().min() }
	
	/** @see List#max() */
	method max() { return self.asList().max() }
	
	/**
	 * Answers a random integer contained in the range
	 */		
	method anyOne() native
	
	/** Tests whether a number e is contained in the range */
	method contains(e) { return self.asList().contains(e) }
	
	/** @see List#sum() */
	method sum() { return self.asList().sum() }
	
	/**
	 * Sums all elements that match the boolean closure 
	 *
	 * Example:
	 * 		(1..9).sum({ i => if (i.even()) i else 0 }) ==> Answers 20
	 */
	method sum(closure) { return self.asList().sum(closure) }
	
	/**
	 * Counts how many elements match the boolean closure
	 *
	 * Example:
	 * 		(1..9).count({ i => i.even() }) ==> Answers 4 (2, 4, 6 and 8 are even)
	 */
	method count(closure) { return self.asList().count(closure) }
	
	/** @see List#find(closure) */
	method find(closure) { return self.asList().find(closure) }
	
	/** @see List#findOrElse(predicate, continuation)	 */
	method findOrElse(closure, continuation) { return self.asList().findOrElse(closure, continuation) }
	
	/** @see List#findOrDefault(predicate, value) */
	method findOrDefault(predicate, value) { return self.asList().findOrDefault(predicate, value) }
	
	/** @see List#sortBy */
	method sortedBy(closure) { return self.asList().sortedBy(closure) }
	
}

/**
 * 
 * Represents an executable piece of code. You can create a closure, assign it to a reference,
 * evaluate it many times, send it as parameter to another object, and many useful things.
 *
 * @author jfernandes
 * @since 1.3
 * @noInstantiate
 */
class Closure {

  override method initialize() native

  method apply(args...) native
	
	/** Answers a string representation of this closure object */
	override method toString() native
}

/**
 *
 * Represents a Date (without time). A Date is immutable, once created you can not change it.
 *
 * @since 1.4.5
 */	
class Date {

	constructor() { }
	constructor(_day, _month, _year) { self.initialize(_day, _month, _year) }
	
	override method initialize() native
	/** @private */
	method initialize(_day, _month, _year) native

	/** Answers the day number of the Date */
	method day() native
	
	/** Answers the day of week of the Date, where
	 * 1 = MONDAY
	 * 2 = TUESDAY
	 * 3 = WEDNESDAY
	 *...
	 * 7 = SUNDAY
	 */
	method dayOfWeek() native
	
	/** Answers the month number of the Date */
	method month() native
	
	/** Answers the year number of the Date */
	method year() native

	override method toString() = "a Date[day = " + self.day() + ", month = " + self.month() + ", year = " + self.year() + "]"
	
	override method ==(other) = self.year() == other.year() && self.month() == other.month() && self.day() == other.day()
	
	/** Answers a copy of this Date with the specified number of days added. */
	method plusDays(_days) native
	
	/** Answers a copy of this Date with the specified number of months added. */
	method plusMonths(_months) native
	
	/** Answers a copy of this Date with the specified number of years added. */
	method plusYears(_years) native
	
	/** Checks if the year is a leap year, like 2000, 2004, 2008, 2012, 2016... */
	method isLeapYear() =  self.year() % 4 == 0 && self.year() % 100 != 0 || self.year() % 400 == 0
		
	/** 
	 * Answers the difference in days between two dates, in absolute values.
	 * 
	 * Examples:
	 * 		new Date().plusDays(4) - new Date() ==> Answers 4
	 *		new Date() - new Date().plusDays(2) ==> Answers 2
	 */
	method -(_aDate) native
	
	/** 
	 * Answers a copy of this date with the specified number of days subtracted.
	 * For example, 2009-01-01 minus one day would result in 2008-12-31.
	 * This instance is immutable and unaffected by this method call.  
	 */
	method minusDays(days) = self.plusDays(-days)
	
	/** 
	 * Answers a copy of this date with the specified number of months subtracted.
	 */
	method minusMonths(months) = self.plusMonths(-months)
	
	/** Answers a copy of this date with the specified number of years subtracted. */
	method minusYears(years) = self.plusYears(-years)
	
	method <(_aDate) native
	method >(_aDate) native
	method <=(_aDate) { 
		return (self < _aDate) || (self.equals(_aDate))
	}
	method >=(_aDate) { 
		return (self > _aDate) || (self.equals(_aDate)) 
	}
	
	/** Answers whether self is between two dates (both inclusive comparison) */
	method between(_startDate, _endDate) { 
		return (self >= _startDate) && (self <= _endDate) 
	}

}

////////////////////////////////////
// TOOK FROM WOLLOK.LIB
////////////////////////////////////


/** 
 * Console is a global wollok object that implements a character-based console device
 * called "standard input/output" stream 
 */
object console {

	/** Prints a String with end-of-line character */
	method println(obj) native
	
	/** Reads a line from input stream */
	method readLine() native
	
	/** Reads an int character from input stream */
	method readInt() native
	
	/** Returns the system's representation of a new line:
	 * - \n in Unix systems
	 * - \r\n in Windows systems
	 */
	method newline() native
}

object assert {

	/** 
	 * Tests whether value is true. Otherwise throws an exception.
	 *
	 * Example:
	 *		assert.that(7.even())   ==> throws an exception "Value was not true"
	 *		assert.that(8.even())   ==> ok, nothing happens	
	 */
	method that(value) {
		if (!value) throw new AssertionException("Value was not true")
	}
	
	/** Tests whether value is false. Otherwise throws an exception. 
	 * @see assert#that(value) 
	 */
	method notThat(value) {
		if (value) throw new AssertionException("Value was not false")
	}
	
	/** 
	 * Tests whether two values are equal, based on wollok ==, != methods
	 * 
	 * Examples:
	 *		 assert.equals(10, 100.div(10)) ==> ok, nothing happens
	 *		 assert.equals(10.0, 100.div(10)) ==> ok, nothing happens
	 *		 assert.equals(10.01, 100.div(10)) ==> throws an exception 
	 */
	method equals(expected, actual) {
		if (expected != actual) throw new AssertionException("Expected [" + expected.printString() + "] but found [" + actual.printString() + "]", expected.printString(), actual.printString()) 
	}
	
	/** 
	 * Tests whether two values are equal, based on wollok ==, != methods
	 * 
	 * Examples:
	 *       const value = 5
	 *		 assert.notEquals(10, value * 3) ==> ok, nothing happens
	 *		 assert.notEquals(10, value)     ==> throws an exception
	 */
	method notEquals(expected, actual) {
		if (expected == actual) throw new AssertionException("Expected to be different, but [" + expected.printString() + "] and [" + actual.printString() + "] match")
	}
	
	/** 
	 * Tests whether a block throws an exception. Otherwise an exception is thrown.
	 *
	 * Examples:
	 * 		assert.throwsException({ 7 / 0 })  
	 *         ==> Division by zero error, it is expected, ok
	 *
	 *		assert.throwsException({ "hola".length() }) 
	 *         ==> throws an exception "Block should have failed"
	 */
	method throwsException(block) {
		var failed = false
		try {
			block.apply()
		} catch e {
			failed = true
		}
		if (!failed) throw new AssertionException("Block should have failed")
	}
	
	/** 
	 * Tests whether a block throws an exception and this is the same expected. 
	 * Otherwise an exception is thrown.
	 *
	 * Examples:
	 *		assert.throwsExceptionLike(new BusinessException("hola"), 
	 *            { => throw new BusinessException("hola") } 
	 *            => Works! Exception class and message both match.
	 *
	 *		assert.throwsExceptionLike(new BusinessException("chau"),
	 *            { => throw new BusinessException("hola") } 
	 *            => Doesn't work. Exception class matches but messages are different.
	 *
	 *		assert.throwsExceptionLike(new OtherException("hola"),
	 *            { => throw new BusinessException("hola") } 
	 *            => Doesn't work. Messages matches but they are instances of different exceptions.
	 */	 
	method throwsExceptionLike(exceptionExpected, block) {
		try 
		{
			self.throwsExceptionByComparing( block,{a => a.equals(exceptionExpected)})
		}
		catch ex : OtherValueExpectedException 
		{
			throw new AssertionException("The Exception expected was " + exceptionExpected + " but got " + ex.getCause())
		} 
	}

	/** 
	 * Tests whether a block throws an exception and it has the error message as is expected. 
	 * Otherwise an exception is thrown.
	 *
	 * Examples:
	 *		assert.throwsExceptionWithMessage("hola",{ => throw new BusinessException("hola") } 
	 *           => Works! Both have the same message.
	 *
	 *		assert.throwsExceptionWithMessage("hola",{ => throw new OtherException("hola") } 
	 *           => Works! Both have the same message.
	 *
	 *		assert.throwsExceptionWithMessage("chau",{ => throw new BusinessException("hola") } 
	 *           => Doesn't work. Both are instances of BusinessException but their messages differ.
	 */	 
	method throwsExceptionWithMessage(errorMessage, block) {
		try 
		{
			self.throwsExceptionByComparing(block,{a => errorMessage.equals(a.getMessage())})
		}
		catch ex : OtherValueExpectedException 
		{
			throw new AssertionException("The error message expected was " + errorMessage + " but got " + ex.getCause().getMessage())
		}
	}

	/** 
	 * Tests whether a block throws an exception and this is the same exception class expected.
	 * Otherwise an exception is thrown.
	 *
	 * Examples:
	 *		assert.throwsExceptionWithType(new BusinessException("hola"),{ => throw new BusinessException("hola") } 
     *          => Works! Both exceptions are instances of the same class.
     *
	 *		assert.throwsExceptionWithType(new BusinessException("chau"),{ => throw new BusinessException("hola") } 
	 *          => Works again! Both exceptions are instances of the same class.
	 *
	 *		assert.throwsExceptionWithType(new OtherException("hola"),{ => throw new BusinessException("hola") } 
	 *          => Doesn't work. Exception classes differ although they contain the same message.
	 */	 	
	method throwsExceptionWithType(exceptionExpected, block) {
		try 
		{
			self.throwsExceptionByComparing(block,{a => exceptionExpected.className().equals(a.className())})
		}
		catch ex : OtherValueExpectedException 
		{
			throw new AssertionException("The exception expected was " + exceptionExpected.className() + " but got " + ex.getCause().className())
		}
	}

	/** 
	 * Tests whether a block throws an exception and compare this exception with other block 
	 * called comparison. Otherwise an exception is thrown. The block comparison
	 * receives a value (an exception thrown) that is compared in a boolean expression
	 * returning the result.
	 *
	 * Examples:
	 *		assert.throwsExceptionByComparing({ => throw new BusinessException("hola"),{a => "hola".equals(a.getMessage())}} 
	 *          => Works!.
	 *
	 *		assert.throwsExceptionByComparing({ => throw new BusinessException("hola"),{a => new BusinessException("lele").className().equals(a.className())} } 
	 *          => Works again!
	 *
	 *		assert.throwsExceptionByComparing({ => throw new BusinessException("hola"),{a => "chau!".equals(a.getMessage())} } 
	 *          => Doesn't work. The block evaluation resolves to a false value.
	 */		
	method throwsExceptionByComparing(block,comparison){
		var continue = false
		try 
			{
				block.apply()
				continue = true
			} 
		catch ex 
			{
				if(comparison.apply(ex))
					self.that(true)
				else
					throw new OtherValueExpectedException("Expected other value", ex)
			}
		if (continue) throw new AssertionException("Should have thrown an exception")	
	}
	
	/**
	 * Throws an exception with a custom message. 
	 * Useful when you reach code that should not be reached.
	 */
	method fail(message) {
		throw new AssertionException(message)
	}
	
}

class StringPrinter {
	var buffer = ""
	method println(obj) {
		buffer += obj.toString() + console.newline()
	}
	method getBuffer() = buffer
}

/**
 * Exception to handle difference between current and expected values
 * in assert.throwsException... methods
 */
class AssertionException inherits Exception {

	const expected = null
	const actual = null

	constructor(message) = super(message)
	
	constructor(message, cause) = super(message, cause)
	
	constructor(message, _expected, _actual) = self(message) {
		expected = _expected
		actual = _actual
	}

	method expected() = expected
	method actual() = actual
	
}

/**
 * Exception to handle other values expected in assert.throwsException... methods
 */
class OtherValueExpectedException inherits Exception {
	constructor(_message) = super(_message)	
	constructor(_message,_cause) = super(_message,_cause)
}

class BadParameterException inherits Exception {
	constructor(_value) = super("Invalid argument: " + _value)	
}