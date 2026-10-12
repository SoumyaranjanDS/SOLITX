import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import SetupUsername from './pages/SetupUsername';
import Home from './pages/Home';
import Profile from './pages/Profile';
import PostDetail from './pages/PostDetail';
import Explore from './pages/Explore';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Bookmarks from './pages/Bookmarks';
import Lists from './pages/Lists';
import ListDetail from './pages/ListDetail';
import Communities from './pages/Communities';
import CommunityDetail from './pages/CommunityDetail';
import Premium from './pages/Premium';

// Handle OAuth tokens in URL
const OAuthHandler = ({ children }) => {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  const urlUser = params.get('user');

  if (urlToken && urlUser) {
    localStorage.setItem('token', urlToken);
    localStorage.setItem('user', urlUser);
    // Clean up the URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  return children;
};

const App = () => {
  return (
    <BrowserRouter>
      <OAuthHandler>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/setup-username" element={<SetupUsername />} />
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/lists" element={<Lists />} />
          <Route path="/lists/:id" element={<ListDetail />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/communities/:slug" element={<CommunityDetail />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/more" element={<Navigate to="/" replace />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </OAuthHandler>
    </BrowserRouter>
  );
};

export default App;