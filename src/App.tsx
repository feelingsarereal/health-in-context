import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';

const MapPage = lazy(() => import('./pages/MapPage'));
const Maps = lazy(() => import('./pages/Maps'));
const Evidence = lazy(() => import('./pages/Evidence'));
const References = lazy(() => import('./pages/References'));
const Glossary = lazy(() => import('./pages/Glossary'));
const Concepts = lazy(() => import('./pages/Concepts'));
const Concept = lazy(() => import('./pages/Concept'));
const Help = lazy(() => import('./pages/Help'));
const Methods = lazy(() => import('./pages/Methods'));
const About = lazy(() => import('./pages/About'));
const NotFound = lazy(() => import('./pages/NotFound'));

const TITLES: Record<string, string> = {
  '/': 'Health in Context', '/maps': 'My maps', '/map': 'Map', '/map/list': 'Map — list view', '/evidence': 'Evidence', '/references': 'References',
  '/glossary': 'Glossary', '/concepts': 'Primers', '/help': 'Help', '/methods': 'Methods', '/about': 'About',
};

export default function App() {
  const loc = useLocation();
  useEffect(() => {
    const t = TITLES[loc.pathname] ?? (loc.pathname.startsWith('/concepts/') ? 'Primer' : 'Health in Context');
    document.title = t === 'Health in Context' ? t : `${t} · Health in Context`;
  }, [loc.pathname]);
  return (
    <Layout>
      <Suspense fallback={<p className="bx-muted" role="status">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapPage view="canvas" />} />
          <Route path="/map/list" element={<MapPage view="list" />} />
          <Route path="/maps" element={<Maps />} />
          <Route path="/evidence" element={<Evidence />} />
          <Route path="/references" element={<References />} />
          <Route path="/glossary" element={<Glossary />} />
          <Route path="/concepts" element={<Concepts />} />
          <Route path="/concepts/:id" element={<Concept />} />
          <Route path="/help" element={<Help />} />
          <Route path="/methods" element={<Methods />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
