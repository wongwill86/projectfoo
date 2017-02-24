declare var window: Window & { devToolsExtension: any };
import { compose, combineReducers, Reducer, Store } from 'redux';
 /*
  *import { compose, applyMiddleware, combineReducers, Reducer, Store }
  * from 'redux';
  */
import { routerReducer } from 'react-router-redux';
import { createStore } from 'redux';
/*
 *import thunk from 'redux-thunk';
 */

export interface AsyncStore<S> extends Store<S> {
  asyncReducers?: {
    [ id: string ]: Reducer<any>;
  };
}

export function makeRootReducer(
    asyncReducers?: { [id: string]: Reducer<any> }): Reducer<any> {
  return combineReducers({
    routing: routerReducer,
  });
};

// rehydrating state on app start: implement here...
const recoverState = () => ({});

export const store: AsyncStore<any> = createStore(
  makeRootReducer(),
  recoverState(),
  compose(
    /*
     *applyMiddleware(thunk),
     */
    window.devToolsExtension && window.devToolsExtension()),
);

store.asyncReducers = {};

export function injectReducer(
    injectedStore: AsyncStore<any>, name: string, reducer: Reducer<any>) {
  if (injectedStore.asyncReducers === undefined) {
    return;
  }
  if (injectedStore.asyncReducers[name]) {
    return;
  }
  injectedStore.asyncReducers[name] = reducer;
  injectedStore.replaceReducer(makeRootReducer(injectedStore.asyncReducers));
}

// systemjs-hot-reloader hook, rehydrating the state of redux store
export function __reload(exports: any) {
  console.log(exports.store.getState());
}
