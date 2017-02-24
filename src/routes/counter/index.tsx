import { Store } from 'redux';
import Counter from './containers/CounterContainer';
import { injectReducer } from '../../store/index';
import reducer from './modules/counter';

export default (store: Store<any>) => ({
  path: '/counter',
  getComponent: (nextState: any, cb: any) => {
    injectReducer(store, 'counter', reducer);
    return cb(null, Counter);
  },
});
