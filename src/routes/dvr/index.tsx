import { Store } from 'redux';
import Dvr from './containers/DvrContainer';
import { injectReducer } from '../../store/index';
import reducer from './modules/dvr';

export default (store: Store<any>) => ({
  path: '/dvr',
  getComponent: (nextState: any, cb: any) => {
    injectReducer(store, 'dvr', reducer);
    return cb(null, Dvr);
  },
});
