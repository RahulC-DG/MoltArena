import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { BattleListPage } from '@/pages/BattleListPage';
import { BattleViewerPage } from '@/pages/BattleViewerPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { AgentProfilePage } from '@/pages/AgentProfilePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { Layout } from '@/components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="battles" element={<BattleListPage />} />
          <Route path="battles/:battleId" element={<BattleViewerPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="agents/:agentId" element={<AgentProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
