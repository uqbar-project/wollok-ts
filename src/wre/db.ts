import { Natives, RuntimeObject, RuntimeValue, InnerValue, Evaluation } from '../interpreter/runtimeModel'
import { Name } from '../model'
import fs from 'fs'

type SavedValue = Exclude<InnerValue, RuntimeObject[] | Error>
type Attributes = Record<string, Record<string, SavedValue>>
type DataBase = Record<string, Attributes>

const loadDataBase = (): DataBase => {
  return JSON.parse(fs.readFileSync('./db.json', 'utf-8'))
}

const attributesMapToObject = (map: Map<Name, RuntimeValue>) => {
  const object: Attributes = {}
  map.forEach((value, key) => {
    if (isLiteral(value)) {
      object[key] = saveAsLiteral(value)
    }
    else if (isSingleton(value, key)) {
      object[key] = saveAsSingleton(value)
    }
    else if (isInstance(value, key)) {
      object[key] = saveAsInstance(value)
    }
  })
  return object
}

const saveAsLiteral = (value: RuntimeValue) => {
  return { type: 'literal', savedValue: value!.innerValue as SavedValue }
}

const saveAsSingleton = (value: RuntimeValue) => {
  return { type: 'singleton', savedValue: value!.module.fullyQualifiedName() }
}

const saveAsInstance = (value: RuntimeValue) => {
  return { type: 'instance', savedValue: value!.module.fullyQualifiedName() }
}

const isLiteral = (value: RuntimeValue) => {
  return value!.innerValue !== undefined
}

const isSingleton = (value: RuntimeValue, keyInMap: string) => {
  return keyInMap !== 'self' && value!.module.kind === 'Singleton'
}

const isInstance = (value: RuntimeValue, keyInMap: string) => {
  return keyInMap !== 'self' && value!.module.kind === 'Class'
}

const saveObjectAttributes = (objName: Name, attributes: Attributes) => {
  const dataBase: DataBase = JSON.parse(fs.readFileSync('./db.json', 'utf-8'))
  dataBase[objName] = attributes
  fs.writeFileSync('./db.json', JSON.stringify(dataBase))
}

const attributeReviver = (value: SavedValue, evaluation: Evaluation): Record<string, Function> => {
  const literal = () => evaluation.reify(value as SavedValue)
  const singleton = () => evaluation.object(value as Name)
  const instance = () => evaluation.instantiate(value as Name)
  return { literal, singleton, instance }
}

const loadObjectAttributes = (runtimeObject: RuntimeObject, attributes: Attributes, evaluation: Evaluation) => {
  Object.keys(attributes).forEach(key => {
    const type = attributes[key].type as string
    const value = attributes[key].savedValue
    const newValue = attributeReviver(value, evaluation)[type]()
    runtimeObject.set(key, newValue)
  })
}

const db: Natives = {
  db: {
    *save(_self: RuntimeObject, objToSave: RuntimeObject) {
      const name = objToSave.module.fullyQualifiedName()
      const attributesMap = objToSave.locals as Map<Name, RuntimeValue>
      const attributes = attributesMapToObject(attributesMap)
      saveObjectAttributes(name, attributes)
    },
    *load(_self: RuntimeObject, objToLoad: RuntimeObject) {
      const db = loadDataBase()
      const name = objToLoad.module.fullyQualifiedName()
      const savedAttributes = db[name]
      const evaluation = this
      loadObjectAttributes(objToLoad, savedAttributes, evaluation)
    },
  },
}

export default db