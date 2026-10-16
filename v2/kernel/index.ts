// Kernel public surface. Contract: App.create(state).use(..).provide(..).binder(..).view(..).act(..).apply(..).mount(el).
export {App} from './app.ts'
export {createStore} from './store.ts'
export {history, record, commit, undo, redo} from './history.ts'
export {persist} from './persist.ts'
export {keyOf} from './acts.ts'
export {run as runRules, matches} from './rules.ts'
export {make} from './make.ts'
