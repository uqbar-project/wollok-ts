import { Execution, Natives, RuntimeObject, RuntimeValue, InnerValue, Evaluation } from '../interpreter/runtimeModel'
import { Name } from '../model'
import fs from 'fs'

type SavedValue = Exclude<InnerValue, RuntimeObject[] | Error>
type Attributes = Record<string, SavedValue>
type DataBase = Record<string, Attributes>

const saveObjectAttributes = (id: Name, attributes: Attributes) => {
  const dataBase: DataBase = JSON.parse(fs.readFileSync('./db.json', 'utf-8'))
  dataBase[id] = attributes
  fs.writeFileSync('./db.json', JSON.stringify(dataBase))
}

const mapToObject = (map: Map<Name, RuntimeValue | Execution<RuntimeObject>>) => {
  const object: Attributes = {}
  map.forEach((value, key) => {
    if (value instanceof RuntimeObject && value.innerValue) {
      object[key] = value.innerValue as SavedValue
    }
  })
  return object
}

const updateRuntimeObject = (runtimeObject: RuntimeObject, attributes: Attributes, evaluation: Evaluation) => {
  Object.keys(attributes).forEach(key => {
    runtimeObject.set(key, evaluation.reify(attributes[key]))
  })
}

const loadDataBase = (): DataBase => {
  return JSON.parse(fs.readFileSync('./db.json', 'utf-8'))
}

const db: Natives = {
  db: {
    *save(_self: RuntimeObject, objToSave: RuntimeObject) {
      const attributes = mapToObject(objToSave.locals)
      saveObjectAttributes(objToSave.module.name!, attributes)
    },
    *load(_self: RuntimeObject, objToLoad: RuntimeObject) {
      const db = loadDataBase()
      const name = objToLoad.module.name!
      const savedAttributes = db[name]
      updateRuntimeObject(objToLoad, savedAttributes, this)
    },
  },
}

export default db