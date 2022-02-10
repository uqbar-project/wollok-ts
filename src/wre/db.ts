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
    if (isExpression(value)) {
      object[key] = { type: 'literal', savedValue: value!.innerValue as SavedValue }
    } else if (key !== 'self') {
      object[key] = { type: 'singleton', savedValue: value!.module.fullyQualifiedName() }
    }
  })
  return object
}

const isExpression = (runtimeValue: RuntimeValue): boolean => {
  return runtimeValue!.innerValue !== undefined
}

const saveObjectAttributes = (objName: Name, attributes: Attributes) => {
  const dataBase: DataBase = JSON.parse(fs.readFileSync('./db.json', 'utf-8'))
  dataBase[objName] = attributes
  fs.writeFileSync('./db.json', JSON.stringify(dataBase))
}

const attributeReviver = (value: SavedValue, evaluation: Evaluation): Record<string, Function> => {
  const literal = () => evaluation.reify(value as SavedValue)
  const singleton = () => evaluation.object(value as Name)
  return { literal, singleton }
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