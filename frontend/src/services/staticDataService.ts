/**
 * Static data service for client-side analysis
 * Replaces API calls with local JSON data processing
 */

export interface LiveShow {
  id: number;
  date: string;
  performance_name: string;
  venue: string;
  url?: string;
}

export interface Song {
  id: number;
  name: string;
  song_url?: string;
}

export interface Performance {
  h: number;  // live_history_id (shortened)
  s: number;  // live_song_id (shortened)
  o?: number; // song_order (shortened, optional)
}

export interface SongAnalysis {
  id: number;
  song_name: string;
  hit_count: number;
  total_appearances: number;
  selection_rate: number;
  latest_performance: string;
  latest_venue: string;
}

export interface LatestPerformance {
  latest_performance: string;
  latest_venue: string;
  latest_date: string;
}

// Computed statistics interface
export interface SongStats {
  total_appearances: number;
  selection_rate: number;
}

class StaticDataService {
  private shows: LiveShow[] = [];
  private songs: Song[] = [];
  private performances: Performance[] = [];
  private isLoaded = false;
  
  // Computed indices for performance optimization
  private showsMap: Map<number, LiveShow> = new Map();
  private songsMap: Map<number, Song> = new Map();
  private performancesByShow: Map<number, number[]> = new Map();
  private performancesBySong: Map<number, number[]> = new Map();
  private songStats: Map<number, SongStats> = new Map();

  /**
   * Load all static data files
   */
  async loadData(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const [showsResponse, songsResponse, performancesResponse] = await Promise.all([
        fetch('/data/shows.json'),
        fetch('/data/songs.json'),
        fetch('/data/performances.json')
      ]);

      this.shows = await showsResponse.json();
      this.songs = await songsResponse.json();
      this.performances = await performancesResponse.json();

      // Build performance indices for fast lookup
      this.buildIndices();

      this.isLoaded = true;
      console.log('Static data loaded successfully:', {
        shows: this.shows.length,
        songs: this.songs.length,
        performances: this.performances.length
      });
    } catch (error) {
      console.error('Failed to load static data:', error);
      throw error;
    }
  }

  /**
   * Build performance indices for optimization
   */
  private buildIndices(): void {
    // Clear existing indices
    this.showsMap.clear();
    this.songsMap.clear();
    this.performancesByShow.clear();
    this.performancesBySong.clear();
    this.songStats.clear();

    // Build shows and songs maps
    this.shows.forEach(show => this.showsMap.set(show.id, show));
    this.songs.forEach(song => this.songsMap.set(song.id, song));

    // Build performance indices
    this.performances.forEach(perf => {
      // Group by show
      if (!this.performancesByShow.has(perf.h)) {
        this.performancesByShow.set(perf.h, []);
      }
      this.performancesByShow.get(perf.h)!.push(perf.s);

      // Group by song
      if (!this.performancesBySong.has(perf.s)) {
        this.performancesBySong.set(perf.s, []);
      }
      this.performancesBySong.get(perf.s)!.push(perf.h);
    });

    // Pre-compute song statistics
    this.songs.forEach(song => {
      const appearances = this.performancesBySong.get(song.id)?.length || 0;
      const selectionRate = this.shows.length > 0 ? appearances / this.shows.length : 0;
      this.songStats.set(song.id, {
        total_appearances: appearances,
        selection_rate: Number(selectionRate.toFixed(3))
      });
    });
  }

  /**
   * Get computed statistics for a song
   */
  private getSongStats(songId: number): SongStats {
    return this.songStats.get(songId) || { total_appearances: 0, selection_rate: 0 };
  }

  /**
   * Get latest performance info for a song
   */
  private getLatestPerformance(songId: number): LatestPerformance {
    const showIds = this.performancesBySong.get(songId) || [];
    if (showIds.length === 0) {
      return {
        latest_performance: 'Unknown',
        latest_venue: 'Unknown',
        latest_date: ''
      };
    }

    // Find the latest show by comparing dates (not IDs)
    let latestShow: LiveShow | undefined;
    let latestDate = '';
    
    for (const showId of showIds) {
      const show = this.showsMap.get(showId);
      if (show && (!latestDate || show.date > latestDate)) {
        latestShow = show;
        latestDate = show.date;
      }
    }
    
    return {
      latest_performance: latestShow?.performance_name || 'Unknown',
      latest_venue: latestShow?.venue || 'Unknown',
      latest_date: latestShow?.date || ''
    };
  }

  /**
   * Search shows by performance name or venue
   */
  async searchShows(query: string): Promise<LiveShow[]> {
    await this.loadData();
    
    if (!query.trim()) return [];

    const searchTerm = query.toLowerCase();
    return this.shows.filter(show => 
      show.performance_name.toLowerCase().includes(searchTerm) ||
      show.venue.toLowerCase().includes(searchTerm)
    ).slice(0, 50); // Limit results for performance
  }

  /**
   * Analyze songs for selected shows
   */
  async analyzeSongs(showIds: number[]): Promise<{
    songs: SongAnalysis[];
    completion_rate: number;
    total_songs: number;
    heard_songs: number;
  }> {
    await this.loadData();

    // Find songs that appear in selected shows using optimized indices
    const selectedSongIds = new Set<number>();
    showIds.forEach(showId => {
      const songIds = this.performancesByShow.get(showId) || [];
      songIds.forEach(songId => selectedSongIds.add(songId));
    });

    // Count appearances in selected shows for each song
    const songStats = new Map<number, {
      id: number;
      name: string;
      hit_count: number;
      total_appearances: number;
      selection_rate: number;
    }>();

    // Initialize with songs that appear in selected shows
    selectedSongIds.forEach(songId => {
      const song = this.songsMap.get(songId);
      if (song) {
        const stats = this.getSongStats(songId);
        
        // Count how many times this song appears in selected shows
        let hitCount = 0;
        showIds.forEach(showId => {
          const songsInShow = this.performancesByShow.get(showId) || [];
          if (songsInShow.includes(songId)) {
            hitCount++;
          }
        });

        songStats.set(songId, {
          id: song.id,
          name: song.name,
          hit_count: hitCount,
          total_appearances: stats.total_appearances,
          selection_rate: stats.selection_rate
        });
      }
    });

    // Convert to analysis format
    const analysisResults: SongAnalysis[] = Array.from(songStats.values()).map(stat => {
      const latest = this.getLatestPerformance(stat.id);

      return {
        id: stat.id,
        song_name: stat.name,
        hit_count: stat.hit_count,
        total_appearances: stat.total_appearances,
        selection_rate: stat.selection_rate,
        latest_performance: latest.latest_performance,
        latest_venue: latest.latest_venue
      };
    });

    // Sort by hit count descending
    analysisResults.sort((a, b) => b.hit_count - a.hit_count);

    // Calculate completion rate
    const totalUniqueSongs = this.songs.length;
    const heardSongs = analysisResults.length;
    const completionRate = totalUniqueSongs > 0 ? heardSongs / totalUniqueSongs : 0;

    return {
      songs: analysisResults,
      completion_rate: completionRate,
      total_songs: totalUniqueSongs,
      heard_songs: heardSongs
    };
  }

  /**
   * Reverse analysis - find songs NOT in selected shows
   */
  async analyzeReverseSongs(showIds: number[]): Promise<{
    songs: SongAnalysis[];
    completion_rate: number;
    total_songs: number;
    never_heard_songs: number;
  }> {
    await this.loadData();

    // Find songs that appear in selected shows using optimized indices
    const heardSongIds = new Set<number>();
    showIds.forEach(showId => {
      const songIds = this.performancesByShow.get(showId) || [];
      songIds.forEach(songId => heardSongIds.add(songId));
    });

    // Find songs that were never heard in selected shows but have historical appearances
    const neverHeardSongs = this.songs.filter(song => {
      const stats = this.getSongStats(song.id);
      return !heardSongIds.has(song.id) && stats.total_appearances > 0;
    });

    // Convert to analysis format
    const analysisResults: SongAnalysis[] = neverHeardSongs.map(song => {
      const stats = this.getSongStats(song.id);
      const latest = this.getLatestPerformance(song.id);

      return {
        id: song.id,
        song_name: song.name,
        hit_count: 0, // Always 0 for reverse analysis
        total_appearances: stats.total_appearances,
        selection_rate: stats.selection_rate,
        latest_performance: latest.latest_performance,
        latest_venue: latest.latest_venue
      };
    });

    // Sort by selection rate descending (songs with high historical rate but not heard)
    analysisResults.sort((a, b) => b.selection_rate - a.selection_rate);

    // Calculate completion rate (percentage of songs never heard)
    const totalUniqueSongs = this.songs.length;
    const neverHeardCount = analysisResults.length;
    const completionRate = totalUniqueSongs > 0 ? neverHeardCount / totalUniqueSongs : 0;

    return {
      songs: analysisResults,
      completion_rate: completionRate,
      total_songs: totalUniqueSongs,
      never_heard_songs: neverHeardCount
    };
  }

  /**
   * Get basic statistics
   */
  async getStats(): Promise<{
    total_shows: number;
    total_songs: number;
    total_performances: number;
  }> {
    await this.loadData();
    
    return {
      total_shows: this.shows.length,
      total_songs: this.songs.length,
      total_performances: this.performances.length
    };
  }
}

// Export singleton instance
export const staticDataService = new StaticDataService();
