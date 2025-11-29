/**
 * Playlist View Preference Hook
 * Manages playlist view preference (grid/list) with cookie persistence
 */

import { useState } from 'react';
import { cookieService } from '@/services/cookieService';

export type PlaylistView = 'grid' | 'list';

export const usePlaylistView = () => {
  const [view, setViewState] = useState<PlaylistView>(() => {
    // Load from cookie
    const saved = cookieService.getPlaylistView();
    return (saved === 'grid' || saved === 'list') ? saved : 'grid';
  });

  const setView = (newView: PlaylistView) => {
    setViewState(newView);
    cookieService.setPlaylistView(newView);
  };

  return { view, setView };
};
