// lib imports
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { Router, browserHistory } from 'react-router';
import { syncHistoryWithStore } from 'react-router-redux';
// app imports

import { store } from './store/index';
import createRoutes from './routes/index';

const history = syncHistoryWithStore(browserHistory, store) as any;
const rootRoute = createRoutes(store);

function App() {
  return (
    <Provider store={store}>
      <Router history={history} routes={rootRoute}/>
    </Provider>
  );
}

export const app = ReactDOM.render(
  <App />, document.getElementById('app-container'),
);
