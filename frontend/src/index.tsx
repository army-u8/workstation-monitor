/* @refresh reload */
import { render } from 'solid-js/web';
import { HashRouter } from '@solidjs/router';
import './index.css';
import App from './App.tsx';

const root = document.getElementById('root');

render(
  () => (
    <HashRouter>
      <App />
    </HashRouter>
  ),
  root!,
);
